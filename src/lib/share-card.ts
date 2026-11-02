/**
 * Renderer del póster 1080×1920 con Canvas 2D.
 *
 * Sin librerías ni WebAssembly: dibuja la foto con cover crop, el degradado y
 * los textos. El mismo código sirve para el preview (540×960) y para el JPEG
 * final; el preview solo aplica un `scale` de 0.5.
 */

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1920;
export const PHOTO_HEIGHT = 1120;

const BODY = '"Inter Variable", Inter, system-ui, sans-serif';
const HEADING = '"Montserrat Variable", Montserrat, system-ui, sans-serif';
const INK = '#0F172A';

export type PosterData = {
  nombre: string;
  especie: string;
  edad: string;
  anioRescate: number | null;
  energia: string;
  resumen: string;
  foto: string;
  estado: string;
};

export type Focus = { x: number; y: number };

export type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

const clamp = (value: number, min = 0, max = 1): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0.5;

/** Ancla inicial: las fotos verticales suelen tener la cabeza arriba. */
export function defaultFocus(width: number, height: number): Focus {
  if (!width || !height) return { x: 0.5, y: 0.5 };
  const ratio = width / height;
  if (ratio > 1.1) return { x: 0.5, y: 0.5 };
  if (ratio >= 0.9) return { x: 0.5, y: 0.4 };
  return { x: 0.5, y: 0.32 };
}

