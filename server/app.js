import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listProjectSnapshots,
  openDatabase,
  readCategories,
  readCategoriesRevision,
  readProjects,
  readProjectSnapshot,
  readProjectsRevision,
  restoreProjectSnapshot,
  writeCategories,
  writeProjects,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function snapshotOptionsFromEnv() {
  const options = {};
  if (process.env.GBI_SNAPSHOT_INTERVAL_MS) options.snapshotIntervalMs = Number(process.env.GBI_SNAPSHOT_INTERVAL_MS);
  if (process.env.GBI_SNAPSHOT_LIMIT) options.snapshotLimit = Number(process.env.GBI_SNAPSHOT_LIMIT);
  return options;
}

export function createApp({
  databasePath,
  db = openDatabase(databasePath),
  serveStatic = true,
  snapshotOptions = snapshotOptionsFromEnv(),
} = {}) {
  const app = express();
  app.locals.db = db;
  app.locals.snapshotOptions = snapshotOptions;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/projects', (req, res) => {
    res.json(readProjects(req.app.locals.db));
  });

  app.get('/api/projects/revision', (req, res) => {
    res.json({ revision: readProjectsRevision(req.app.locals.db) });
  });

  const saveProjects = asyncRoute((req, res) => {
    res.json(writeProjects(req.app.locals.db, req.body, req.app.locals.snapshotOptions));
  });
  app.put('/api/projects', saveProjects);
  app.post('/api/projects', saveProjects);

  app.get('/api/projects/snapshots', (req, res) => {
    res.json(listProjectSnapshots(req.app.locals.db));
  });

  app.get('/api/projects/snapshots/:id', (req, res) => {
    res.json(readProjectSnapshot(req.app.locals.db, req.params.id));
  });

  app.post('/api/projects/snapshots/:id/restore', (req, res) => {
    res.json(restoreProjectSnapshot(req.app.locals.db, req.params.id, req.app.locals.snapshotOptions));
  });

  app.get('/api/categories', (req, res) => {
    res.json(readCategories(req.app.locals.db));
  });

  app.get('/api/categories/revision', (req, res) => {
    res.json({ revision: readCategoriesRevision(req.app.locals.db) });
  });

  const saveCategories = asyncRoute((req, res) => {
    res.json(writeCategories(req.app.locals.db, req.body));
  });
  app.put('/api/categories', saveCategories);
  app.post('/api/categories', saveCategories);

  if (serveStatic) {
    app.use(express.static(distPath));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((error, req, res, _next) => {
    const body = { error: error.message || 'Error inesperado' };
    if (error.current) body.current = error.current;
    res.status(error.status || 400).json(body);
  });

  return app;
}
