import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import {
  getNode,
  getProject,
  getTreeOutline,
  listMetrics,
  listNodeChildren,
  listPolicies,
  listProjects,
  listTopLevelNodes,
  searchNodes,
  validateProject,
} from './mcpData.js';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function apiBaseUrl() {
  return (process.env.GBI_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function jsonText(value) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

async function fetchProjects() {
  const url = `${apiBaseUrl()}/api/projects`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} falló con HTTP ${response.status}`);
  }
  return response.json();
}

async function withProject(projectId, callback) {
  const payload = await fetchProjects();
  const project = getProject(payload, projectId);
  return callback(project, payload);
}

const server = new McpServer({
  name: 'gbi-creator',
  version: '0.1.0',
});

server.registerTool('gbi_get_projects_json', {
  description: 'Devuelve el JSON completo de GET /api/projects tal como lo expone GBICreator.',
  inputSchema: {},
}, async () => jsonText(await fetchProjects()));

server.registerTool('gbi_list_projects', {
  description: 'Lista proyectos disponibles con metadatos y conteos de nodos de primer nivel.',
  inputSchema: {},
}, async () => jsonText(listProjects(await fetchProjects())));

server.registerTool('gbi_list_top_level_nodes', {
  description: 'Lista los nodos de primer nivel de un proyecto. Si no se indica projectId usa el proyecto actual.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
    includeLoose: z.boolean().optional().default(true).describe('Incluye nodos sueltos además de hijos del root.'),
  },
}, async ({ projectId, includeLoose }) => withProject(projectId, (project) => jsonText(listTopLevelNodes(project, { includeLoose }))));

server.registerTool('gbi_list_node_children', {
  description: 'Lista los hijos directos de un nodo por id dentro de un proyecto.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
    nodeId: z.string().describe('Id del nodo padre. Para el root normalmente es "root".'),
  },
}, async ({ projectId, nodeId }) => withProject(projectId, (project) => jsonText(listNodeChildren(project, nodeId))));

server.registerTool('gbi_get_node', {
  description: 'Devuelve un nodo completo por id, incluyendo su ruta dentro del árbol.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
    nodeId: z.string().describe('Id del nodo a recuperar.'),
  },
}, async ({ projectId, nodeId }) => withProject(projectId, (project) => jsonText(getNode(project, nodeId))));

server.registerTool('gbi_search_nodes', {
  description: 'Busca nodos por texto en título, pregunta, intención, políticas y métricas.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
    query: z.string().describe('Texto a buscar.'),
    limit: z.number().int().positive().max(100).optional().default(20).describe('Máximo de resultados.'),
  },
}, async ({ projectId, query, limit }) => withProject(projectId, (project) => jsonText(searchNodes(project, { query, limit }))));

server.registerTool('gbi_get_tree_outline', {
  description: 'Devuelve un outline jerárquico resumido del árbol completo.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
    includeLoose: z.boolean().optional().default(true).describe('Incluye nodos sueltos además de hijos del root.'),
  },
}, async ({ projectId, includeLoose }) => withProject(projectId, (project) => jsonText(getTreeOutline(project, { includeLoose }))));

server.registerTool('gbi_list_policies', {
  description: 'Lista todas las políticas del proyecto indicando nodo y ruta de origen.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
  },
}, async ({ projectId }) => withProject(projectId, (project) => jsonText(listPolicies(project))));

server.registerTool('gbi_list_metrics', {
  description: 'Lista métricas de valor/control e indica su política de origen si existe.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
  },
}, async ({ projectId }) => withProject(projectId, (project) => jsonText(listMetrics(project))));

server.registerTool('gbi_validate_project', {
  description: 'Valida inconsistencias básicas: ids duplicados, hijos inválidos y métricas con origen roto o huérfanas.',
  inputSchema: {
    projectId: z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.'),
  },
}, async ({ projectId }) => withProject(projectId, (project) => jsonText(validateProject(project))));

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
