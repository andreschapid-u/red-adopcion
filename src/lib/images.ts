import { absUrl } from './urls';

export type ImageSources = {
  /** URL principal (800 px si Google permite resize). */
  src: string;
  /** srcset de 400/800/1200 px, solo si el host lo soporta. */
  srcset?: string;
};

const PLACEHOLDER = '/images/pet-placeholder.svg';
const LH3_RE = /^https:\/\/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/;
const DRIVE_RE =
  /^https:\/\/drive\.google\.com\/(?:file\/d\/([A-Za-z0-9_-]+)|open\?id=([A-Za-z0-9_-]+)|uc\?[^#]*id=([A-Za-z0-9_-]+))/;

function driveId(url: string): string | null {
  const lh3 = url.match(LH3_RE);
  if (lh3) return lh3[1];
  const drive = url.match(DRIVE_RE);
  if (drive) return drive[1] || drive[2] || drive[3] || null;
  return null;
}

function isSafeHttps(url: string): boolean {
  return /^https:\/\/[^\s"'<>]+$/i.test(url);
}

/**
 * Normaliza fotos de Google Drive/Sheets y genera un srcset con el resize
 * propio de `lh3.googleusercontent.com`. Si el host no lo soporta, devuelve
 * la URL original (sin srcset). Si la URL es inválida, devuelve el placeholder.
 */
export function imageSources(raw: string | null | undefined): ImageSources {
  const url = (raw || '').trim();
  if (!isSafeHttps(url)) return { src: PLACEHOLDER };

  const id = driveId(url);
  if (id) {
    const base = `https://lh3.googleusercontent.com/d/${id}`;
    return {
      src: `${base}=w800`,
      srcset: `${base}=w400 400w, ${base}=w800 800w, ${base}=w1200 1200w`,
    };
  }

  return { src: url };
}

/** Imagen para Open Graph: 1200 px si es de Google, si no la original. */
export function ogImage(raw: string | null | undefined): string {
  const url = (raw || '').trim();
  if (!isSafeHttps(url)) return absUrl('/og-default.png');
  const id = driveId(url);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w1200`;
  return url;
}
