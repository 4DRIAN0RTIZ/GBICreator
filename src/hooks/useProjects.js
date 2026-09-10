import { useEffect, useMemo, useState } from 'react';
import { cloneData, makeBlankData, normalizeLoadedData, clearCategoryRecursive } from '../domain/tree.js';
import { makeProject } from '../domain/project.js';
import {
  loadProjectState,
  STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
  CURRENT_PROJECT_KEY,
} from '../lib/storage.js';

export function useProjects(setSaveStatus) {
  const initialProjectState = useMemo(loadProjectState, []);
  const [projects, setProjects] = useState(initialProjectState.projects);
  const [currentProjectId, setCurrentProjectId] = useState(initialProjectState.currentProjectId);
  const currentProject = projects.find((project) => project.id === currentProjectId) || projects[0];
  const data = currentProject?.data || makeBlankData();

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
      localStorage.setItem(CURRENT_PROJECT_KEY, currentProjectId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveStatus(`Guardado localmente ${new Date().toLocaleTimeString()}`);
    } catch (_error) {
      setSaveStatus('No se pudo autoguardar (localStorage lleno o bloqueado)');
    }
  }, [projects, currentProjectId, data, setSaveStatus]);

  const mutateData = (mutator) => {
    setProjects((currentProjects) => currentProjects.map((project) => {
      if (project.id !== currentProjectId) return project;
      const nextData = cloneData(project.data);
      mutator(nextData);
      return { ...project, data: nextData, updatedAt: new Date().toISOString() };
    }));
  };

  const replaceCurrentProjectData = (nextData) => {
    setProjects((currentProjects) => currentProjects.map((project) => (
      project.id === currentProjectId
        ? { ...project, data: normalizeLoadedData(nextData), updatedAt: new Date().toISOString() }
        : project
    )));
  };

  const createProject = () => {
    const defaultName = `Proyecto ${projects.length + 1}`;
    const name = prompt('Nombre del nuevo proyecto:', defaultName);
    if (name === null) return;
    const project = makeProject(name.trim() || defaultName, makeBlankData());
    setProjects((currentProjects) => [...currentProjects, project]);
    setCurrentProjectId(project.id);
  };

  const switchProject = (projectId) => {
    setCurrentProjectId(projectId);
  };

  const renameProject = () => {
    const name = prompt('Nuevo nombre del proyecto:', currentProject?.name || 'Proyecto');
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    setProjects((currentProjects) => currentProjects.map((project) => (
      project.id === currentProjectId
        ? { ...project, name: cleanName, updatedAt: new Date().toISOString() }
        : project
    )));
  };

  const clearCategoryEverywhere = (categoryId) => {
    setProjects((currentProjects) => currentProjects.map((project) => {
      const nextData = cloneData(project.data);
      clearCategoryRecursive(nextData, categoryId);
      nextData.sueltos.forEach((loose) => clearCategoryRecursive(loose, categoryId));
      return { ...project, data: nextData };
    }));
  };

  const loadFile = (event, onLoaded) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        replaceCurrentProjectData(JSON.parse(ev.target.result));
        onLoaded?.();
      } catch (error) {
        alert(`El archivo no es un JSON válido: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return {
    projects,
    currentProjectId,
    currentProject,
    data,
    mutateData,
    replaceCurrentProjectData,
    createProject,
    switchProject,
    renameProject,
    clearCategoryEverywhere,
    loadFile,
  };
}
