import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  apiCatalogoDataSchema,
  apiSitioDataSchema,
  type Mascota,
} from '../src/lib/schema';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT, 'src', 'data');
const FIXTURES_DIR = resolve(ROOT, 'fixtures');
const PAGE_SIZE = 500;
const MAX_PAGES = 200;

try {
  // Node >= 20.12: carga .env sin dependencias.
  (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile?.(
    resolve(ROOT, '.env'),
  );
} catch {
  // Sin .env: se usan las variables del entorno o los fixtures.
}

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const runResponseSchema = z.object({
  response: z.object({ result: z.unknown() }).optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

type Envelope = z.infer<typeof envelopeSchema>;

function log(message: string): void {
  console.log(`[data] ${message}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function missingCredentials(): string[] {
  return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'API_DEPLOYMENT_ID'].filter(
    (name) => !process.env[name],
  );
}

function useFixtures(reason: string): never {
  const pairs = ['site.json', 'pets.json'];
  const missing = pairs.filter((file) => !existsSync(resolve(FIXTURES_DIR, file)));
  if (missing.length) {
    throw new Error(`Modo fixtures activo (${reason}) pero faltan: ${missing.join(', ')}`);
  }

  mkdirSync(DATA_DIR, { recursive: true });
  for (const file of pairs) {
    copyFileSync(resolve(FIXTURES_DIR, file), resolve(DATA_DIR, file));
  }

  log(`Datos de ejemplo copiados a src/data (${reason}).`);
  log('Este build NO debe publicarse: usa los datos reales del API.');
  process.exit(0);
}

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN as string,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const detail = typeof json.error_description === 'string' ? json.error_description : json.error;
    throw new Error(`No se pudo obtener el access token (${response.status}): ${String(detail)}`);
  }

  const token = json.access_token;
  if (typeof token !== 'string' || !token) {
    throw new Error('La respuesta de OAuth no incluyó access_token.');
  }
  return token;
}

async function runFunction(
  token: string,
  deploymentId: string,
  fn: string,
  parameters: unknown[],
): Promise<unknown> {
  const response = await fetch(
    `https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: fn, parameters, devMode: false }),
      signal: AbortSignal.timeout(120_000),
    },
  );

  const json = (await response.json()) as unknown;

  const parsed = runResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Respuesta inesperada de Apps Script para ${fn}: ${parsed.error.message}`);
  }

  if (!response.ok || parsed.data.error) {
    const apiError = parsed.data.error;
    throw new Error(
      `Apps Script rechazó ${fn} (${response.status} ${apiError?.status ?? ''}): ${
        apiError?.message ?? 'sin detalle'
      }`,
    );
  }

  const result = parsed.data.response?.result;
  if (!result) throw new Error(`Apps Script no devolvió resultado para ${fn}.`);

  const envelope = envelopeSchema.parse(result) as Envelope;
  if (!envelope.ok) {
    throw new Error(`API ${fn} falló: ${envelope.error?.code ?? 'UNKNOWN'} — ${envelope.error?.message ?? ''}`);
  }

  return envelope.data;
}

async function withRetry<T>(label: string, task: () => Promise<T>): Promise<T> {
  const attempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const waitMs = 1000 * 3 ** (attempt - 1);
      log(`${label} falló (intento ${attempt}/${attempts}): ${errorMessage(error)}`);
      log(`Reintentando en ${waitMs / 1000}s…`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMs));
    }
  }

  throw lastError;
}

function validatePets(pets: Mascota[], fundacionIds: Set<string>): void {
  const ids = new Set<string>();
  const duplicados = new Set<string>();

  for (const pet of pets) {
    if (ids.has(pet.id)) duplicados.add(pet.id);
    ids.add(pet.id);
    if (!fundacionIds.has(pet.fundacionId)) {
      log(`Aviso: la mascota ${pet.id} apunta a una fundación desconocida (${pet.fundacionId}).`);
    }
  }

  if (duplicados.size) {
    throw new Error(`IDs duplicados en el catálogo: ${[...duplicados].slice(0, 10).join(', ')}`);
  }

  const sinFundacion = pets.filter((pet) => !fundacionIds.has(pet.fundacionId)).length;
  if (sinFundacion) log(`${sinFundacion} mascota(s) sin fundación válida.`);
}

async function main(): Promise<void> {
  const missing = missingCredentials();
  const fixturesForced = process.env.USE_FIXTURES === '1';
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  if (fixturesForced) useFixtures('USE_FIXTURES=1');

  if (missing.length) {
    const reason = `faltan ${missing.join(', ')}`;
    if (isCI) {
      throw new Error(`No se puede compilar en CI: ${reason}. Configura los secrets del repo.`);
    }
    useFixtures(reason);
  }

  const deploymentId = process.env.API_DEPLOYMENT_ID as string;

  log('Solicitando access token…');
  const token = await getAccessToken();

  const sitioData = await withRetry('apiSitio', async () =>
    apiSitioDataSchema.parse(await runFunction(token, deploymentId, 'apiSitio', [])),
  );

  const fundacionIds = new Set(sitioData.fundaciones.map((fundacion) => fundacion.id));

  const primeraPagina = await withRetry('apiCatalogo (página 1)', async () =>
    apiCatalogoDataSchema.parse(
      await runFunction(token, deploymentId, 'apiCatalogo', [1, PAGE_SIZE]),
    ),
  );

  const total = primeraPagina.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (pages > MAX_PAGES) {
    throw new Error(`El API reporta ${pages} páginas; el máximo de seguridad es ${MAX_PAGES}.`);
  }

  const mascotas: Mascota[] = [...primeraPagina.mascotas];

  for (let page = 2; page <= pages; page += 1) {
    const data = await withRetry(`apiCatalogo (página ${page}/${pages})`, async () =>
      apiCatalogoDataSchema.parse(
        await runFunction(token, deploymentId, 'apiCatalogo', [page, PAGE_SIZE]),
      ),
    );
    mascotas.push(...data.mascotas);
    log(`Página ${page}/${pages}: ${data.mascotas.length} mascotas.`);
  }

  if (total > 0 && mascotas.length !== total) {
    throw new Error(`El API reportó total=${total} pero se recibieron ${mascotas.length} mascotas.`);
  }

  validatePets(mascotas, fundacionIds);

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, 'site.json'), `${JSON.stringify(sitioData)}\n`, 'utf8');
  writeFileSync(resolve(DATA_DIR, 'pets.json'), `${JSON.stringify(mascotas)}\n`, 'utf8');

  log(
    `Listo: ${mascotas.length} mascotas de ${sitioData.fundaciones.length} fundaciones ` +
      `(${pages} página(s) del API).`,
  );
}

main().catch((error) => {
  console.error(`[data] ERROR: ${errorMessage(error)}`);
  process.exit(1);
});
