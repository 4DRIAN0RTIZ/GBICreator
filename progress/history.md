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
