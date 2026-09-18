function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nodeLabel(node) {
  if (!node) return '';
  if (node.isRoot) return node.aplicacionValorSuperior || 'Aplicación de valor Superior';
  return node.titulo || '(Sin título)';
}

function textIncludes(value, query) {
  return String(value || '').toLocaleLowerCase().includes(query);
}

export function summarizeNode(node, { depth = 0, location = 'hijos' } = {}) {
  return {
    id: node.id,
    label: nodeLabel(node),
    depth,
    location,
    isRoot: !!node.isRoot,
    categoriaId: node.categoriaId || null,
    childrenCount: asArray(node.hijos).length,
    policiesCount: asArray(node.politicas).length,
    valueMetricsCount: asArray(node.metricasValor).length,
    controlMetricsCount: asArray(node.metricasControl).length,
  };
}

export function summarizeProject(project) {
  const data = project.data || {};
  return {
    id: project.id,
    name: project.name || 'Proyecto sin nombre',
    updatedAt: project.updatedAt || null,
    rootLabel: nodeLabel({ ...data, isRoot: true }),
    topLevelCount: asArray(data.hijos).length,
    looseCount: asArray(data.sueltos).length,
  };
}

export function listProjects(projectsPayload) {
  return {
    currentProjectId: projectsPayload.currentProjectId || null,
    isEmpty: !!projectsPayload.isEmpty,
    projects: asArray(projectsPayload.projects).map(summarizeProject),
  };
}

export function getProject(projectsPayload, projectId) {
  const projects = asArray(projectsPayload.projects);
  const fallbackProject = projectsPayload.currentProjectId
    ? projects.find((project) => project.id === projectsPayload.currentProjectId)
    : projects[0];
  const project = projectId ? projects.find((item) => item.id === projectId) : fallbackProject;
  if (!project) {
    const suffix = projectId ? ` con id ${projectId}` : '';
    throw new Error(`No existe un proyecto${suffix}`);
  }
  return project;
}

function findNodeIn(node, nodeId, path = []) {
  if (!node) return null;
  const currentPath = [...path, { id: node.id, label: nodeLabel(node) }];
  if (node.id === nodeId) return { node, path: currentPath };

  for (const child of asArray(node.hijos)) {
    const found = findNodeIn(child, nodeId, currentPath);
    if (found) return found;
  }
  return null;
}

function rootNode(project) {
  const data = project.data || {};
  return { ...data, id: data.id || 'root', isRoot: true };
}

function walkNode(node, visitor, { depth = 0, location = 'hijos', path = [] } = {}) {
  const currentPath = [...path, { id: node.id, label: nodeLabel(node) }];
  visitor(node, { depth, location, path: currentPath });
  asArray(node.hijos).forEach((child) => walkNode(child, visitor, { depth: depth + 1, location, path: currentPath }));
}

function walkProject(project, visitor) {
  const root = rootNode(project);
  walkNode(root, visitor, { depth: 0, location: 'hijos' });
  asArray(project.data?.sueltos).forEach((loose) => {
    walkNode(loose, visitor, { depth: 1, location: 'sueltos', path: [{ id: root.id, label: nodeLabel(root) }] });
  });
}

export function findNode(project, nodeId) {
  const root = rootNode(project);
  const inRoot = findNodeIn(root, nodeId);
  if (inRoot) return { ...inRoot, location: 'hijos' };

  for (const loose of asArray(project.data?.sueltos)) {
    const found = findNodeIn(loose, nodeId, [{ id: root.id, label: nodeLabel(root) }]);
    if (found) return { ...found, location: 'sueltos' };
  }

  throw new Error(`No existe un nodo con id ${nodeId}`);
}

export function listTopLevelNodes(project, { includeLoose = true } = {}) {
  const data = project.data || {};
  const nodes = asArray(data.hijos).map((node) => summarizeNode(node, { depth: 1, location: 'hijos' }));
  if (includeLoose) {
    nodes.push(...asArray(data.sueltos).map((node) => summarizeNode(node, { depth: 1, location: 'sueltos' })));
  }
  return {
    project: summarizeProject(project),
    root: summarizeNode(rootNode(project), { depth: 0, location: 'root' }),
    nodes,
  };
}

export function listNodeChildren(project, nodeId) {
  const found = findNode(project, nodeId);
  return {
    node: summarizeNode(found.node, { depth: found.path.length - 1, location: found.location }),
    path: found.path,
    children: asArray(found.node.hijos).map((child) => summarizeNode(child, { depth: found.path.length, location: found.location })),
  };
}

export function getNode(project, nodeId) {
  const found = findNode(project, nodeId);
  return {
    node: found.node,
    path: found.path,
    location: found.location,
  };
}

export function getTreeOutline(project, { includeLoose = true } = {}) {
  const items = [];
  const root = rootNode(project);
  walkNode(root, (node, context) => {
    items.push({ ...summarizeNode(node, context), path: context.path.map((entry) => entry.label).join(' > ') });
  });
  if (includeLoose) {
    asArray(project.data?.sueltos).forEach((loose) => {
      walkNode(loose, (node, context) => {
        items.push({ ...summarizeNode(node, context), path: context.path.map((entry) => entry.label).join(' > ') });
      }, { depth: 1, location: 'sueltos', path: [{ id: root.id, label: nodeLabel(root) }] });
    });
  }
  return { project: summarizeProject(project), items };
}

