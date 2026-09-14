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
    throw new Error(details.error || `HTTP ${response.status}`);
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
  return { projects, currentProjectId };
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
  if (payload.isEmpty && hasLegacyProjectState() && shouldImportLegacy()) {
    const legacyState = loadLegacyProjectState();
    await saveProjectState(legacyState);
    return legacyState;
  }

  const normalized = normalizeProjectState(payload);
  return normalized.projects.length ? normalized : makeInitialProjectState();
}

export async function saveProjectState({ projects, currentProjectId }) {
  const payload = await requestJson('/api/projects', {
    method: 'PUT',
    body: JSON.stringify({ projects, currentProjectId }),
  });
  return normalizeProjectState(payload);
}

export async function loadCategories({ shouldImportLegacy = () => false } = {}) {
  const payload = await requestJson('/api/categories');
  if (payload.isEmpty && hasLegacyCategories() && shouldImportLegacy()) {
    const legacyCategories = loadLegacyCategories();
    await saveCategories(legacyCategories);
    return legacyCategories;
  }
  return normalizeCategories(payload.categories);
}

export async function saveCategories(categories) {
  const payload = await requestJson('/api/categories', {
    method: 'PUT',
    body: JSON.stringify({ categories }),
  });
  return normalizeCategories(payload.categories);
}
