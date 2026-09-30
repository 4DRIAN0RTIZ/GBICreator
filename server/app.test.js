import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

let tempDir;
let app;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(os.tmpdir(), 'gbi-creator-'));
  app = createApp({ databasePath: path.join(tempDir, 'test.sqlite'), serveStatic: false });
});

afterEach(() => {
  app.locals.db.close();
  rmSync(tempDir, { recursive: true, force: true });
});

const project = {
  id: 'p1',
  name: 'Proyecto compartido',
  updatedAt: '2026-01-01T00:00:00.000Z',
  data: { id: 'root', isRoot: true, aplicacionValorSuperior: 'AVS', intencionSuperior: '', hijos: [], sueltos: [] },
};

function withName(name) {
  return { ...project, name };
}

describe('API de persistencia', () => {
  it('persiste proyectos con POST y los recupera con GET', async () => {
    await request(app)
      .post('/api/projects')
      .send({ projects: [project], currentProjectId: 'p1', baseRevision: 0 })
      .expect(200);

    const response = await request(app).get('/api/projects').expect(200);

    expect(response.body).toEqual({ projects: [project], currentProjectId: 'p1', isEmpty: false, revision: 1 });
  });

  it('persiste categorías con POST y las recupera con GET', async () => {
    const category = { id: 'c1', name: 'Riesgo', color: '#e11d48', icon: 'fa-solid fa-shield' };

    await request(app)
      .post('/api/categories')
      .send({ categories: [category], baseRevision: 0 })
      .expect(200);

    const response = await request(app).get('/api/categories').expect(200);

    expect(response.body).toEqual({ categories: [category], isEmpty: false, revision: 1 });
  });
});

describe('revisión optimista de proyectos', () => {
  it('expone la revisión actual en /api/projects/revision', async () => {
    await request(app).put('/api/projects').send({ projects: [project], currentProjectId: 'p1', baseRevision: 0 }).expect(200);

    const response = await request(app).get('/api/projects/revision').expect(200);

    expect(response.body).toEqual({ revision: 1 });
  });

  it('rechaza con 409 y devuelve el estado actual cuando baseRevision está desfasada', async () => {
    await request(app).put('/api/projects').send({ projects: [project], currentProjectId: 'p1', baseRevision: 0 }).expect(200);
    await request(app).put('/api/projects').send({ projects: [withName('Pestaña A')], currentProjectId: 'p1', baseRevision: 1 }).expect(200);

    const response = await request(app)
      .put('/api/projects')
      .send({ projects: [withName('Pestaña B vieja')], currentProjectId: 'p1', baseRevision: 1 })
      .expect(409);

    expect(response.body.current.revision).toBe(2);
    expect(response.body.current.projects[0].name).toBe('Pestaña A');
    const stored = await request(app).get('/api/projects').expect(200);
    expect(stored.body.projects[0].name).toBe('Pestaña A');
  });

  it('rechaza con 409 un guardado con cambios que no declara baseRevision', async () => {
    await request(app).put('/api/projects').send({ projects: [project], currentProjectId: 'p1' }).expect(409);
  });

  it('acepta sin incrementar la revisión un guardado idéntico a lo almacenado', async () => {
    await request(app).put('/api/projects').send({ projects: [project], currentProjectId: 'p1', baseRevision: 0 }).expect(200);

    const response = await request(app)
      .put('/api/projects')
      .send({ projects: [project], currentProjectId: 'p1', baseRevision: 0 })
      .expect(200);

    expect(response.body.revision).toBe(1);
  });
});

describe('revisión optimista de categorías', () => {
  it('rechaza con 409 cuando baseRevision está desfasada', async () => {
    const category = { id: 'c1', name: 'Riesgo', color: '#e11d48', icon: 'fa-solid fa-shield' };
    await request(app).put('/api/categories').send({ categories: [category], baseRevision: 0 }).expect(200);

    const response = await request(app)
      .put('/api/categories')
      .send({ categories: [{ ...category, name: 'Otro' }], baseRevision: 0 })
      .expect(409);

    expect(response.body.current).toEqual({ categories: [category], isEmpty: false, revision: 1 });
    const revision = await request(app).get('/api/categories/revision').expect(200);
    expect(revision.body).toEqual({ revision: 1 });
  });
});

