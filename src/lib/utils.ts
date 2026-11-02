import type { Fundacion, Mascota } from './schema';

export const ESTADO_DISPONIBLE = 'Disponible en adopción' as const;

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Orden estable: nombre y, si empatan, ID. */
export function comparePets(a: Mascota, b: Mascota): number {
  return collator.compare(a.nombre, b.nombre) || collator.compare(a.id, b.id);
}

export function sortPets(pets: Mascota[]): Mascota[] {
  return [...pets].sort(comparePets);
}

export function availablePets(pets: Mascota[]): Mascota[] {
  return pets.filter((pet) => pet.estado === ESTADO_DISPONIBLE);
}

export function foundationMap(fundaciones: Fundacion[]): Map<string, Fundacion> {
  return new Map(fundaciones.map((fundacion) => [fundacion.id, fundacion]));
}

/** Responsive: mismo criterio que la grilla de tarjetas. */
export const CARD_SIZES =
  '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

export function truncate(text: string, max: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, '')}…`;
}

export function metaDescription(text: string, max = 158): string {
  const clean = truncate(text, max);
  return clean || 'Mascotas en adopción en Colombia. Conoce a los rescatados de nuestra red de fundaciones y encuentra a tu próximo compañero.';
}

export function speciesLabel(especie: string): string {
  if (especie === 'Perros') return 'perro';
  if (especie === 'Gatos') return 'gato';
  return 'animal';
}

export function petSummary(pet: Mascota): string {
  return (
    pet.cualidades ||
    pet.descripcion ||
    `${pet.nombre} es un${pet.especie === 'Perros' ? '' : 'a'} ${pet.especie.toLowerCase().replace(/s$/, '')} que busca una familia responsable.`
  );
}

/** Primera oración de un texto largo, sin saltos de línea. */
export function firstSentence(text: string): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/^[^.!?]+[.!?]/);
  return (match ? match[0] : clean).trim();
}

/**
 * Texto corto del póster. Prioriza la columna Resumen_Compartir; si falta,
 * cae a la primera oración de la historia, luego a las cualidades y por último
 * a una frase genérica. Máximo 120 caracteres para que entre en tres líneas.
 */
export function posterSummary(pet: Mascota): string {
  const directo = truncate(pet.resumenCompartir, 120);
  if (directo) return directo;

  const historia = truncate(firstSentence(pet.historia), 120);
  if (historia) return historia;

  const cualidades = truncate(pet.cualidades, 120);
  if (cualidades) return cualidades;

  return truncate(`Busca una familia en ${pet.fundacionNombre}.`, 120);
}

/** Chip de rescate: `Rescate 2019`. Vacío si no hay año. */
export function formatFechaRescate(pet: Mascota): string {
  return pet.anioRescate ? `Rescate ${pet.anioRescate}` : '';
}

/** Chip de energía: `Energía baja`. Vacío si no hay dato. */
export function energiaLabel(pet: Mascota): string {
  return pet.energia ? `Energía ${pet.energia.toLowerCase()}` : '';
}

/** Clases del badge de energía (deben quedar literales para Tailwind). */
export function energiaClass(energia: string): string {
  if (energia === 'Baja') return 'bg-sky-50 text-sky-700 ring-sky-600/20';
  if (energia === 'Media') return 'bg-amber-50 text-amber-700 ring-amber-600/20';
  if (energia === 'Alta') return 'bg-rose-50 text-rose-700 ring-rose-600/20';
  return 'bg-slate-100 text-slate-600 ring-slate-500/20';
}

/** Más reciente primero; las mascotas sin año van al final. */
export function sortByRescate(pets: Mascota[]): Mascota[] {
  return [...pets].sort(
    (a, b) => (b.anioRescate ?? 0) - (a.anioRescate ?? 0) || comparePets(a, b),
  );
}

/** Letra inicial sin tildes, para el índice alfabético. */
export function initialLetter(name: string): string {
  const first = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export const WHATSAPP_TEXT = (pet: Mascota) =>
  `Hola ${pet.fundacionNombre}, me interesa adoptar a ${pet.nombre} (ID: ${pet.id}). ¿Me pueden dar más información?`;

export function whatsappUrl(whatsapp: string, text: string): string {
  const digits = (whatsapp || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : '';
}

export function formatNumber(value: number): string {
  return value.toLocaleString('es-CO');
}

/** Evita romper el HTML si un texto de la hoja contiene `</script>`. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
