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
