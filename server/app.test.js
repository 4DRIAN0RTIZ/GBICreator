import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

describe('API de persistencia', () => {
  it('persiste proyectos con POST y los recupera con GET', async () => {
    const project = {
      id: 'p1',
      name: 'Proyecto compartido',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: { id: 'root', isRoot: true, aplicacionValorSuperior: 'AVS', intencionSuperior: '', hijos: [], sueltos: [] },
    };

    await request(app)
      .post('/api/projects')
      .send({ projects: [project], currentProjectId: 'p1' })
      .expect(200);

    const response = await request(app).get('/api/projects').expect(200);

    expect(response.body).toEqual({ projects: [project], currentProjectId: 'p1', isEmpty: false });
  });

  it('persiste categorías con POST y las recupera con GET', async () => {
    const category = { id: 'c1', name: 'Riesgo', color: '#e11d48', icon: 'fa-solid fa-shield' };

    await request(app)
      .post('/api/categories')
      .send({ categories: [category] })
      .expect(200);

    const response = await request(app).get('/api/categories').expect(200);

    expect(response.body).toEqual({ categories: [category], isEmpty: false });
  });
});
