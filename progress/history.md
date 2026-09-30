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

---

# Sesión actual

> Este archivo se vacía al cerrar cada sesión y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** readonly_mcp_navigation
- **Inicio:** 2026-09-18 12:24
- **Agente:** Pi

## Plan

- Mantener el MCP como capa read-only separada, sin mezclarlo con dominio React ni cambiar la API REST actual.
- Consumir `/api/projects` desde el MCP mediante una URL configurable por entorno.
- Extraer helpers testeables para navegar proyectos, root, nodos de primer nivel, hijos y nodos sueltos.
- Agregar script npm, documentación mínima y tests.
- Verificar con `npm test`, `npm run build` y `./init.sh`.

## Bitácora

- `./init.sh` terminó verde antes de tocar código.
- No había features pending; se creó la feature `readonly_mcp_navigation` a partir de la petición del usuario y se marcó `in_progress`.
- Decisión: MCP inicial será solo lectura porque la API actual ya expone lectura/escritura agregada, pero el usuario pidió navegación/listado y no está definido aún editar/subir JSON completo.
- Se agregó `@modelcontextprotocol/sdk` y `zod`.
- Se creó `server/mcpData.js` con helpers testeables para resumir proyectos, listar primer nivel, recorrer hijos y obtener nodos por id.
- Se creó `server/mcp.js` como servidor MCP stdio con herramientas `gbi_get_projects_json`, `gbi_list_projects`, `gbi_list_top_level_nodes`, `gbi_list_node_children` y `gbi_get_node`.
- Se documentó la configuración en `docs/mcp.md` y se agregó el script `npm run mcp`.
- `npm test` pasó: 4 archivos, 14 tests.
- `npm run build` pasó; Vite mantiene la advertencia existente de chunk grande.
- `timeout 2s npm run mcp` arrancó el servidor stdio sin errores de carga.
- `./init.sh` final pasó completo en verde.
- Se marcó `readonly_mcp_navigation` como `done` en `feature_list.json`.

## Próximo paso

Sesión lista para archivar.

---

# Sesión actual

> Este archivo se vacía al cerrar cada sesión y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** readonly_mcp_analysis_tools
- **Inicio:** 2026-09-18 12:34
- **Agente:** Pi

## Plan

- Extender el MCP read-only sin agregar escritura ni cambiar la API REST.
- Reusar `server/mcpData.js` para implementar búsqueda, outline, políticas, métricas y validación.
- Registrar las nuevas tools en `server/mcp.js`.
- Cubrir helpers con tests unitarios y documentar en `docs/mcp.md`.
- Verificar con `npm test`, `npm run build` y `./init.sh`.

## Bitácora

- `./init.sh` inicial terminó verde.
- No había features pending; se creó `readonly_mcp_analysis_tools` y se marcó `in_progress`.
- Se extendió `server/mcpData.js` con helpers para `searchNodes`, `getTreeOutline`, `listPolicies`, `listMetrics` y `validateProject`.
- Se registraron las tools MCP `gbi_search_nodes`, `gbi_get_tree_outline`, `gbi_list_policies`, `gbi_list_metrics` y `gbi_validate_project`.
- Se ampliaron tests de `server/mcpData.test.js`; `npm test` pasó con 4 archivos y 19 tests.
- Se actualizó `docs/mcp.md` con las nuevas tools.
- `npm run build` pasó; Vite mantiene la advertencia conocida de chunk grande.
- `timeout 2s npm run mcp` arrancó el servidor stdio sin errores de carga.
- `./init.sh` final pasó completo en verde.
- Se marcó `readonly_mcp_analysis_tools` como `done` en `feature_list.json`.

## Próximo paso

Sesión lista para archivar.

---

