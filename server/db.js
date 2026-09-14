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
  `);
  const projectColumns = db.prepare('PRAGMA table_info(projects)').all().map((column) => column.name);
  if (!projectColumns.includes('position')) {
    db.exec('ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
  }
  return db;
}

export function readProjects(db) {
  const projects = db.prepare('SELECT id, name, updatedAt, data FROM projects ORDER BY position ASC, updatedAt DESC').all()
    .map((project) => ({ ...project, data: JSON.parse(project.data) }));
  const currentProjectId = db.prepare('SELECT value FROM metadata WHERE key = ?').get('currentProjectId')?.value || projects[0]?.id || null;
  return { projects, currentProjectId, isEmpty: projects.length === 0 };
}

export function writeProjects(db, body) {
  const projects = Array.isArray(body?.projects) ? body.projects : null;
  if (!projects) throw new Error('projects debe ser un array');

  const currentProjectId = body.currentProjectId || projects[0]?.id || null;
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM projects').run();
    const insert = db.prepare('INSERT INTO projects (id, name, updatedAt, data, position) VALUES (?, ?, ?, ?, ?)');
    projects.forEach((project, index) => {
      if (!project?.id || !project?.data) throw new Error('cada proyecto necesita id y data');
      insert.run(
        project.id,
        project.name || 'Proyecto sin nombre',
        project.updatedAt || new Date().toISOString(),
        JSON.stringify(project.data),
        index,
      );
    });
    db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('currentProjectId', currentProjectId);
  });
  transaction();
  return readProjects(db);
}

export function readCategories(db) {
  const categories = db.prepare('SELECT id, name, color, icon FROM categories ORDER BY name COLLATE NOCASE').all();
  return { categories, isEmpty: categories.length === 0 };
}

export function writeCategories(db, body) {
  const categories = Array.isArray(body?.categories) ? body.categories : null;
  if (!categories) throw new Error('categories debe ser un array');

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM categories').run();
    const insert = db.prepare('INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)');
    categories.forEach((category) => {
      if (!category?.id || !category?.name || !category?.color) throw new Error('cada categoría necesita id, name y color');
      insert.run(category.id, category.name, category.color, category.icon || 'fa-solid fa-tag');
    });
  });
  transaction();
  return readCategories(db);
}
