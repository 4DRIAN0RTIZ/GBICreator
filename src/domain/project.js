import { genId, normalizeLoadedData, makeBlankData } from './tree.js';

export function makeProject(name, data = makeBlankData()) {
  return {
    id: genId(),
    name,
    updatedAt: new Date().toISOString(),
    data: normalizeLoadedData(data),
  };
}

export function projectNameFromData(data) {
  const title = data.aplicacionValorSuperior?.trim();
  if (!title) return 'Proyecto inicial';
  return title.length > 42 ? `${title.slice(0, 42)}…` : title;
}
