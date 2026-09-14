import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const databasePath = process.env.GBI_DATABASE_PATH || 'data/gbi-creator.sqlite';
mkdirSync(path.dirname(databasePath), { recursive: true });

const app = createApp({ databasePath });
app.listen(port, () => {
  console.log(`GBICreator escuchando en http://localhost:${port}`);
});
