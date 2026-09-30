# MCP de GBICreator

GBICreator incluye un servidor MCP para navegar y editar proyectos desde agentes compatibles con Model Context Protocol.

## Ejecutar

```bash
GBI_API_BASE_URL=http://10.100.1.176:8081 npm run mcp
```

Si no defines `GBI_API_BASE_URL`, usa `http://localhost:3000`.

Con `GBI_MCP_READONLY=1` el MCP no registra las herramientas de escritura.

### Alcance por proyecto (`GBI_MCP_PROJECTS`)

Limita qué proyectos ve y edita el agente. Son entradas `<projectId>:r` (lectura) o `<projectId>:rw` (edición) separadas por coma; `*` aplica a los proyectos no listados. Sin la variable no hay restricción.

```json
"env": {
  "GBI_API_BASE_URL": "http://10.100.1.176:8081",
  "GBI_MCP_PROJECTS": "<id-itam>:rw,<id-iptm>:r"
}
```

- Las herramientas de lectura solo ven proyectos accesibles. `gbi_list_projects` indica el `access` de cada uno.
- Sin `projectId`, se usa el proyecto actual si está en alcance; si no, el primero accesible.
- Las escrituras solo proceden en proyectos `rw`. Internamente siguen leyendo y guardando **todos** los proyectos, porque el `PUT` reemplaza el conjunto completo, y abortan si el guardado fuera a perder algún proyecto.
- `gbi_create_project` y `gbi_restore_snapshot` requieren acceso sin restricción o `*:rw`. Los snapshots se muestran recortados a los proyectos legibles.

> ⚠️ **Es un guardarraíl, no seguridad.** Evita que un agente toque el proyecto equivocado, pero la API HTTP no tiene autenticación: cualquiera puede quitar la variable, usar la UI o llamar a la API directamente. Para aislar personas hace falta autenticación en el backend (llaves por proyecto en la API y en la UI).

Ejemplo de configuración stdio:

```json
{
  "mcpServers": {
    "gbi-creator": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/home/ditr4drian/GBICreator",
      "env": {
        "GBI_API_BASE_URL": "http://10.100.1.176:8081"
      }
    }
  }
}
```

## Herramientas de lectura

- `gbi_get_projects_json`: devuelve el JSON completo de `GET /api/projects`.
- `gbi_list_projects`: lista proyectos con id, nombre, fecha y conteos.
- `gbi_list_top_level_nodes`: lista los nodos de primer nivel del proyecto actual o de un `projectId` dado. Puede incluir `sueltos`.
- `gbi_list_node_children`: lista los hijos directos de un nodo por `nodeId`.
- `gbi_get_node`: devuelve un nodo completo por `nodeId` y su ruta.
- `gbi_search_nodes`: busca texto en título, pregunta, intención, políticas y métricas.
- `gbi_get_tree_outline`: devuelve el árbol completo como outline resumido con profundidad, ruta y conteos.
- `gbi_list_policies`: lista políticas con el nodo y la ruta donde viven.
- `gbi_list_metrics`: lista métricas de valor/control con su política de origen resuelta cuando existe.
- `gbi_validate_project`: detecta inconsistencias básicas como ids duplicados, hijos inválidos, políticas sin id/texto y métricas huérfanas o con origen roto.

- `gbi_list_snapshots`: lista los snapshots automáticos de proyectos.
- `gbi_get_snapshot`: devuelve el contenido completo de un snapshot.

## Herramientas de escritura

Todas aceptan `projectId` opcional (por defecto el proyecto actual) y devuelven el resultado más la `revision` nueva.

- `gbi_update_root`: edita `aplicacionValorSuperior` / `intencionSuperior`.
- `gbi_update_node`: edita `titulo`, `pregunta`, `intencionSubyacente`, `categoriaId` (solo los campos enviados).
- `gbi_add_node`: agrega un nodo bajo `parentId` (`"root"` para primer nivel) o como suelto (`loose: true`), con `index` opcional.
- `gbi_move_node`: mueve un nodo con sus descendientes; impide moverlo dentro de sí mismo.
- `gbi_delete_node`: borra un nodo y sus descendientes.
- `gbi_add_policy`, `gbi_update_policy`, `gbi_delete_policy`: al borrar, las métricas se reasignan a la primera política restante o se eliminan si no queda ninguna (misma regla que la UI).
- `gbi_add_metric`, `gbi_update_metric`, `gbi_delete_metric`: `type` es `valor` o `control`; `origenPoliticaId` debe existir en el mismo nodo.
- `gbi_create_project`: crea un proyecto vacío.
- `gbi_restore_snapshot`: restaura todos los proyectos a un snapshot (respaldando antes el estado actual).

## Concurrencia y respaldo

La API guarda el conjunto completo de proyectos en cada `PUT`, así que las escrituras usan control de concurrencia optimista:

- `GET /api/projects` devuelve `revision`, y `GET /api/projects/revision` solo la revisión.
- `PUT /api/projects` exige `baseRevision`. Si no coincide con la vigente (o falta), responde **409** con `current` (el estado vigente) y no escribe nada. Un `PUT` idéntico a lo almacenado no cambia la revisión.
- El MCP hace read-modify-write con `baseRevision` y reintenta hasta 3 veces ante un 409, reaplicando la mutación sobre el estado nuevo.
- La UI consulta la revisión cada 5 s y al volver a la pestaña. Recarga sola si no tiene cambios pendientes; si choca, muestra un aviso para recargar o sobrescribir sin perder lo local.
- Categorías siguen el mismo esquema en `/api/categories` y `/api/categories/revision`.

Antes de reemplazar proyectos, el backend guarda un snapshot en `project_snapshots` si pasaron `GBI_SNAPSHOT_INTERVAL_MS` (5 min por defecto) desde el último, si se elimina algún proyecto o si el contenido se reduce más de 30 %. Se conservan los últimos `GBI_SNAPSHOT_LIMIT` (100). Endpoints:

- `GET /api/projects/snapshots`
- `GET /api/projects/snapshots/:id`
- `POST /api/projects/snapshots/:id/restore`
