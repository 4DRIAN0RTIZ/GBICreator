# MCP de GBICreator

GBICreator incluye un servidor MCP read-only para navegar proyectos desde agentes compatibles con Model Context Protocol.

## Ejecutar

```bash
GBI_API_BASE_URL=http://10.100.1.176:8081 npm run mcp
```

Si no defines `GBI_API_BASE_URL`, usa `http://localhost:3000`.

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

## Herramientas

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

El MCP no edita ni sube JSON completo todavía. Esa parte queda fuera hasta definir una API de escritura granular o un contrato de importación seguro.
