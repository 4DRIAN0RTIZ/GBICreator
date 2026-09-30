import Database from 'better-sqlite3';

export function openDatabase(databasePath = process.env.GBI_DATABASE_PATH || 'data/gbi-creator.sqlite') {
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      data TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS project_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revision INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      reason TEXT NOT NULL,
      summary TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
  const projectColumns = db.prepare('PRAGMA table_info(projects)').all().map((column) => column.name);
  if (!projectColumns.includes('position')) {
    db.exec('ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
  }
  return db;
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

export class ConflictError extends Error {
  constructor(message, current) {
    super(message);
    this.status = 409;
    this.current = current;
  }
}

function readRevision(db, key) {
  return Number(db.prepare('SELECT value FROM metadata WHERE key = ?').get(key)?.value || 0);
}

function writeMetadata(db, key, value) {
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

// Control de concurrencia optimista: quien escribe declara sobre qué revisión
// trabajó. Si alguien más escribió después, se rechaza con 409 en lugar de
// pisar sus cambios (el PUT reemplaza el conjunto completo).
function assertBaseRevision(db, key, baseRevision, readCurrent) {
  if (baseRevision === undefined || baseRevision === null || Number(baseRevision) !== readRevision(db, key)) {
    throw new ConflictError('Los datos cambiaron en el servidor desde tu última lectura', readCurrent(db));
  }
}

export function readProjectsRevision(db) {
  return readRevision(db, 'projectsRevision');
}

export function readProjects(db) {
  const projects = db.prepare('SELECT id, name, updatedAt, data FROM projects ORDER BY position ASC, updatedAt DESC').all()
    .map((project) => ({ ...project, data: JSON.parse(project.data) }));
  const currentProjectId = db.prepare('SELECT value FROM metadata WHERE key = ?').get('currentProjectId')?.value || projects[0]?.id || null;
  return { projects, currentProjectId, isEmpty: projects.length === 0, revision: readProjectsRevision(db) };
}

function projectRows(projects) {
  return projects.map((project) => {
    if (!project?.id || !project?.data) throw new Error('cada proyecto necesita id y data');
    return {
      id: project.id,
      name: project.name || 'Proyecto sin nombre',
      updatedAt: project.updatedAt || new Date().toISOString(),
      data: JSON.stringify(project.data),
    };
  });
}

function storedProjectRows(db) {
  return db.prepare('SELECT id, name, updatedAt, data FROM projects ORDER BY position ASC, updatedAt DESC').all();
}

export const DEFAULT_SNAPSHOT_OPTIONS = {
  snapshotIntervalMs: 5 * 60 * 1000,
  snapshotLimit: 100,
  now: () => new Date(),
};

function totalDataSize(rows) {
  return rows.reduce((total, row) => total + row.data.length, 0);
}

// Decide si hay que guardar el estado actual antes de reemplazarlo. El
// autoguardado escribe en cada tecleo, así que por tiempo solo se toma uno
// cada `snapshotIntervalMs`; pero cualquier escritura que borre proyectos o
// reduzca mucho el contenido se respalda siempre.
function snapshotReason(db, storedRows, nextRows, { snapshotIntervalMs, now }) {
  if (!storedRows.length) return null;
  const nextIds = new Set(nextRows.map((row) => row.id));
  if (storedRows.some((row) => !nextIds.has(row.id))) return 'project_removed';
  if (totalDataSize(nextRows) < totalDataSize(storedRows) * 0.7) return 'large_shrink';
  const last = db.prepare('SELECT createdAt FROM project_snapshots ORDER BY id DESC LIMIT 1').get();
  if (!last || now().getTime() - Date.parse(last.createdAt) >= snapshotIntervalMs) return 'interval';
  return null;
}

function takeProjectsSnapshot(db, reason, { snapshotLimit, now }) {
  const { projects, currentProjectId, revision } = readProjects(db);
  const summary = projects.map((project) => ({ id: project.id, name: project.name, updatedAt: project.updatedAt }));
  db.prepare('INSERT INTO project_snapshots (revision, createdAt, reason, summary, data) VALUES (?, ?, ?, ?, ?)')
    .run(revision, now().toISOString(), reason, JSON.stringify(summary), JSON.stringify({ projects, currentProjectId }));
  db.prepare('DELETE FROM project_snapshots WHERE id NOT IN (SELECT id FROM project_snapshots ORDER BY id DESC LIMIT ?)')
    .run(snapshotLimit);
}

function replaceProjects(db, rows, currentProjectId) {
  db.prepare('DELETE FROM projects').run();
  const insert = db.prepare('INSERT INTO projects (id, name, updatedAt, data, position) VALUES (?, ?, ?, ?, ?)');
  rows.forEach((row, index) => insert.run(row.id, row.name, row.updatedAt, row.data, index));
  writeMetadata(db, 'currentProjectId', currentProjectId);
  writeMetadata(db, 'projectsRevision', readProjectsRevision(db) + 1);
}

export function writeProjects(db, body, options = {}) {
  const projects = Array.isArray(body?.projects) ? body.projects : null;
  if (!projects) throw new Error('projects debe ser un array');

  const snapshotOptions = { ...DEFAULT_SNAPSHOT_OPTIONS, ...options };
  const rows = projectRows(projects);
  const currentProjectId = body.currentProjectId || projects[0]?.id || null;
  const transaction = db.transaction(() => {
    const storedRows = storedProjectRows(db);
    const storedCurrentId = db.prepare('SELECT value FROM metadata WHERE key = ?').get('currentProjectId')?.value || null;
    // Un guardado idéntico a lo almacenado no es un cambio: no exige revisión
    // ni la incrementa (evita conflictos falsos y ruido en otras pestañas).
    if (storedCurrentId === currentProjectId && JSON.stringify(storedRows) === JSON.stringify(rows)) return;

    assertBaseRevision(db, 'projectsRevision', body.baseRevision, readProjects);
    const reason = snapshotReason(db, storedRows, rows, snapshotOptions);
    if (reason) takeProjectsSnapshot(db, reason, snapshotOptions);
    replaceProjects(db, rows, currentProjectId);
  });
  transaction();
  return readProjects(db);
}

export function listProjectSnapshots(db) {
  const snapshots = db.prepare('SELECT id, revision, createdAt, reason, summary FROM project_snapshots ORDER BY id DESC').all()
    .map(({ summary, ...snapshot }) => ({ ...snapshot, projects: JSON.parse(summary) }));
  return { snapshots };
}

export function readProjectSnapshot(db, snapshotId) {
  const snapshot = db.prepare('SELECT id, revision, createdAt, reason, data FROM project_snapshots WHERE id = ?').get(Number(snapshotId));
  if (!snapshot) throw new NotFoundError(`No existe el snapshot ${snapshotId}`);
  const { data, ...meta } = snapshot;
  return { ...meta, ...JSON.parse(data) };
}

// Restaurar es una escritura deliberada: no exige baseRevision, pero antes
// respalda el estado actual (así una restauración equivocada también se deshace)
// e incrementa la revisión para que las pestañas abiertas se enteren.
export function restoreProjectSnapshot(db, snapshotId, options = {}) {
  const snapshotOptions = { ...DEFAULT_SNAPSHOT_OPTIONS, ...options };
  const transaction = db.transaction(() => {
    const snapshot = readProjectSnapshot(db, snapshotId);
    if (storedProjectRows(db).length) takeProjectsSnapshot(db, `before_restore:${snapshot.id}`, snapshotOptions);
    replaceProjects(db, projectRows(snapshot.projects), snapshot.currentProjectId || snapshot.projects[0]?.id || null);
  });
  transaction();
  return readProjects(db);
}

export function readCategoriesRevision(db) {
  return readRevision(db, 'categoriesRevision');
}

export function readCategories(db) {
  const categories = db.prepare('SELECT id, name, color, icon FROM categories ORDER BY name COLLATE NOCASE').all();
  return { categories, isEmpty: categories.length === 0, revision: readCategoriesRevision(db) };
}

export function writeCategories(db, body) {
  const categories = Array.isArray(body?.categories) ? body.categories : null;
  if (!categories) throw new Error('categories debe ser un array');

  const rows = categories.map((category) => {
    if (!category?.id || !category?.name || !category?.color) throw new Error('cada categoría necesita id, name y color');
    return { id: category.id, name: category.name, color: category.color, icon: category.icon || 'fa-solid fa-tag' };
  });
  const byId = (a, b) => a.id.localeCompare(b.id);
  const transaction = db.transaction(() => {
    const stored = db.prepare('SELECT id, name, color, icon FROM categories').all().sort(byId);
    if (JSON.stringify(stored) === JSON.stringify([...rows].sort(byId))) return;

    assertBaseRevision(db, 'categoriesRevision', body.baseRevision, readCategories);
    db.prepare('DELETE FROM categories').run();
    const insert = db.prepare('INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)');
    rows.forEach((row) => insert.run(row.id, row.name, row.color, row.icon));
    writeMetadata(db, 'categoriesRevision', readCategoriesRevision(db) + 1);
  });
  transaction();
  return readCategories(db);
}
