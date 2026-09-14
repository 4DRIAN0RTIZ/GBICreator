import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATEGORIES_STORAGE_KEY,
  CURRENT_PROJECT_KEY,
  PROJECTS_STORAGE_KEY,
  loadCategories,
  loadProjectState,
  saveCategories,
  saveProjectState,
} from './storage.js';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, value) => store.set(key, value)),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.localStorage;
  delete globalThis.fetch;
});

describe('storage API', () => {
  it('carga y normaliza proyectos desde el backend', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      projects: [{
        id: 'p1',
        name: '',
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: { aplicacionValorSuperior: 'Gobierno TI', hijos: [{ id: 'n1', titulo: 'Nodo' }] },
      }],
      currentProjectId: 'p1',
      isEmpty: false,
    }));

    const state = await loadProjectState();

    expect(fetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }));
    expect(state.currentProjectId).toBe('p1');
    expect(state.projects[0].name).toBe('Gobierno TI');
    expect(state.projects[0].data.sueltos).toEqual([]);
  });

  it('ofrece importar proyectos legados cuando el backend está vacío', async () => {
    const legacyProject = {
      id: 'legacy-p1',
      name: 'Local',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: { id: 'root', isRoot: true, aplicacionValorSuperior: 'Local', intencionSuperior: '', hijos: [], sueltos: [] },
    };
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([legacyProject]));
    localStorage.setItem(CURRENT_PROJECT_KEY, 'legacy-p1');
    fetch
      .mockResolvedValueOnce(jsonResponse({ projects: [], currentProjectId: null, isEmpty: true }))
      .mockResolvedValueOnce(jsonResponse({ projects: [legacyProject], currentProjectId: 'legacy-p1', isEmpty: false }));

    const state = await loadProjectState({ shouldImportLegacy: () => true });

    expect(fetch).toHaveBeenLastCalledWith('/api/projects', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ projects: [legacyProject], currentProjectId: 'legacy-p1' }),
    }));
    expect(state.projects[0].id).toBe('legacy-p1');
  });

  it('guarda proyectos en el backend y propaga errores HTTP', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ error: 'falló' }, false, 500));

    await expect(saveProjectState({ projects: [], currentProjectId: null })).rejects.toThrow('falló');
  });

  it('carga, migra y guarda categorías mediante la API', async () => {
    const category = { id: 'c1', name: 'Riesgo', color: '#e11d48', icon: 'fa-solid fa-shield' };
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify([category]));
    fetch
      .mockResolvedValueOnce(jsonResponse({ categories: [], isEmpty: true }))
      .mockResolvedValueOnce(jsonResponse({ categories: [category], isEmpty: false }))
      .mockResolvedValueOnce(jsonResponse({ categories: [category], isEmpty: false }));

    const loaded = await loadCategories({ shouldImportLegacy: () => true });
    const saved = await saveCategories(loaded);

    expect(loaded).toEqual([category]);
    expect(saved).toEqual([category]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
