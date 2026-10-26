import siteJson from '../data/site.json';
import petsJson from '../data/pets.json';
import { petsSchema, sitioSchema } from './schema';
import { foundationMap } from './utils';

/**
 * Datos de build. `scripts/fetch-data.ts` los escribe en `src/data/` antes de
 * compilar; si el API devuelve algo inválido, el build falla y Pages conserva
 * el último despliegue bueno.
 */
export const site = sitioSchema.parse(siteJson);
export const pets = petsSchema.parse(petsJson);
export const fundaciones = site.fundaciones;
export const fundacionesPorId = foundationMap(fundaciones);