describe('snapshots de proyectos', () => {
  let clock;
  let snapshotApp;

  function createSnapshotApp(options = {}) {
    clock = new Date('2026-09-30T10:00:00.000Z');
    snapshotApp = createApp({
      databasePath: path.join(tempDir, 'snapshots.sqlite'),
      serveStatic: false,
      snapshotOptions: { snapshotIntervalMs: 5 * 60 * 1000, snapshotLimit: 100, now: () => clock, ...options },
    });
    return snapshotApp;
  }

  afterEach(() => {
    snapshotApp?.locals.db.close();
    snapshotApp = null;
  });

  async function put(target, projects, baseRevision) {
    const response = await request(target).put('/api/projects').send({ projects, currentProjectId: projects[0]?.id, baseRevision }).expect(200);
    return response.body.revision;
  }

  it('no crea snapshot en la primera escritura sobre una base vacía', async () => {
    const target = createSnapshotApp();
    await put(target, [project], 0);

    const response = await request(target).get('/api/projects/snapshots').expect(200);

    expect(response.body.snapshots).toEqual([]);
  });

  it('respalda el estado previo y limita los snapshots por tiempo', async () => {
    const target = createSnapshotApp();
    let revision = await put(target, [project], 0);
    revision = await put(target, [withName('Edición 1')], revision);
    revision = await put(target, [withName('Edición 2')], revision);

    let response = await request(target).get('/api/projects/snapshots').expect(200);
    expect(response.body.snapshots).toHaveLength(1);
    expect(response.body.snapshots[0]).toMatchObject({ revision: 1, reason: 'interval', projects: [{ id: 'p1', name: 'Proyecto compartido' }] });

    clock = new Date('2026-09-30T10:06:00.000Z');
    await put(target, [withName('Edición 3')], revision);

    response = await request(target).get('/api/projects/snapshots').expect(200);
    expect(response.body.snapshots).toHaveLength(2);
    expect(response.body.snapshots[0].projects[0].name).toBe('Edición 2');
  });

  it('respalda siempre cuando una escritura elimina proyectos', async () => {
    const target = createSnapshotApp();
    const otherProject = { ...project, id: 'p2', name: 'Otro' };
    let revision = await put(target, [project, otherProject], 0);
    revision = await put(target, [withName('Edición'), otherProject], revision);
    await put(target, [withName('Edición')], revision);

    const response = await request(target).get('/api/projects/snapshots').expect(200);

    expect(response.body.snapshots[0].reason).toBe('project_removed');
    expect(response.body.snapshots[0].projects.map((item) => item.id)).toEqual(['p1', 'p2']);
  });

  it('conserva solo los últimos snapshotLimit snapshots', async () => {
    const target = createSnapshotApp({ snapshotIntervalMs: 0, snapshotLimit: 2 });
    let revision = await put(target, [project], 0);
    for (const name of ['A', 'B', 'C', 'D']) {
      revision = await put(target, [withName(name)], revision);
    }

    const response = await request(target).get('/api/projects/snapshots').expect(200);

    expect(response.body.snapshots.map((snapshot) => snapshot.projects[0].name)).toEqual(['C', 'B']);
  });

  it('restaura un snapshot, respalda el estado previo e incrementa la revisión', async () => {
    const target = createSnapshotApp();
    let revision = await put(target, [project], 0);
    revision = await put(target, [withName('Borrador equivocado')], revision);
    const [snapshot] = (await request(target).get('/api/projects/snapshots').expect(200)).body.snapshots;

    const detail = await request(target).get(`/api/projects/snapshots/${snapshot.id}`).expect(200);
    expect(detail.body.projects[0].name).toBe('Proyecto compartido');

    const restored = await request(target).post(`/api/projects/snapshots/${snapshot.id}/restore`).expect(200);

    expect(restored.body.projects[0].name).toBe('Proyecto compartido');
    expect(restored.body.revision).toBe(revision + 1);
    const after = (await request(target).get('/api/projects/snapshots').expect(200)).body.snapshots;
    expect(after[0]).toMatchObject({ reason: `before_restore:${snapshot.id}`, projects: [{ name: 'Borrador equivocado' }] });
  });

  it('responde 404 para un snapshot inexistente', async () => {
    const target = createSnapshotApp();
    await request(target).get('/api/projects/snapshots/999').expect(404);
    await request(target).post('/api/projects/snapshots/999/restore').expect(404);
  });
});

describe('compatibilidad con bases existentes', () => {
  it('conserva proyectos y categorías de una base creada con el esquema anterior', async () => {
    const databasePath = path.join(tempDir, 'legacy.sqlite');
    const legacyDb = new Database(databasePath);
    legacyDb.exec(`
      CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, updatedAt TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, icon TEXT NOT NULL);
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT);
    `);
    legacyDb.prepare('INSERT INTO projects VALUES (?, ?, ?, ?)').run(project.id, project.name, project.updatedAt, JSON.stringify(project.data));
    legacyDb.prepare('INSERT INTO categories VALUES (?, ?, ?, ?)').run('c1', 'Riesgo', '#e11d48', 'fa-solid fa-shield');
    legacyDb.prepare('INSERT INTO metadata VALUES (?, ?)').run('currentProjectId', 'p1');
    legacyDb.close();

    const legacyApp = createApp({ databasePath, serveStatic: false });
    try {
      const projects = await request(legacyApp).get('/api/projects').expect(200);
      const categories = await request(legacyApp).get('/api/categories').expect(200);

      expect(projects.body).toEqual({ projects: [project], currentProjectId: 'p1', isEmpty: false, revision: 0 });
      expect(categories.body).toEqual({ categories: [{ id: 'c1', name: 'Riesgo', color: '#e11d48', icon: 'fa-solid fa-shield' }], isEmpty: false, revision: 0 });

      await request(legacyApp).put('/api/projects').send({ projects: [], currentProjectId: null }).expect(409);
      const afterStaleWrite = await request(legacyApp).get('/api/projects').expect(200);
      expect(afterStaleWrite.body.projects).toEqual([project]);
    } finally {
      legacyApp.locals.db.close();
    }
  });
});
