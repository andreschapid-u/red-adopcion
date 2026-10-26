/**
 * Genera un refresh token OAuth con el flujo loopback de un cliente Desktop.
 * Uso: `npm run auth` (lee GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET de .env).
 * No se ejecuta en CI.
 */
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile?.(
    resolve(ROOT, '.env'),
  );
} catch {
  // Sin .env: se usan las variables del entorno.
}

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/script.scriptapp';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en el entorno o en .env');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('include_granted_scopes', 'true');

function openBrowser(url: string): void {
  const command =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(command, () => {
    // Si falla, la URL queda impresa en consola.
  });
}

function respond(res: import('node:http').ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><html lang="es"><meta charset="utf-8">` +
      `<title>Red de Adopción</title>` +
      `<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem">` +
      `<h1>${status === 200 ? 'Listo' : 'Error'}</h1><p>${message}</p></body></html>`,
  );
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (!code && !error) {
    respond(res, 404, 'Ruta no válida.');
    return;
  }

  if (error) {
    respond(res, 400, `Google devolvió: ${error}. Cierra esta pestaña y revisa la consola.`);
    console.error(`OAuth cancelado o rechazado: ${error}`);
    setTimeout(() => process.exit(1), 500);
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const json = (await tokenResponse.json()) as Record<string, unknown>;

    if (!tokenResponse.ok) {
      throw new Error(String(json.error_description || json.error || tokenResponse.status));
    }

    const refreshToken = json.refresh_token;
    if (typeof refreshToken !== 'string' || !refreshToken) {
      respond(
        res,
        500,
        'Google no devolvió refresh_token. Revoca el acceso de la app en tu cuenta y repite el proceso.',
      );
      console.error('Sin refresh_token: vuelve a ejecutar npm run auth y acepta el consentimiento completo.');
      setTimeout(() => process.exit(1), 500);
      return;
    }

    respond(res, 200, 'Refresh token generado. Ya puedes cerrar esta pestaña y volver a la terminal.');
    console.log('\nGOOGLE_REFRESH_TOKEN=' + refreshToken);
    console.log('\nGuárdalo en .env y en los Secrets de GitHub. No lo compartas ni lo subas al repo.\n');
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    respond(res, 500, 'No se pudo intercambiar el código por un token. Revisa la consola.');
    console.error('Error al intercambiar el código:', err instanceof Error ? err.message : err);
    setTimeout(() => process.exit(1), 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nAbre esta URL y autoriza con la cuenta dueña de la hoja:\n');
  console.log(authUrl.href);
  console.log('\nEsperando el callback en ' + REDIRECT_URI + ' …\n');
  openBrowser(authUrl.href);
});

server.on('error', (err) => {
  console.error(`No se pudo abrir el puerto ${PORT}:`, err.message);
  process.exit(1);
});

setTimeout(
  () => {
    console.error('Tiempo agotado (5 minutos). Vuelve a ejecutar npm run auth.');
    process.exit(1);
  },
  5 * 60 * 1000,
);
