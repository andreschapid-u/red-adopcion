/** URL pública del sitio, sin barra final. */
export const SITE_URL = 'https://andreschapid-u.github.io';

/** Prefijo del despliegue en GitHub Pages (`/red-adopcion`). */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefijo para cualquier asset o ruta interna: `/red-adopcion/catalogo/`. */
export function withBase(path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}

/** URL absoluta y canónica: `https://andreschapid-u.github.io/red-adopcion/...`. */
export function absUrl(path = '/'): string {
  return new URL(withBase(path), SITE_URL).href;
}

/** Ruta interna de una ficha (siempre con barra final). */
export function petPath(id: string): string {
  return withBase(`/mascota/${encodeURIComponent(id)}/`);
}

/** URL canónica absoluta de una ficha. */
export function petAbsUrl(id: string): string {
  return absUrl(`/mascota/${encodeURIComponent(id)}/`);
}

/** Asset local; respeta URLs absolutas. */
export function asset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return withBase(path);
}