export function searchNodes(project, { query, limit = 20 } = {}) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  if (!normalizedQuery) throw new Error('query no puede estar vacío');

  const matches = [];
  walkProject(project, (node, context) => {
    if (matches.length >= limit) return;
    const fields = [
      ['label', nodeLabel(node)],
      ['pregunta', node.pregunta],
      ['intencionSubyacente', node.intencionSubyacente],
      ['aplicacionValorSuperior', node.aplicacionValorSuperior],
      ['intencionSuperior', node.intencionSuperior],
      ...asArray(node.politicas).map((policy, index) => [`politicas.${index}`, policy.texto]),
      ...asArray(node.metricasValor).map((metric, index) => [`metricasValor.${index}`, metric.texto]),
      ...asArray(node.metricasControl).map((metric, index) => [`metricasControl.${index}`, metric.texto]),
    ];
    const matchedFields = fields.filter(([, value]) => textIncludes(value, normalizedQuery)).map(([field]) => field);
    if (matchedFields.length) {
      matches.push({ ...summarizeNode(node, context), path: context.path, matchedFields });
    }
  });

  return { query, count: matches.length, matches };
}

export function listPolicies(project) {
  const policies = [];
  walkProject(project, (node, context) => {
    asArray(node.politicas).forEach((policy, index) => {
      policies.push({
        id: policy.id || null,
        texto: policy.texto || '',
        index,
        node: summarizeNode(node, context),
        path: context.path,
      });
    });
  });
  return { project: summarizeProject(project), count: policies.length, policies };
}

export function listMetrics(project) {
  const metrics = [];
  walkProject(project, (node, context) => {
    const policyIds = new Map(asArray(node.politicas).map((policy, index) => [policy.id, { id: policy.id, texto: policy.texto || '', index }]));
    [
      ['valor', asArray(node.metricasValor)],
      ['control', asArray(node.metricasControl)],
    ].forEach(([type, list]) => {
      list.forEach((metric, index) => {
        metrics.push({
          id: metric.id || null,
          texto: metric.texto || '',
          type,
          index,
          origenPoliticaId: metric.origenPoliticaId || null,
          originPolicy: policyIds.get(metric.origenPoliticaId) || null,
          hasBrokenOrigin: !!metric.origenPoliticaId && !policyIds.has(metric.origenPoliticaId),
          isOrphan: !metric.origenPoliticaId,
          node: summarizeNode(node, context),
          path: context.path,
        });
      });
    });
  });
  return { project: summarizeProject(project), count: metrics.length, metrics };
}

export function validateProject(project) {
  const issues = [];
  const ids = new Map();

  function addIssue(severity, code, message, context = {}) {
    issues.push({ severity, code, message, ...context });
  }

  walkProject(project, (node, context) => {
    if (!node.id) {
      addIssue('error', 'node_missing_id', 'Un nodo no tiene id', { path: context.path });
      return;
    }

    if (ids.has(node.id)) {
      addIssue('error', 'duplicate_node_id', `Id de nodo duplicado: ${node.id}`, { nodeId: node.id, firstPath: ids.get(node.id), path: context.path });
    } else {
      ids.set(node.id, context.path);
    }

    if (!Array.isArray(node.hijos)) {
      addIssue('error', 'invalid_children', `El nodo ${node.id} no tiene hijos como array`, { nodeId: node.id, path: context.path });
    }

    if (!node.isRoot && !String(node.titulo || '').trim()) {
      addIssue('warning', 'node_missing_title', `El nodo ${node.id} no tiene título`, { nodeId: node.id, path: context.path });
    }

    const policyIds = new Set();
    asArray(node.politicas).forEach((policy, index) => {
      if (!policy.id) addIssue('error', 'policy_missing_id', `Una política del nodo ${node.id} no tiene id`, { nodeId: node.id, index, path: context.path });
      if (policy.id && policyIds.has(policy.id)) addIssue('error', 'duplicate_policy_id', `Política duplicada en el nodo ${node.id}: ${policy.id}`, { nodeId: node.id, policyId: policy.id, path: context.path });
      policyIds.add(policy.id);
      if (!String(policy.texto || '').trim()) addIssue('warning', 'policy_missing_text', `Una política del nodo ${node.id} no tiene texto`, { nodeId: node.id, policyId: policy.id || null, path: context.path });
    });

    [
      ['metricasValor', asArray(node.metricasValor)],
      ['metricasControl', asArray(node.metricasControl)],
    ].forEach(([field, metrics]) => {
      metrics.forEach((metric, index) => {
        if (!metric.id) addIssue('error', 'metric_missing_id', `Una métrica de ${field} del nodo ${node.id} no tiene id`, { nodeId: node.id, index, field, path: context.path });
        if (!String(metric.texto || '').trim()) addIssue('warning', 'metric_missing_text', `Una métrica de ${field} del nodo ${node.id} no tiene texto`, { nodeId: node.id, metricId: metric.id || null, field, path: context.path });
        if (!metric.origenPoliticaId) {
          addIssue('warning', 'metric_orphan', `La métrica ${metric.id || index} del nodo ${node.id} no tiene política de origen`, { nodeId: node.id, metricId: metric.id || null, field, path: context.path });
        } else if (!policyIds.has(metric.origenPoliticaId)) {
          addIssue('error', 'metric_broken_origin', `La métrica ${metric.id || index} apunta a una política inexistente: ${metric.origenPoliticaId}`, { nodeId: node.id, metricId: metric.id || null, origenPoliticaId: metric.origenPoliticaId, field, path: context.path });
        }
      });
    });
  });

  return {
    project: summarizeProject(project),
    ok: !issues.some((issue) => issue.severity === 'error'),
    counts: {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
    },
    issues,
  };
}
