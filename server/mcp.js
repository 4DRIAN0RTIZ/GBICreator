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
import {
  addMetric,
  addNode,
  addPolicy,
  createProject,
  deleteMetric,
  deleteNode,
  deletePolicy,
  moveNode,
  mutateProjectIn,
  runMutation,
  updateMetric,
  updateNode,
  updatePolicy,
  updateRoot,
} from './mcpMutations.js';
import {
  accessLevel,
  assertCanWriteAll,
  filterProjectsPayload,
  filterSnapshot,
  filterSnapshotList,
  parseProjectAccess,
  resolveProjectId,
} from './mcpAccess.js';

// Guardarraíl opcional de alcance por proyecto (no es seguridad; ver mcpAccess.js).
const projectAccess = parseProjectAccess(process.env.GBI_MCP_PROJECTS);

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

async function requestJson(path, options = {}) {
  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const error = new Error(`${options.method || 'GET'} ${url} falló con HTTP ${response.status}${details.error ? `: ${details.error}` : ''}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// Estado completo: solo para read-modify-write. El PUT reemplaza todos los
// proyectos, así que filtrar aquí borraría los que quedan fuera de alcance.
function fetchAllProjects() {
  return requestJson('/api/projects');
}

// Vista de lectura recortada al alcance de GBI_MCP_PROJECTS.
async function fetchProjects() {
  return filterProjectsPayload(await fetchAllProjects(), projectAccess);
}

function saveProjects(payload) {
  return requestJson('/api/projects', { method: 'PUT', body: JSON.stringify(payload) });
}

async function writeProject(projectId, mutation, args) {
  return jsonText(await runMutation({
    fetchProjects: fetchAllProjects,
    saveProjects,
    mutator: (draft) => mutateProjectIn(draft, resolveProjectId(draft, projectId, projectAccess, { write: true }), mutation, args),
  }));
}

async function withProject(projectId, callback) {
  const all = await fetchAllProjects();
  const payload = filterProjectsPayload(all, projectAccess);
  const project = getProject(payload, resolveProjectId(all, projectId, projectAccess));
  return callback(project, payload);
}

const server = new McpServer({
  name: 'gbi-creator',
  version: '0.2.0',
});

server.registerTool('gbi_get_projects_json', {
  description: 'Devuelve el JSON completo de GET /api/projects tal como lo expone GBICreator.',
  inputSchema: {},
}, async () => jsonText(await fetchProjects()));

server.registerTool('gbi_list_projects', {
  description: 'Lista proyectos disponibles con metadatos y conteos de nodos de primer nivel.',
  inputSchema: {},
}, async () => {
  const summary = listProjects(await fetchProjects());
  return jsonText({
    ...summary,
    projects: summary.projects.map((project) => ({ ...project, access: accessLevel(projectAccess, project.id) })),
  });
});

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

// Escritura: activa por defecto; GBI_MCP_READONLY=1 deja el MCP solo lectura.
const writesEnabled = !['1', 'true'].includes(String(process.env.GBI_MCP_READONLY || '').toLowerCase());

const projectIdInput = z.string().optional().describe('Id del proyecto. Opcional: usa currentProjectId o el primer proyecto.');
const metricTypeInput = z.enum(['valor', 'control']);
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };
const destructiveAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false };

server.registerTool('gbi_list_snapshots', {
  description: 'Lista los snapshots automáticos de proyectos (respaldo previo a escrituras), del más reciente al más antiguo.',
  inputSchema: {},
}, async () => jsonText(filterSnapshotList(await requestJson('/api/projects/snapshots'), projectAccess)));

server.registerTool('gbi_get_snapshot', {
  description: 'Devuelve el contenido completo de un snapshot de proyectos por id.',
  inputSchema: {
    snapshotId: z.number().int().positive().describe('Id del snapshot (ver gbi_list_snapshots).'),
  },
}, async ({ snapshotId }) => jsonText(filterSnapshot(await requestJson(`/api/projects/snapshots/${snapshotId}`), projectAccess)));

if (writesEnabled) {
  server.registerTool('gbi_update_root', {
    description: 'Edita la Aplicación de valor Superior y/o la Intención superior del root de un proyecto.',
    inputSchema: {
      projectId: projectIdInput,
      aplicacionValorSuperior: z.string().optional(),
      intencionSuperior: z.string().optional(),
    },
    annotations: writeAnnotations,
  }, async ({ projectId, ...patch }) => writeProject(projectId, updateRoot, patch));

  server.registerTool('gbi_update_node', {
    description: 'Edita campos de un nodo de valor: titulo (Aplicación de valor), pregunta, intencionSubyacente y categoriaId. Solo cambia los campos enviados.',
    inputSchema: {
      projectId: projectIdInput,
      nodeId: z.string(),
      titulo: z.string().optional(),
      pregunta: z.string().optional(),
      intencionSubyacente: z.string().optional(),
      categoriaId: z.string().nullable().optional().describe('Id de categoría o null para quitarla.'),
    },
    annotations: writeAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, updateNode, args));

  server.registerTool('gbi_add_node', {
    description: 'Agrega un nodo de valor como hijo de parentId ("root" para primer nivel) o como nodo suelto (loose: true).',
    inputSchema: {
      projectId: projectIdInput,
      parentId: z.string().optional().describe('Id del nodo padre. Requerido salvo que loose sea true.'),
      loose: z.boolean().optional().default(false),
      index: z.number().int().min(0).optional().describe('Posición entre hermanos. Por defecto al final.'),
      titulo: z.string().describe('Aplicación de valor del nodo.'),
      pregunta: z.string().optional(),
      intencionSubyacente: z.string().optional(),
      categoriaId: z.string().nullable().optional(),
    },
    annotations: writeAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, addNode, args));

  server.registerTool('gbi_move_node', {
    description: 'Mueve un nodo (con sus descendientes) bajo otro padre, a otra posición o a sueltos (loose: true).',
    inputSchema: {
      projectId: projectIdInput,
      nodeId: z.string(),
      parentId: z.string().optional(),
      loose: z.boolean().optional().default(false),
      index: z.number().int().min(0).optional(),
    },
    annotations: writeAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, moveNode, args));

  server.registerTool('gbi_delete_node', {
    description: 'Borra un nodo y TODOS sus descendientes. Queda respaldo en snapshots.',
    inputSchema: { projectId: projectIdInput, nodeId: z.string() },
    annotations: destructiveAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, deleteNode, args));

  server.registerTool('gbi_add_policy', {
    description: 'Agrega una política a un nodo de valor.',
    inputSchema: { projectId: projectIdInput, nodeId: z.string(), texto: z.string() },
    annotations: writeAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, addPolicy, args));

  server.registerTool('gbi_update_policy', {
    description: 'Edita el texto de una política.',
    inputSchema: { projectId: projectIdInput, nodeId: z.string(), policyId: z.string(), texto: z.string() },
    annotations: writeAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, updatePolicy, args));

  server.registerTool('gbi_delete_policy', {
    description: 'Borra una política. Sus métricas se reasignan a la primera política restante o se eliminan si no queda ninguna.',
    inputSchema: { projectId: projectIdInput, nodeId: z.string(), policyId: z.string() },
    annotations: destructiveAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, deletePolicy, args));

  server.registerTool('gbi_add_metric', {
    description: 'Agrega una métrica de valor o control a un nodo. Debe apuntar a una política existente del mismo nodo.',
    inputSchema: {
      projectId: projectIdInput,
      nodeId: z.string(),
      type: metricTypeInput,
      texto: z.string(),
      origenPoliticaId: z.string(),
    },
    annotations: writeAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, addMetric, args));

  server.registerTool('gbi_update_metric', {
    description: 'Edita texto, política de origen y/o tipo (valor/control) de una métrica.',
    inputSchema: {
      projectId: projectIdInput,
      nodeId: z.string(),
      metricId: z.string(),
      texto: z.string().optional(),
      origenPoliticaId: z.string().optional(),
      type: metricTypeInput.optional(),
    },
    annotations: writeAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, updateMetric, args));

  server.registerTool('gbi_delete_metric', {
    description: 'Borra una métrica de un nodo.',
    inputSchema: { projectId: projectIdInput, nodeId: z.string(), metricId: z.string() },
    annotations: destructiveAnnotations,
  }, async ({ projectId, ...args }) => writeProject(projectId, deleteMetric, args));

  server.registerTool('gbi_create_project', {
    description: 'Crea un proyecto vacío. No cambia el proyecto actual salvo makeCurrent: true.',
    inputSchema: {
      name: z.string(),
      aplicacionValorSuperior: z.string().optional(),
      intencionSuperior: z.string().optional(),
      makeCurrent: z.boolean().optional().default(false),
    },
    annotations: writeAnnotations,
  }, async (args) => {
    assertCanWriteAll(projectAccess, 'Crear proyectos');
    return jsonText(await runMutation({
      fetchProjects: fetchAllProjects,
      saveProjects,
      mutator: (draft) => createProject(draft, args),
    }));
  });

  server.registerTool('gbi_restore_snapshot', {
    description: 'Restaura TODOS los proyectos al estado de un snapshot. El estado actual se respalda antes en otro snapshot.',
    inputSchema: {
      snapshotId: z.number().int().positive().describe('Id del snapshot (ver gbi_list_snapshots).'),
    },
    annotations: destructiveAnnotations,
  }, async ({ snapshotId }) => {
    assertCanWriteAll(projectAccess, 'Restaurar snapshots');
    const restored = await requestJson(`/api/projects/snapshots/${snapshotId}/restore`, { method: 'POST' });
    return jsonText(listProjects(filterProjectsPayload(restored, projectAccess)));
  });
}

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
