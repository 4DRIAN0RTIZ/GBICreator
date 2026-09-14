export function genId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeBlankData() {
  return {
    id: 'root',
    isRoot: true,
    aplicacionValorSuperior: '',
    intencionSuperior: '',
    hijos: [],
    sueltos: [],
  };
}

export function makePolicy(texto = '') {
  return { id: genId(), texto };
}

export function makeMetric(texto = '', origenPoliticaId = null) {
  return { id: genId(), texto, origenPoliticaId };
}

export function makeBlankNode() {
  return {
    id: genId(),
    isRoot: false,
    titulo: 'Quiero...',
    pregunta: '',
    intencionSubyacente: '',
    politicas: [],
    metricasValor: [],
    metricasControl: [],
    collapsed: false,
    categoriaId: null,
    hijos: [],
  };
}

export function makeExampleData() {
  const ejemplo = makeBlankNode();
  ejemplo.titulo = 'Quiero reducir la exposición a incidentes por dispositivos desconocidos o no autorizados';
  ejemplo.pregunta = '¿Los dispositivos desconocidos quedan bloqueados y los conocidos operan con autorización vigente?';
  ejemplo.intencionSubyacente = 'Los dispositivos que no puedan identificarse como activos conocidos y autorizados permanecen sin acceso a la red de producción hasta completar su identificación y autorización, salvo excepciones vigentes aprobadas.';
  const politicaEjemplo = makePolicy('P02.1 Toda nueva presencia detectada se contrasta con el inventario y la fuente de autorización.');
  ejemplo.politicas = [politicaEjemplo];
  ejemplo.metricasValor = [makeMetric('Exposición observada: minutos con acceso no autorizado por dispositivo.', politicaEjemplo.id)];
  ejemplo.metricasControl = [makeMetric('Dispositivos en espera de bloqueo, bloqueados, o exceptuados.', politicaEjemplo.id)];

  return {
    id: 'root',
    isRoot: true,
    aplicacionValorSuperior: 'Gobierno de Activos de TI (Quiero que mis activos sostengan la operación con un costo justificado y un nivel de riesgo aceptable durante todo su ciclo de vida)',
    intencionSuperior: 'Los activos tecnológicos en alcance se mantienen bajo responsabilidad definida, con uso y permanencia justificados, condiciones de operación autorizadas y decisiones oportunas de mantenimiento, renovación, recuperación o retiro, conforme a su contribución al servicio, costo y riesgo.',
    hijos: [ejemplo],
    sueltos: [],
  };
}

// Migra políticas de versiones anteriores (strings sueltos) a objetos con id
// propio, para poder referenciarlas desde una métrica.
function normalizePoliticas(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => (typeof item === 'string'
    ? { id: genId(), texto: item }
    : { id: item?.id || genId(), texto: item?.texto || '' }));
}

// Migra métricas de versiones anteriores (strings sueltos, sin origen) a
// objetos con id propio y origenPoliticaId. Los datos migrados quedan con
// origenPoliticaId: null (huérfanos) porque no hay forma de inferir de qué
// política nacían — el usuario debe reasignarlos manualmente.
function normalizeMetricas(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => (typeof item === 'string'
    ? { id: genId(), texto: item, origenPoliticaId: null }
    : { id: item?.id || genId(), texto: item?.texto || '', origenPoliticaId: item?.origenPoliticaId || null }));
}

export function normalizeNode(obj = {}) {
  return {
    id: obj.id || genId(),
    isRoot: false,
    titulo: obj.titulo || '',
    pregunta: obj.pregunta || '',
    intencionSubyacente: obj.intencionSubyacente || '',
    politicas: normalizePoliticas(obj.politicas),
    metricasValor: normalizeMetricas(obj.metricasValor),
    metricasControl: normalizeMetricas(obj.metricasControl),
    collapsed: !!obj.collapsed,
    categoriaId: obj.categoriaId || null,
    hijos: Array.isArray(obj.hijos) ? obj.hijos.map(normalizeNode) : [],
  };
}

// Quita una política del nodo y reencauza las métricas que nacían de ella:
// si queda alguna política, se reasignan a la primera; si no queda ninguna,
// esas métricas se eliminan (no pueden existir sin origen). Las métricas
// huérfanas preexistentes (origenPoliticaId: null, de datos migrados) no se
// tocan aquí — solo se relinkean las que apuntaban exactamente a esta política.
export function removePolicyFromNode(node, policyId) {
  const remaining = node.politicas.filter((policy) => policy.id !== policyId);
  const fallbackId = remaining[0]?.id ?? null;
  const relink = (metric) => {
    if (metric.origenPoliticaId !== policyId) return metric;
    return fallbackId ? { ...metric, origenPoliticaId: fallbackId } : null;
  };
  node.politicas = remaining;
  node.metricasValor = node.metricasValor.map(relink).filter(Boolean);
  node.metricasControl = node.metricasControl.map(relink).filter(Boolean);
}

// Limpia una lista de métricas (trim, descarta vacías) y garantiza que toda
// métrica que sobreviva apunte a una política válida del set actual —
// reasignándola al fallback si su origen ya no existe, o descartándola si no
// hay ningún fallback posible.
export function sanitizeMetricList(list, validPolicyIds, fallbackId) {
  return (list || [])
    .map((item) => ({ id: item.id || genId(), texto: (item.texto || '').trim(), origenPoliticaId: item.origenPoliticaId }))
    .filter((item) => item.texto)
    .map((item) => (validPolicyIds.has(item.origenPoliticaId) ? item : { ...item, origenPoliticaId: fallbackId }))
    .filter((item) => item.origenPoliticaId);
}

