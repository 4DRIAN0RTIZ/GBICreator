import { detachNodeById, findNode, makeBlankNode, makeMetric, makePolicy, removePolicyFromNode } from '../src/domain/tree.js';
import { makeProject } from '../src/domain/project.js';
import { getProject, summarizeNode, summarizeProject } from './mcpData.js';

const METRIC_LISTS = {
  valor: 'metricasValor',
  control: 'metricasControl',
};

const NODE_TEXT_FIELDS = ['titulo', 'pregunta', 'intencionSubyacente'];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickDefined(source, fields) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function requireNode(project, nodeId) {
  const node = findNode(project.data, nodeId);
  if (!node) throw new Error(`No existe un nodo con id ${nodeId}`);
  return node;
}

function requireValueNode(project, nodeId) {
  const node = requireNode(project, nodeId);
  if (node.isRoot) throw new Error('El root no admite políticas ni métricas; usa un nodo de valor');
  node.politicas = asArray(node.politicas);
  node.metricasValor = asArray(node.metricasValor);
  node.metricasControl = asArray(node.metricasControl);
  return node;
}

function requirePolicy(node, policyId) {
  const policy = node.politicas.find((item) => item.id === policyId);
  if (!policy) throw new Error(`El nodo ${node.id} no tiene la política ${policyId}`);
  return policy;
}

