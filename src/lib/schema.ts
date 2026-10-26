import { z } from 'zod';

export const ESPECIES = ['Perros', 'Gatos', 'Otros'] as const;
export const ESTADOS = ['Disponible en adopción', 'Adoptado', 'Fallecido'] as const;

export type Especie = (typeof ESPECIES)[number];
export type Estado = (typeof ESTADOS)[number];

export const fundacionSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  whatsapp: z.string(),
  color: z.string(),
  logo: z.string(),
  redesUrl: z.string(),
});

export const mascotaSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  fundacionId: z.string().min(1),
  fundacionNombre: z.string(),
  nombre: z.string().min(1),
  especie: z.enum(ESPECIES),
  edad: z.string(),
  estado: z.enum(ESTADOS),
  cualidades: z.string(),
  descripcion: z.string(),
  fotos: z.object({
    principal: z.string(),
    antes: z.string(),
    despues: z.string(),
  }),
});

export const sitioSchema = z.object({
  general: z.object({
    titulo: z.string(),
    mision: z.string(),
    instagramUrl: z.string(),
  }),
  fundaciones: z.array(fundacionSchema),
});

export const petsSchema = z.array(mascotaSchema);

/** Respuestas del API executable (`data` del envelope). */
export const apiSitioDataSchema = sitioSchema;
export const apiCatalogoDataSchema = z.object({
  mascotas: petsSchema,
  total: z.number().int().nonnegative(),
});

export type Fundacion = z.infer<typeof fundacionSchema>;
export type Mascota = z.infer<typeof mascotaSchema>;
export type Sitio = z.infer<typeof sitioSchema>;
