import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, readCategories, readProjects, writeCategories, writeProjects } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function createApp({ databasePath, db = openDatabase(databasePath), serveStatic = true } = {}) {
  const app = express();
  app.locals.db = db;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/projects', (req, res) => {
    res.json(readProjects(req.app.locals.db));
  });

  const saveProjects = asyncRoute((req, res) => {
    res.json(writeProjects(req.app.locals.db, req.body));
  });
  app.put('/api/projects', saveProjects);
  app.post('/api/projects', saveProjects);

  app.get('/api/categories', (req, res) => {
    res.json(readCategories(req.app.locals.db));
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
    res.status(400).json({ error: error.message || 'Error inesperado' });
  });

  return app;
}
