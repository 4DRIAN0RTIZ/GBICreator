# Bitácora histórica (append-only)

> Cada vez que se cierra una sesión, su resumen se añade aquí.
> No edites entradas anteriores. Solo añades al final.

---

## 2026-09-14 — Bootstrap del arnés (portado desde harness-sample)
- **Agente:** Claude Sonnet 5, a pedido del usuario.
- **Cambios:** se portó el andamiaje de Harness Engineering desde
  `~/harness-sample` (proyecto Python) adaptado al stack real de
  GBICreator (React + Vite + npm): `AGENTS.md`, `init.sh`, `docs/`,
  `CHECKPOINTS.md`, `.claude/agents/{leader,implementer,reviewer}.md`,
  `progress/`. Se agregó Vitest como framework de tests (no existía
  ninguno previamente) con un smoke test en `src/domain/tree.test.js`.
  Se registró en `feature_list.json` la feature 1
  (`sql_shared_persistence`): migrar la persistencia de localStorage a un
  backend Node/Express + SQLite compartido, con status `pending`.
- **Verificación:** `./init.sh` verde (node/npm detectados, 7 archivos
  base del arnés presentes, `feature_list.json` válido con 1 feature en
  `pending`, `npm test` pasa).
- **Cierre:** ningún feature marcada `done` todavía — la implementación de
  `sql_shared_persistence` queda para una sesión futura siguiendo el
  protocolo del arnés (`implementer` → `reviewer`).

---

## 2026-09-14 — Feature #1 `sql_shared_persistence`
- **Agente:** pi.
- **Cambios:** se implementó persistencia compartida con backend Node/Express y SQLite (`server/`), endpoints `/api/projects` y `/api/categories` con GET/PUT/POST, capa `src/lib/storage.js` vía `fetch()`, hooks `useProjects`/`useCategories` con carga async, autoguardado async y mensajes explícitos de error vía `setSaveStatus`.
- **Migración:** si el backend está vacío y existen claves legadas `gbi-creator-*-v1` en `localStorage`, la UI ofrece importarlas una vez a la base compartida.
- **Infra:** se añadieron `better-sqlite3`, `express`, `supertest`, scripts `dev:server`/`start`, `vite.config.js` con proxy `/api`, y Docker pasó a runtime Node con volumen persistente `/app/data` para `gbi-creator.sqlite`.
- **Docs:** actualizados `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md` y `CHECKPOINTS.md` para reflejar el backend actual y la verificación con servidor.
- **Tests:** añadidos `server/app.test.js` y `src/lib/storage.test.js`.
- **Verificación:** `npm test` verde (3 archivos, 9 tests), `npm run build` verde, `./init.sh` verde.
- **Cierre:** feature #1 marcada `done` en `feature_list.json`.