/** Rectángulo de dibujo para cubrir el marco sin deformar la foto. */
export function coverRect(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  focus: Focus,
): { x: number; y: number; width: number; height: number; overflowX: number; overflowY: number } {
  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const overflowX = Math.max(0, width - frameWidth);
  const overflowY = Math.max(0, height - frameHeight);
  return {
    x: -overflowX * clamp(focus.x),
    y: -overflowY * clamp(focus.y),
    width,
    height,
    overflowX,
    overflowY,
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawPaw(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const s = size / 30;
  ctx.fillStyle = color;
  const toes: Array<[number, number, number]> = [
    [-7.5, -7, 3.4],
    [-2.6, -10.5, 3.6],
    [2.6, -10.5, 3.6],
    [7.5, -7, 3.4],
  ];
  for (const [x, y, r] of toes) {
    ctx.beginPath();
    ctx.ellipse(cx + x * s, cy + y * s, r * s, r * s * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3.5 * s, 8 * s, 6.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string): void {
  const target = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in target) target.letterSpacing = value;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) {
      lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]} ${current}`, maxWidth);
      return lines;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  weight: string,
  family: string,
): number {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 4;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

function statusInfo(estado: string): { label: string; color: string } {
  if (estado === 'Adoptado') return { label: 'ADOPTADO', color: '#4F46E5' };
  if (estado === 'Fallecido') return { label: 'EN MEMORIA', color: '#475569' };
  return { label: 'DISPONIBLE', color: '#059669' };
}

function speciesLabel(especie: string): string {
  if (especie === 'Perros') return 'Perro';
  if (especie === 'Gatos') return 'Gato';
  return 'Animal';
}

function chipLabels(data: PosterData): string[] {
  const labels: string[] = [];
  const base = [speciesLabel(data.especie), data.edad].filter(Boolean).join(' · ');
  if (base) labels.push(base);
  if (data.anioRescate) labels.push(`Rescate ${data.anioRescate}`);
  if (data.energia) labels.push(`Energía ${data.energia.toLowerCase()}`);
  return labels;
}

function drawPlaceholder(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, PHOTO_HEIGHT);
  gradient.addColorStop(0, '#1E293B');
  gradient.addColorStop(1, INK);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, POSTER_WIDTH, PHOTO_HEIGHT);
  drawPaw(ctx, POSTER_WIDTH / 2, PHOTO_HEIGHT / 2 - 40, 220, 'rgba(255,255,255,0.08)');
}

/**
 * Dibuja el póster completo. `scale` permite reutilizar el layout en el
 * preview (0.5) sin duplicar coordenadas.
 */
export function drawPoster(
  ctx: CanvasRenderingContext2D,
  image: LoadedImage | null,
  data: PosterData,
  focus: Focus,
  scale = 1,
): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  if (image) {
    const rect = coverRect(
      image.width,
      image.height,
      POSTER_WIDTH,
      PHOTO_HEIGHT,
      focus,
    );
    ctx.drawImage(image.source, rect.x, rect.y, rect.width, rect.height);
  } else {
    drawPlaceholder(ctx);
  }

  const gradient = ctx.createLinearGradient(0, 820, 0, PHOTO_HEIGHT);
  gradient.addColorStop(0, 'rgba(15,23,42,0)');
  gradient.addColorStop(1, 'rgba(15,23,42,1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 820, POSTER_WIDTH, PHOTO_HEIGHT - 820);

  // Barra superior en zona segura (y=260).
  const topY = 260;
  const pillHeight = 62;
  const brand = 'RED DE ADOPCIÓN';
  ctx.font = `700 28px ${BODY}`;
  setLetterSpacing(ctx, '2px');
  const brandWidth = 26 + 30 + 12 + ctx.measureText(brand).width + 26;
  roundedRect(ctx, 64, topY, brandWidth, pillHeight, 31);
  ctx.fillStyle = 'rgba(15,23,42,0.7)';
  ctx.fill();
  drawPaw(ctx, 64 + 26 + 15, topY + 31, 30, '#FFFFFF');
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.fillText(brand, 64 + 26 + 30 + 12, topY + 32);

  const status = statusInfo(data.estado);
  const badgeWidth = ctx.measureText(status.label).width + 52;
  const badgeX = POSTER_WIDTH - 64 - badgeWidth;
  roundedRect(ctx, badgeX, topY, badgeWidth, pillHeight, 31);
  ctx.fillStyle = status.color;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(status.label, badgeX + 26, topY + 32);
  setLetterSpacing(ctx, '0px');

  // Overline
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 34px ${BODY}`;
  setLetterSpacing(ctx, '4px');
  ctx.fillStyle = '#6EE7B7';
  ctx.fillText('BUSCA FAMILIA', 72, 1160);
  setLetterSpacing(ctx, '0px');

  // Nombre
  const nameSize = fitFontSize(ctx, data.nombre, 936, 128, 72, '800', HEADING);
  ctx.font = `800 ${nameSize}px ${HEADING}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(ellipsize(ctx, data.nombre, 936), 72, 1212);

  // Chips
  ctx.font = `500 34px ${BODY}`;
  let chipX = 72;
  for (const label of chipLabels(data)) {
    const width = ctx.measureText(label).width + 48;
    if (chipX + width > POSTER_WIDTH - 72) break;
    roundedRect(ctx, chipX, 1352, width, 66, 33);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.fillStyle = '#E2E8F0';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, chipX + 24, 1352 + 34);
    chipX += width + 14;
  }

  // Resumen
  ctx.font = `400 44px ${BODY}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#CBD5E1';
  const lines = wrapLines(ctx, data.resumen, 936, 3);
  lines.forEach((line, index) => {
    ctx.fillText(line, 72, 1440 + index * 57);
  });

  // Pie
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(72, 1640, 936, 1);
  ctx.font = `600 30px ${BODY}`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('andreschapid-u.github.io/red-adopcion', 72, 1655);
  ctx.textAlign = 'right';
  ctx.font = `400 30px ${BODY}`;
  ctx.fillStyle = '#64748B';
  ctx.fillText('Adopta, no compres', POSTER_WIDTH - 72, 1655);
  ctx.textAlign = 'left';

  ctx.restore();
}

/** Carga la foto con CORS. Si falla, devuelve null y se dibuja el placeholder. */
export async function loadPosterImage(url: string): Promise<LoadedImage | null> {
  const clean = (url || '').trim();
  if (!clean) return null;

  try {
    const response = await fetch(clean, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    return loadWithElement(clean);
  }
}

function loadWithElement(url: string): Promise<LoadedImage | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.decoding = 'async';
    image.onload = () =>
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Genera el JPEG final de 1080×1920. */
export async function renderPosterBlob(
  image: LoadedImage | null,
  data: PosterData,
  focus: Focus,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  drawPoster(ctx, image, data, focus);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      'image/jpeg',
      0.92,
    );
  });
}
