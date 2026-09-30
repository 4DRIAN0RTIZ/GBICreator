// Guardarraíl de alcance por proyecto para el MCP (GBI_MCP_PROJECTS).
//
// NO es un mecanismo de seguridad: la API HTTP no tiene autenticación y quien
// controla la config del MCP puede quitar la variable. Sirve para que un
// agente configurado para un proyecto no lea ni edite otros por error.
//
// Formato: "<projectId>:r,<projectId>:rw,*:r"  (r = lectura, rw = edición).
// `*` aplica a los proyectos no listados. Sin variable: sin restricción.

const LEVELS = new Set(['r', 'rw']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function parseProjectAccess(spec) {
  const text = String(spec || '').trim();
  if (!text) return null;

  const rules = new Map();
  let fallback = null;
  for (const entry of text.split(',').map((item) => item.trim()).filter(Boolean)) {
    const separator = entry.lastIndexOf(':');
    const projectId = separator === -1 ? '' : entry.slice(0, separator).trim();
    const level = separator === -1 ? '' : entry.slice(separator + 1).trim().toLowerCase();
    if (!projectId || !LEVELS.has(level)) {
      throw new Error(`GBI_MCP_PROJECTS inválido en "${entry}": usa <projectId>:r o <projectId>:rw`);
    }
    if (projectId === '*') fallback = level;
    else rules.set(projectId, level);
  }
  return { rules, fallback };
}

export function accessLevel(access, projectId) {
  if (!access) return 'rw';
  return access.rules.get(projectId) || access.fallback || null;
}

export function canRead(access, projectId) {
  return accessLevel(access, projectId) !== null;
}

export function canWrite(access, projectId) {
  return accessLevel(access, projectId) === 'rw';
}

// Operaciones que tocan proyectos que aún no existen o todos a la vez
// (crear proyecto, restaurar snapshot) exigen acceso amplio.
export function canWriteAll(access) {
  return !access || access.fallback === 'rw';
}

export function assertCanWriteAll(access, action) {
  if (!canWriteAll(access)) {
    throw new Error(`${action} no está permitido con GBI_MCP_PROJECTS restringido (requiere *:rw o quitar la restricción)`);
  }
}

// Vista de lectura: solo proyectos legibles, cada uno anotado con su nivel.
// El currentProjectId se ajusta si el actual queda fuera de alcance.
export function filterProjectsPayload(payload, access) {
  const projects = asArray(payload?.projects).filter((project) => canRead(access, project.id));
  const currentProjectId = projects.some((project) => project.id === payload?.currentProjectId)
    ? payload.currentProjectId
    : projects[0]?.id || null;
  return { ...payload, projects, currentProjectId, isEmpty: projects.length === 0 };
}

// Resuelve el proyecto objetivo dentro del alcance: el indicado o, si no se
// indica, el actual de la vista filtrada. Falla con un mensaje explícito si
// está fuera de alcance, en lugar de un "no existe" que confunda al agente.
export function resolveProjectId(payload, projectId, access, { write = false } = {}) {
  if (projectId) {
    if (!asArray(payload?.projects).some((project) => project.id === projectId)) {
      throw new Error(`No existe un proyecto con id ${projectId}`);
    }
    if (!canRead(access, projectId)) throw new Error(`El proyecto ${projectId} está fuera del alcance de GBI_MCP_PROJECTS`);
  }
  const resolved = projectId || filterProjectsPayload(payload, access).currentProjectId;
  if (!resolved) throw new Error('No hay proyectos accesibles con la configuración de GBI_MCP_PROJECTS');
  if (write && !canWrite(access, resolved)) {
    throw new Error(`El proyecto ${resolved} es de solo lectura según GBI_MCP_PROJECTS`);
  }
  return resolved;
}

// Los snapshots contienen todos los proyectos: se recortan a los legibles.
export function filterSnapshotList(list, access) {
  return {
    ...list,
    snapshots: asArray(list?.snapshots)
      .map((snapshot) => ({ ...snapshot, projects: asArray(snapshot.projects).filter((project) => canRead(access, project.id)) }))
      .filter((snapshot) => !access || snapshot.projects.length),
  };
}

export function filterSnapshot(snapshot, access) {
  const projects = asArray(snapshot?.projects).filter((project) => canRead(access, project.id));
  if (access && !projects.length) throw new Error(`El snapshot ${snapshot.id} no contiene proyectos dentro del alcance`);
  return { ...snapshot, projects };
}