// Índice (y color derivado) de la política de origen de una métrica dentro
// de las políticas del nodo. Índice -1 / unassigned: true marca una métrica
// huérfana (dato migrado o política borrada) que necesita reasignación.
export function policyOriginMeta(politicas, origenPoliticaId) {
  const index = (politicas || []).findIndex((policy) => policy.id === origenPoliticaId);
  if (index === -1) return { originLabel: '⚠', originIndex: null, unassigned: true };
  return { originLabel: `P${index + 1}`, originIndex: index % 6, unassigned: false };
}

export function normalizeLoadedData(obj = {}) {
  return {
    id: 'root',
    isRoot: true,
    aplicacionValorSuperior: obj.aplicacionValorSuperior || '',
    intencionSuperior: obj.intencionSuperior || '',
    hijos: Array.isArray(obj.hijos) ? obj.hijos.map(normalizeNode) : [],
    sueltos: Array.isArray(obj.sueltos) ? obj.sueltos.map(normalizeNode) : [],
  };
}

export function cloneData(data) {
  return structuredClone(data);
}

export function findNodeIn(node, id) {
  if (node.id === id) return node;
  for (const child of node.hijos || []) {
    const found = findNodeIn(child, id);
    if (found) return found;
  }
  return null;
}

export function findNode(data, id) {
  const inMain = findNodeIn(data, id);
  if (inMain) return inMain;
  for (const loose of data.sueltos || []) {
    const found = findNodeIn(loose, id);
    if (found) return found;
  }
  return null;
}

function findParentIn(node, childId) {
  for (const child of node.hijos || []) {
    if (child.id === childId) return node;
    const found = findParentIn(child, childId);
    if (found) return found;
  }
  return null;
}

export function detachNodeById(data, id) {
  const parentInMain = findParentIn(data, id);
  if (parentInMain) {
    const idx = parentInMain.hijos.findIndex((child) => child.id === id);
    return parentInMain.hijos.splice(idx, 1)[0];
  }

  const topIdx = data.sueltos.findIndex((node) => node.id === id);
  if (topIdx !== -1) return data.sueltos.splice(topIdx, 1)[0];

  for (const loose of data.sueltos) {
    const parent = findParentIn(loose, id);
    if (parent) {
      const idx = parent.hijos.findIndex((child) => child.id === id);
      return parent.hijos.splice(idx, 1)[0];
    }
  }
  return null;
}

export function flattenValueNodes(node, out = []) {
  (node.hijos || []).forEach((child) => {
    out.push(child);
    flattenValueNodes(child, out);
  });
  return out;
}

export function countDescendants(node) {
  return (node?.hijos || []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

export function cloneValueBlock(node) {
  const idMap = new Map();
  const politicas = (node.politicas || []).map((policy) => {
    const newId = genId();
    idMap.set(policy.id, newId);
    return { id: newId, texto: policy.texto };
  });
  const remapMetric = (metric) => ({
    id: genId(),
    texto: metric.texto,
    origenPoliticaId: idMap.get(metric.origenPoliticaId) || null,
  });

  return {
    id: genId(),
    isRoot: false,
    titulo: node.titulo ? `${node.titulo} (copia)` : 'Quiero... (copia)',
    pregunta: node.pregunta || '',
    intencionSubyacente: node.intencionSubyacente || '',
    politicas,
    metricasValor: (node.metricasValor || []).map(remapMetric),
    metricasControl: (node.metricasControl || []).map(remapMetric),
    collapsed: false,
    categoriaId: node.categoriaId || null,
    hijos: [],
  };
}

export function insertNodeAfterSibling(data, originalId, duplicate) {
  const parentInMain = findParentIn(data, originalId);
  if (parentInMain) {
    const idx = parentInMain.hijos.findIndex((child) => child.id === originalId);
    parentInMain.hijos.splice(idx + 1, 0, duplicate);
    return true;
  }

  const topIdx = data.sueltos.findIndex((node) => node.id === originalId);
  if (topIdx !== -1) {
    data.sueltos.splice(topIdx + 1, 0, duplicate);
    return true;
  }

  for (const loose of data.sueltos) {
    const parent = findParentIn(loose, originalId);
    if (parent) {
      const idx = parent.hijos.findIndex((child) => child.id === originalId);
      parent.hijos.splice(idx + 1, 0, duplicate);
      return true;
    }
  }
  return false;
}

export function flattenTreeForPicker(node, depth = 0, out = []) {
  const label = node.isRoot
    ? node.aplicacionValorSuperior || 'Aplicación de valor Superior'
    : node.titulo || '(Sin título)';
  out.push({ id: node.id, label: `${'—'.repeat(depth)}${depth ? ' ' : ''}${label}` });
  node.hijos.forEach((child) => flattenTreeForPicker(child, depth + 1, out));
  return out;
}

export function setCollapsedRecursive(node, value) {
  if (!node.isRoot) node.collapsed = value;
  node.hijos.forEach((child) => setCollapsedRecursive(child, value));
}

export function clearCategoryRecursive(node, categoriaId) {
  if (node.categoriaId === categoriaId) node.categoriaId = null;
  (node.hijos || []).forEach((child) => clearCategoryRecursive(child, categoriaId));
}