## 2026-09-30 — Features #4–#7: carga segura, sincronización, snapshots y escritura MCP
- **Agente:** Claude Opus 5.5, a pedido del usuario (perdió cambios y pidió escritura en el MCP).
- **Diagnóstico:** (1) si la carga inicial fallaba, los hooks marcaban `hasLoaded` y el autoguardado hacía PUT del proyecto de ejemplo, borrando la base (el PUT reemplaza todo); (2) la UI nunca releía del backend: last-write-wins entre pestañas/personas.
- **#4 `safe_initial_load`:** `src/lib/syncController.js` bloquea el autoguardado hasta cargar bien y reintenta cada 5 s.
- **#5 `optimistic_revision_sync`:** `projectsRevision`/`categoriesRevision` en `metadata`; PUT exige `baseRevision` (409 + `current`); PUT idéntico = no-op. `GET /api/{projects,categories}/revision`. Un guardado en vuelo a la vez, `useRemotePolling` (5 s + focus), `SyncConflictBanner` (recargar / sobrescribir). La UI conserva el proyecto abierto al recibir cambios remotos.
- **#6 `project_snapshots`:** tabla `project_snapshots`; snapshot previo por intervalo (5 min), por proyecto eliminado o por reducción >30 %; retención 100; listar/ver/restaurar. `GBI_SNAPSHOT_INTERVAL_MS`, `GBI_SNAPSHOT_LIMIT`.
- **#7 `mcp_write_tools`:** `server/mcpMutations.js` (reutiliza `src/domain/tree.js`) + 13 herramientas de escritura y 2 de snapshots en `server/mcp.js`; `runMutation` reintenta ante 409. `GBI_MCP_READONLY=1` las desactiva.
- **Compatibilidad:** sin migraciones destructivas; test con una base de esquema viejo confirma datos intactos. Pestañas abiertas con el bundle anterior reciben 409 y no pueden pisar datos: hay que recargarlas tras el deploy.
- **Verificación:** `./init.sh` verde, 66/66 tests. E2E del MCP por stdio contra API temporal (agregar nodo/política/métrica, validación, borrar → snapshot `large_shrink`, restaurar). `npm run build` NO ejecutado por regla del usuario; JSX validado con `transformWithOxc`.

---

## 2026-09-30 — Feature #8 `crystal_alert_dialogs`
- **Agente:** Claude Opus 5.5, a pedido del usuario (opción C: vendorizar).
- **Hallazgos:** `crystal-alert` no existe en npm (404) y `src/crystal-alert.js` (main y v1.1.6) no exporta `Crystal`: como ES module queda inaccesible. Sin soporte de input. Singleton sin cola: un segundo `fire()` deja colgada la promesa del primero (pasaría con las dos confirmaciones de importación legada al arrancar).
- **Cambios:** vendor v1.1.6 (commit c5472b1) en `src/lib/vendor/crystal-alert/` + `export default Crystal`. Adaptador `src/lib/dialogs.js` (`showAlert`, `showConfirm`, `showPrompt`) con cola; prompt mediante `html` + `<input class="ca-input">`, valor inicial por DOM y Enter para confirmar. Reemplazados los 13 usos nativos (App, useProjects, useCategories, useTreeEditor, useConnectModal); `shouldImportLegacy` ahora puede ser async. El Escape global de App corre en captura y se ignora si hay un diálogo de CrystalAlert abierto. Convención en `docs/conventions.md`.
- **Verificación:** `./init.sh` verde, 73/73 tests. JSX validado con `transformWithOxc`; build y prueba en navegador no ejecutados.

---

## 2026-09-30 — Feature #9 `mcp_project_access_guardrail`
- **Agente:** Claude Opus 5.5, a pedido del usuario (opción A: guardarraíl, no seguridad).
- **Cambios:** `server/mcpAccess.js` (+ tests) parsea `GBI_MCP_PROJECTS` (`<id>:r|rw`, comodín `*`), filtra la vista de lectura, resuelve el proyecto objetivo con errores explícitos (fuera de alcance / solo lectura / inexistente) y recorta snapshots. En `server/mcp.js`: lecturas con vista filtrada; escrituras con `fetchAllProjects` (payload completo); `gbi_create_project` y `gbi_restore_snapshot` exigen `*:rw` o sin restricción; `gbi_list_projects` expone `access`.
- **Bug evitado:** al introducir el filtro, `gbi_create_project` quedó usando la vista filtrada, lo que habría borrado los proyectos fuera de alcance vía PUT. Corregido y agregada una red de seguridad en `runMutation` (`assertNoProjectLost`): aborta si el borrador pierde algún proyecto.
- **Verificación:** `./init.sh` verde. E2E con `itam:rw`: solo ve ITAM, edita ITAM, bloquea IPTM y la creación; IPTM intacto en BD.
