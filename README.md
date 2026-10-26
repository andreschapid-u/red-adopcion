# Red de Adopción — sitio web

Sitio estático del catálogo multi-fundación de mascotas en adopción. Se compila con **Astro 7 + TypeScript + Tailwind 4** y se publica en GitHub Pages.

- URL: <https://andreschapid-u.github.io/red-adopcion/>
- Repo: `andreschapid-u/red-adopcion` (público, requisito de Pages en el plan gratuito)
- API: repo privado `andreschapid-u/red-adopcion-api` (Apps Script como Ejecutable de API)

El navegador **nunca llama al API**: GitHub Actions descarga los datos en el build, los valida con Zod y genera HTML estático. Si el API falla o devuelve datos inválidos, el build falla y Pages sigue sirviendo el último despliegue bueno.

## Arquitectura

```
Google Sheets
    │ spreadsheets.readonly
    ▼
Apps Script (API Executable, repo privado)
    │ scripts.run + OAuth
    ▼
GitHub Actions ──► scripts/fetch-data.ts ──► src/data/{site,pets}.json
    │                                              │
    │                                              ▼
    └──────────────────────────────► Astro build ──► dist/ ──► GitHub Pages
```

- Frescura: cron cada 30 minutos + `workflow_dispatch`.
- Datos: `apiHealth()` como smoke test + `apiSitio()` + `apiCatalogo(pagina, 500)` paginado para soportar 1000+ fichas. El build falla si el API no responde o no devuelve fundaciones.
- Imágenes: resize de `lh3.googleusercontent.com` con `srcset` (400/800/1200) y placeholder local si falta o falla la foto.
- SEO: rutas reales, canonical, OG/Twitter por mascota, JSON-LD, sitemap e índice alfabético.
- Compartir: Facebook, WhatsApp, X, Instagram (share nativo o copiar enlace), copiar y Web Share.
- Filtros: índice compacto embebido + paginación client-side de 24; el HTML inicial ya trae 24 tarjetas.

## Comandos

Requiere Node 24+.

```bash
npm install
npm run data     # descarga y valida los datos del API (o copia fixtures si faltan credenciales)
npm run dev      # datos + servidor local en /red-adopcion/
npm run build    # datos + build estático en dist/
npm run preview  # sirve dist/
npm run auth     # genera el refresh token OAuth (uso local)
```

Con `astro dev` el sitio queda en `http://localhost:4321/red-adopcion/`.

### Desarrollo sin credenciales

Si faltan las variables de OAuth, `npm run data` copia `fixtures/` a `src/data/` y avisa en consola. Esos datos son de ejemplo y **no deben publicarse**. En CI el script falla en lugar de usar fixtures.

También puedes forzarlo con `USE_FIXTURES=1 npm run build`.

## Variables de entorno

Copia `.env.example` a `.env`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
API_DEPLOYMENT_ID=
```

En GitHub:

- **Secrets** del repo web: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.
- **Variable** del repo web: `API_DEPLOYMENT_ID` (ID de la implementación *API Executable*, no el `scriptId`).

Nunca subas `.env` ni credenciales al repo.

## OAuth (una sola vez)

El build usa `POST https://script.googleapis.com/v1/scripts/{deploymentId}:run` con OAuth. El proyecto Cloud que autoriza debe ser **el mismo** al que está vinculado el proyecto de Apps Script; si no, la API responde `403 PERMISSION_DENIED`.

1. Crea un proyecto en Google Cloud y habilita la **Apps Script API**.
2. En Apps Script: **Configuración del proyecto → Proyecto de Google Cloud → Cambiar proyecto** y usa ese proyecto.
3. Configura la pantalla de consentimiento (External) con el scope `https://www.googleapis.com/auth/script.scriptapp` y publícala en **producción** (en *Testing* el refresh token caduca a los 7 días).
4. Crea un **OAuth Client ID** de tipo *Desktop app*.
5. Guarda `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`.
6. Ejecuta `npm run auth`, autoriza con la cuenta dueña de la hoja y copia el `GOOGLE_REFRESH_TOKEN` a `.env`.
7. Crea el deployment **API Executable** y copia su ID a `API_DEPLOYMENT_ID`.

El detalle del API está en el README del repo `red-adopcion-api`.

## Publicación en GitHub Pages

1. El repo debe ser **público** (Pages y minutos de Actions gratis).
2. **Settings → Pages → Source: GitHub Actions**.
3. Configura los secrets y la variable anteriores.
4. Push a `main` o ejecuta el workflow **Deploy to GitHub Pages**.
5. Verifica `https://andreschapid-u.github.io/red-adopcion/`.

El workflow `.github/workflows/deploy.yml` compila y publica. El cron se pausa tras 60 días sin actividad; un push o un run manual lo reactiva.

## SEO y validación

Antes de dar por bueno un cambio:

- [ ] `sitemap-index.xml` y `sitemap-0.xml` incluyen todas las fichas (sin 404).
- [ ] `robots.txt` apunta al sitemap.
- [ ] Cada ficha tiene `<title>`, description, canonical, OG y Twitter únicos.
- [ ] JSON-LD válido (BreadcrumbList + WebPage + Pet).
- [ ] [Rich Results Test](https://search.google.com/test/rich-results) sin errores.
- [ ] [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) con re-scrape.
- [ ] [X Card Validator](https://cards-dev.twitter.com/validator).
- [ ] Vista previa de WhatsApp en móvil.
- [ ] Lighthouse móvil: SEO 100, Performance ≥ 90, Accessibility ≥ 95.
- [ ] Playwright: navegación, filtros, atrás/adelante, 404, compartir y consola sin errores.

Los filtros usan query params pero el canonical de `/catalogo/` es fijo para no indexar combinaciones.

## Estructura

```
src/
  lib/                     URLs, esquema Zod, datos, imágenes, utils
  components/              Header, Footer, PetCard, FoundationCard, ShareDialog, Seo
  layouts/Base.astro
  pages/
    index.astro
    catalogo.astro         filtros + paginación para 1000+
    fundaciones.astro
    mascotas.astro         índice alfabético (crawlabilidad)
    mascota/[id].astro     ficha + OG + JSON-LD + compartir
    404.astro
  styles/global.css
scripts/
  fetch-data.ts            OAuth + scripts.run + Zod + JSON
  auth.ts                  refresh token por loopback
fixtures/                  datos de ejemplo (solo desarrollo)
public/                    favicon, placeholder, og-default.png, robots.txt
```

## Rollback

- **Web:** revierte el commit en `red-adopcion`; Pages redespliega el build anterior.
- **Datos:** la API es de solo lectura; la hoja no se modifica.
- **API:** `clasp deploy -i <deploymentId> -V <versión anterior>`.

## Notas

- El subdirectorio `/red-adopcion` se configura con `base` en `astro.config.mjs`. Todas las rutas internas usan `withBase()`; no escribas enlaces absolutos a mano.
- `src/data/` está en `.gitignore`: los datos se generan en cada build.
- `public/.nojekyll` evita que Pages ignore archivos que empiezan por `_`.
- Instagram no ofrece intent web de compartir; el modal usa Web Share o copia el enlace y abre Instagram.
