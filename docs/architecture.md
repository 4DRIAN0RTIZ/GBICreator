# Arquitectura — Qué significa "hacer un buen trabajo"

> Este documento define el estándar de calidad. Los agentes revisores
> evalúan código contra este archivo. Si no está aquí, no es un requisito.

## Principios

1. **Capas claras.** El proyecto tiene estas capas:
   - `src/domain/` — modelo de dominio puro (árbol de nodos, proyecto). Sin
     React, sin `localStorage`, sin efectos secundarios de IO.
   - `src/hooks/` — estado de React + persistencia (`useProjects`,
     `useCategories`, `useTreeEditor`, etc.). Consume `domain/` y `lib/`.
   - `src/components/` — UI. Consume hooks, no accede a `localStorage` ni a
     `domain/` directamente para persistir.
   - `src/lib/` — utilidades transversales (`storage.js`, export a
     xlsx/png, color). No contiene lógica de dominio ni JSX.
   No introducir capas adicionales (p. ej. un backend) hasta que haya una
   razón concreta documentada en `feature_list.json` — la feature 1
   (`sql_shared_persistence`) es exactamente ese caso: agrega una capa de
   servidor porque el requisito de "compartir entre usuarios" no se puede
   cumplir con almacenamiento client-only.

2. **Backend solo cuando una feature lo pide explícitamente.** GBICreator
   ahora corre con un servidor Node/Express porque la feature 1
   (`sql_shared_persistence`) necesita datos compartidos entre usuarios. El
   backend sirve la API `/api/*`, entrega el `dist/` de Vite en producción y
   persiste en SQLite (`GBI_DATABASE_PATH`, por defecto `data/gbi-creator.sqlite`).

3. **Errores explícitos.** Los `useEffect` de autoguardado comunican fallos
   vía `setSaveStatus` (ver `useProjects.js`, `useCategories.js`), nunca los
   tragan en silencio.

4. **Normalización de datos cargados.** Todo dato que entra desde afuera
   (localStorage hoy, backend en el futuro, o un archivo `.json` importado)
   pasa por `normalizeLoadedData` / `normalizeNode` (`src/domain/tree.js`)
   antes de usarse, para tolerar versiones antiguas del esquema.

## Flujo de datos (estado actual)

```
usuario  ─→  componentes (src/components/)
              │
              ├─ hooks (useProjects, useCategories) mutan estado de React
              │
              └─→  useEffect de autoguardado ─→ fetch() a la API del backend
                       │
                       └─→  Express (server/) ─→ SQLite (better-sqlite3)
```

En desarrollo, Vite proxya `/api` a `http://localhost:3000`; levanta el
frontend con `npm run dev` y el backend con `npm run dev:server`. En Docker,
`node server/index.js` sirve tanto la API como los archivos estáticos.

El servidor MCP (`npm run mcp`) es una capa read-only separada que consume la
API HTTP existente (`GBI_API_BASE_URL`, por defecto `http://localhost:3000`) y
expone herramientas de navegación para agentes. No escribe en SQLite ni cambia
el contrato REST; ver `docs/mcp.md`.

La única lectura permitida de `localStorage` queda acotada a la migración
legada: si el backend está vacío y existen claves `gbi-creator-*-v1`, los hooks
ofrecen importarlas una vez a la base compartida.

## Qué NO hacer

- No mezclar IO de persistencia con lógica de dominio dentro de
  `src/domain/`.
- No acceder a `localStorage` (ni, tras la feature 1, a `fetch`) desde
  `src/components/` directamente — siempre a través de un hook.
- No añadir un sistema de configuración nuevo para la URL del backend sin
  documentarlo aquí.
