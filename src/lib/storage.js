import { normalizeLoadedData, makeExampleData } from '../domain/tree.js';
import { makeProject, projectNameFromData } from '../domain/project.js';
import { DEFAULT_CATEGORY_ICON } from './color.js';

export const STORAGE_KEY = 'gbi-creator-data-v1';
export const PROJECTS_STORAGE_KEY = 'gbi-creator-projects-v1';
export const CURRENT_PROJECT_KEY = 'gbi-creator-current-project-v1';
export const CATEGORIES_STORAGE_KEY = 'gbi-creator-categories-v1';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '';

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const error = new Error(details.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.details = details;
    throw error;
  }
  return response.json();
}

function normalizeProjects(projects) {
  return projects
    .filter((project) => project?.id && project?.data)
    .map((project) => ({
      ...project,
      name: project.name || projectNameFromData(project.data),
      updatedAt: project.updatedAt || new Date().toISOString(),
      data: normalizeLoadedData(project.data),
    }));
}

function normalizeProjectState(payload) {
  const projects = normalizeProjects(payload?.projects || []);
  const currentProjectId = projects.some((project) => project.id === payload?.currentProjectId)
    ? payload.currentProjectId
    : projects[0]?.id;
  return { projects, currentProjectId, revision: Number(payload?.revision || 0) };
}

// Un 409 trae el estado vigente del servidor; se adjunta como `conflict`
// ({ value, revision }) para que quien guarda decida sin perder sus cambios.
function withConflict(error, toValue) {
  if (error.status === 409 && error.details?.current) {
    const current = error.details.current;
    error.conflict = { value: toValue(current), revision: Number(current.revision || 0) };
  }
  return error;
}

function normalizeCategories(categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter((category) => category?.id && category?.name && category?.color)
    .map((category) => ({ ...category, icon: category.icon || DEFAULT_CATEGORY_ICON }));
}

function hasBrowserStorage() {
  return typeof localStorage !== 'undefined';
}

function readLocalJson(key) {
  if (!hasBrowserStorage()) return null;
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  return JSON.parse(saved);
}

function loadLegacyData() {
  const saved = readLocalJson(STORAGE_KEY);
  return saved ? normalizeLoadedData(saved) : makeExampleData();
}

export function hasLegacyProjectState() {
  if (!hasBrowserStorage()) return false;
  return !!localStorage.getItem(PROJECTS_STORAGE_KEY) || !!localStorage.getItem(STORAGE_KEY);
}

export function hasLegacyCategories() {
  if (!hasBrowserStorage()) return false;
  return !!localStorage.getItem(CATEGORIES_STORAGE_KEY);
}

export function loadLegacyProjectState() {
  try {
    const parsed = readLocalJson(PROJECTS_STORAGE_KEY);
    if (Array.isArray(parsed)) {
      const projects = normalizeProjects(parsed);
      const savedCurrentId = hasBrowserStorage() ? localStorage.getItem(CURRENT_PROJECT_KEY) : null;
      const currentProjectId = projects.some((project) => project.id === savedCurrentId)
        ? savedCurrentId
        : projects[0]?.id;
      if (projects.length && currentProjectId) return { projects, currentProjectId };
    }
  } catch (error) {
    console.warn('No se pudieron leer los proyectos locales legados, se migra desde el guardado anterior.', error);
  }

  const legacyData = loadLegacyData();
  const initialProject = makeProject(projectNameFromData(legacyData), legacyData);
  return { projects: [initialProject], currentProjectId: initialProject.id };
}

export function loadLegacyCategories() {
  try {
    return normalizeCategories(readLocalJson(CATEGORIES_STORAGE_KEY));
  } catch (error) {
    console.warn('No se pudieron leer las categorías locales legadas.', error);
    return [];
  }
}

export function makeInitialProjectState() {
  const data = makeExampleData();
  const project = makeProject(projectNameFromData(data), data);
  return { projects: [project], currentProjectId: project.id };
}

export async function loadProjectState({ shouldImportLegacy = () => false } = {}) {
  const payload = await requestJson('/api/projects');
  if (payload.isEmpty && hasLegacyProjectState() && await shouldImportLegacy()) {
    const legacyState = loadLegacyProjectState();
    const saved = await saveProjectState(legacyState, payload.revision);
    return { ...legacyState, revision: saved.revision };
  }

  const normalized = normalizeProjectState(payload);
  return normalized.projects.length ? normalized : { ...makeInitialProjectState(), revision: normalized.revision };
}

export async function saveProjectState({ projects, currentProjectId }, baseRevision) {
  try {
    const payload = await requestJson('/api/projects', {
      method: 'PUT',
      body: JSON.stringify({ projects, currentProjectId, baseRevision }),
    });
    return normalizeProjectState(payload);
  } catch (error) {
    throw withConflict(error, (current) => {
      const { projects: currentProjects, currentProjectId: currentId } = normalizeProjectState(current);
      return { projects: currentProjects, currentProjectId: currentId };
    });
  }
}

export async function fetchProjectsRevision() {
  const payload = await requestJson('/api/projects/revision');
  return Number(payload.revision || 0);
}

export async function loadCategories({ shouldImportLegacy = () => false } = {}) {
  const payload = await requestJson('/api/categories');
  if (payload.isEmpty && hasLegacyCategories() && await shouldImportLegacy()) {
    const legacyCategories = loadLegacyCategories();
    const saved = await saveCategories(legacyCategories, payload.revision);
    return { categories: legacyCategories, revision: saved.revision };
  }
  return { categories: normalizeCategories(payload.categories), revision: Number(payload.revision || 0) };
}

export async function saveCategories(categories, baseRevision) {
  try {
    const payload = await requestJson('/api/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories, baseRevision }),
    });
    return { categories: normalizeCategories(payload.categories), revision: Number(payload.revision || 0) };
  } catch (error) {
    throw withConflict(error, (current) => normalizeCategories(current.categories));
  }
}

export async function fetchCategoriesRevision() {
  const payload = await requestJson('/api/categories/revision');
  return Number(payload.revision || 0);
}
