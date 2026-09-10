export function genId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
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
  ejemplo.politicas = ['P02.1 Toda nueva presencia detectada se contrasta con el inventario y la fuente de autorización.'];
  ejemplo.metricasValor = ['Exposición observada: minutos con acceso no autorizado por dispositivo.'];
  ejemplo.metricasControl = ['Dispositivos en espera de bloqueo, bloqueados, o exceptuados.'];

  return {
    id: 'root',
    isRoot: true,
    aplicacionValorSuperior: 'Gobierno de Activos de TI (Quiero que mis activos sostengan la operación con un costo justificado y un nivel de riesgo aceptable durante todo su ciclo de vida)',
    intencionSuperior: 'Los activos tecnológicos en alcance se mantienen bajo responsabilidad definida, con uso y permanencia justificados, condiciones de operación autorizadas y decisiones oportunas de mantenimiento, renovación, recuperación o retiro, conforme a su contribución al servicio, costo y riesgo.',
    hijos: [ejemplo],
    sueltos: [],
  };
}

export function normalizeNode(obj = {}) {
  return {
    id: obj.id || genId(),
    isRoot: false,
    titulo: obj.titulo || '',
    pregunta: obj.pregunta || '',
    intencionSubyacente: obj.intencionSubyacente || '',
    politicas: Array.isArray(obj.politicas) ? obj.politicas : [],
    metricasValor: Array.isArray(obj.metricasValor) ? obj.metricasValor : [],
    metricasControl: Array.isArray(obj.metricasControl) ? obj.metricasControl : [],
    collapsed: !!obj.collapsed,
    categoriaId: obj.categoriaId || null,
    hijos: Array.isArray(obj.hijos) ? obj.hijos.map(normalizeNode) : [],
  };
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
  return {
    id: genId(),
    isRoot: false,
    titulo: node.titulo ? `${node.titulo} (copia)` : 'Quiero... (copia)',
    pregunta: node.pregunta || '',
    intencionSubyacente: node.intencionSubyacente || '',
    politicas: [...(node.politicas || [])],
    metricasValor: [...(node.metricasValor || [])],
    metricasControl: [...(node.metricasControl || [])],
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
