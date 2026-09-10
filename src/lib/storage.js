import { normalizeLoadedData, makeExampleData } from '../domain/tree.js';
import { makeProject, projectNameFromData } from '../domain/project.js';
import { DEFAULT_CATEGORY_ICON } from './color.js';

export const STORAGE_KEY = 'gbi-creator-data-v1';
export const PROJECTS_STORAGE_KEY = 'gbi-creator-projects-v1';
export const CURRENT_PROJECT_KEY = 'gbi-creator-current-project-v1';
export const CATEGORIES_STORAGE_KEY = 'gbi-creator-categories-v1';

function loadLegacyData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return normalizeLoadedData(JSON.parse(saved));
    } catch (error) {
      console.warn('No se pudo leer el guardado local, se usa ejemplo por defecto.', error);
    }
  }
  return makeExampleData();
}

export function loadProjectState() {
  const savedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (savedProjects) {
    try {
      const parsed = JSON.parse(savedProjects);
      const projects = parsed
        .filter((project) => project?.id && project?.data)
        .map((project) => ({
          ...project,
          name: project.name || projectNameFromData(project.data),
          updatedAt: project.updatedAt || new Date().toISOString(),
          data: normalizeLoadedData(project.data),
        }));
      const savedCurrentId = localStorage.getItem(CURRENT_PROJECT_KEY);
      const currentProjectId = projects.some((project) => project.id === savedCurrentId)
        ? savedCurrentId
        : projects[0]?.id;
      if (projects.length && currentProjectId) return { projects, currentProjectId };
    } catch (error) {
      console.warn('No se pudieron leer los proyectos guardados, se migra desde el guardado anterior.', error);
    }
  }

  const legacyData = loadLegacyData();
  const initialProject = makeProject(projectNameFromData(legacyData), legacyData);
  return { projects: [initialProject], currentProjectId: initialProject.id };
}

export function loadCategories() {
  const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((category) => category?.id && category?.name && category?.color)
          .map((category) => ({ ...category, icon: category.icon || DEFAULT_CATEGORY_ICON }));
      }
    } catch (error) {
      console.warn('No se pudieron leer las categorías guardadas.', error);
    }
  }
  return [];
}