function requireText(value, field) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${field} no puede estar vacío`);
  return text;
}

function findMetric(node, metricId) {
  for (const [type, field] of Object.entries(METRIC_LISTS)) {
    const index = node[field].findIndex((metric) => metric.id === metricId);
    if (index !== -1) return { type, field, index, metric: node[field][index] };
  }
  throw new Error(`El nodo ${node.id} no tiene la métrica ${metricId}`);
}

function containsNode(node, nodeId) {
  if (node.id === nodeId) return true;
  return asArray(node.hijos).some((child) => containsNode(child, nodeId));
}

// Devuelve la lista donde se inserta un nodo: hijos de `parentId` o `sueltos`.
function targetList(project, { parentId, loose }) {
  if (loose) {
    project.data.sueltos = asArray(project.data.sueltos);
    return project.data.sueltos;
  }
  if (!parentId) throw new Error('Indica parentId (usa "root" para el primer nivel) o loose: true');
  const parent = requireNode(project, parentId);
  parent.hijos = asArray(parent.hijos);
  return parent.hijos;
}

function insertAt(list, item, index) {
  const position = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
  list.splice(position, 0, item);
  return position;
}

export function updateRoot(project, patch) {
  const changes = pickDefined(patch, ['aplicacionValorSuperior', 'intencionSuperior']);
  if (!Object.keys(changes).length) throw new Error('No hay campos para actualizar');
  Object.assign(project.data, changes);
  return { root: summarizeNode({ ...project.data, isRoot: true }) };
}

export function updateNode(project, { nodeId, ...patch }) {
  const node = requireNode(project, nodeId);
  if (node.isRoot) throw new Error('Para editar el root usa la herramienta de root');
  const changes = pickDefined(patch, [...NODE_TEXT_FIELDS, 'categoriaId']);
  if (!Object.keys(changes).length) throw new Error('No hay campos para actualizar');
  if (changes.titulo !== undefined) changes.titulo = requireText(changes.titulo, 'titulo');
  Object.assign(node, changes);
  return { node: summarizeNode(node) };
}

export function addNode(project, { parentId, loose = false, index, categoriaId = null, ...fields }) {
  const node = {
    ...makeBlankNode(),
    pregunta: fields.pregunta || '',
    intencionSubyacente: fields.intencionSubyacente || '',
    titulo: requireText(fields.titulo, 'titulo'),
    categoriaId,
  };
  const list = targetList(project, { parentId, loose });
  const position = insertAt(list, node, index);
  return { node: summarizeNode(node, { location: loose ? 'sueltos' : 'hijos' }), parentId: loose ? null : parentId, index: position };
}

export function deleteNode(project, { nodeId }) {
  const node = requireNode(project, nodeId);
  if (node.isRoot) throw new Error('No se puede borrar el root');
  detachNodeById(project.data, nodeId);
  return { deleted: summarizeNode(node) };
}

export function moveNode(project, { nodeId, parentId, loose = false, index }) {
  const node = requireNode(project, nodeId);
  if (node.isRoot) throw new Error('No se puede mover el root');
  if (!loose && parentId && containsNode(node, parentId)) {
    throw new Error('No se puede mover un nodo dentro de sí mismo o de uno de sus descendientes');
  }
  // Se valida el destino antes de despegar el nodo para no perderlo si falla.
  targetList(project, { parentId, loose });
  detachNodeById(project.data, nodeId);
  const position = insertAt(targetList(project, { parentId, loose }), node, index);
  return { node: summarizeNode(node, { location: loose ? 'sueltos' : 'hijos' }), parentId: loose ? null : parentId, index: position };
}

export function addPolicy(project, { nodeId, texto }) {
  const node = requireValueNode(project, nodeId);
  const policy = makePolicy(requireText(texto, 'texto'));
  node.politicas.push(policy);
  return { nodeId, policy, index: node.politicas.length - 1 };
}

export function updatePolicy(project, { nodeId, policyId, texto }) {
  const node = requireValueNode(project, nodeId);
  const policy = requirePolicy(node, policyId);
  policy.texto = requireText(texto, 'texto');
  return { nodeId, policy };
}

// Reutiliza la regla de dominio: las métricas que nacían de la política se
// reasignan a la primera política restante o se eliminan si no queda ninguna.
export function deletePolicy(project, { nodeId, policyId }) {
  const node = requireValueNode(project, nodeId);
  requirePolicy(node, policyId);
  const metricIds = (nodeToCheck) => [...nodeToCheck.metricasValor, ...nodeToCheck.metricasControl].map((metric) => metric.id);
  const before = metricIds(node);
  removePolicyFromNode(node, policyId);
  const after = new Set(metricIds(node));
  return {
    nodeId,
    deletedPolicyId: policyId,
    relinkedTo: node.politicas[0]?.id || null,
    deletedMetricIds: before.filter((id) => !after.has(id)),
  };
}

export function addMetric(project, { nodeId, type, texto, origenPoliticaId }) {
  const node = requireValueNode(project, nodeId);
  const field = METRIC_LISTS[type];
  if (!field) throw new Error('type debe ser "valor" o "control"');
  requirePolicy(node, origenPoliticaId);
  const metric = makeMetric(requireText(texto, 'texto'), origenPoliticaId);
  node[field].push(metric);
  return { nodeId, type, metric };
}

export function updateMetric(project, { nodeId, metricId, texto, origenPoliticaId, type }) {
  const node = requireValueNode(project, nodeId);
  const found = findMetric(node, metricId);
  if (texto !== undefined) found.metric.texto = requireText(texto, 'texto');
  if (origenPoliticaId !== undefined) {
    requirePolicy(node, origenPoliticaId);
    found.metric.origenPoliticaId = origenPoliticaId;
  }
  if (type !== undefined && type !== found.type) {
    const field = METRIC_LISTS[type];
    if (!field) throw new Error('type debe ser "valor" o "control"');
    node[found.field].splice(found.index, 1);
    node[field].push(found.metric);
  }
  return { nodeId, type: type || found.type, metric: found.metric };
}

export function deleteMetric(project, { nodeId, metricId }) {
  const node = requireValueNode(project, nodeId);
  const found = findMetric(node, metricId);
  node[found.field].splice(found.index, 1);
  return { nodeId, type: found.type, deletedMetricId: metricId };
}

export function createProject(payload, { name, aplicacionValorSuperior = '', intencionSuperior = '', makeCurrent = false }) {
  const project = makeProject(requireText(name, 'name'), { aplicacionValorSuperior, intencionSuperior, hijos: [], sueltos: [] });
  payload.projects = [...asArray(payload.projects), project];
  if (makeCurrent || !payload.currentProjectId) payload.currentProjectId = project.id;
  return { project: summarizeProject(project) };
}

// Aplica una mutación sobre un proyecto del payload y marca su updatedAt.
export function mutateProjectIn(payload, projectId, mutation, args) {
  const project = getProject(payload, projectId);
  const result = mutation(project, args);
  project.updatedAt = new Date().toISOString();
  return { projectId: project.id, ...result };
}

// Ninguna herramienta del MCP borra proyectos. Si el borrador perdió alguno,
// es un bug (p. ej. partir de una vista filtrada): el PUT reemplaza todo y lo
// borraría de la base, así que se aborta antes de escribir.
function assertNoProjectLost(current, draft) {
  const draftIds = new Set(asArray(draft.projects).map((project) => project.id));
  const lost = asArray(current.projects).map((project) => project.id).filter((id) => !draftIds.has(id));
  if (lost.length) throw new Error(`Escritura abortada: se perderían los proyectos ${lost.join(', ')}`);
}

// Read-modify-write con control de concurrencia optimista: lee el estado,
// aplica la mutación sobre una copia y guarda declarando la revisión leída.
// Si otro escritor (la UI, otra persona) guardó en medio, el backend responde
// 409 y se repite todo sobre el estado nuevo, sin pisar sus cambios.
export async function runMutation({ fetchProjects, saveProjects, mutator, maxAttempts = 3 }) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const current = await fetchProjects();
    const draft = structuredClone({ projects: asArray(current.projects), currentProjectId: current.currentProjectId || null });
    const result = mutator(draft);
    assertNoProjectLost(current, draft);
    try {
      const saved = await saveProjects({ ...draft, baseRevision: current.revision ?? 0 });
      return { ...result, revision: saved.revision };
    } catch (error) {
      if (error.status !== 409 || attempt === maxAttempts) throw error;
    }
  }
  throw new Error('No se pudo guardar tras varios intentos por conflictos de concurrencia');
}
