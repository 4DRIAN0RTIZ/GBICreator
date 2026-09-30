import { useEffect, useMemo, useRef, useState } from 'react';
import { cloneData, makeBlankData, normalizeLoadedData, clearCategoryRecursive } from '../domain/tree.js';
import { makeProject } from '../domain/project.js';
import { fetchProjectsRevision, loadProjectState, makeInitialProjectState, saveProjectState } from '../lib/storage.js';
import { createSyncController } from '../lib/syncController.js';
import { showAlert, showConfirm, showPrompt } from '../lib/dialogs.js';
import { useRemotePolling } from './useRemotePolling.js';

export function useProjects(setSaveStatus) {
  const initialProjectState = useMemo(makeInitialProjectState, []);
  const [projects, setProjects] = useState(initialProjectState.projects);
  const [currentProjectId, setCurrentProjectId] = useState(initialProjectState.currentProjectId);
  const currentProject = projects.find((project) => project.id === currentProjectId) || projects[0];
  const data = currentProject?.data || makeBlankData();

  const [hasConflict, setHasConflict] = useState(false);
  const syncRef = useRef(null);
  const appliedStateRef = useRef(null);
  const currentProjectIdRef = useRef(currentProjectId);
  currentProjectIdRef.current = currentProjectId;

  useEffect(() => {
    const toSyncResult = ({ projects: loadedProjects, currentProjectId: loadedId, revision }) => ({
      value: { projects: loadedProjects, currentProjectId: loadedId },
      revision,
    });
    // Un cambio remoto no debe cambiarle el proyecto abierto a quien está
    // trabajando: se conserva la selección local si el proyecto sigue existiendo.
    const applyRemote = (state) => {
      const localId = currentProjectIdRef.current;
      const keptId = state.projects.some((project) => project.id === localId) ? localId : state.currentProjectId;
      appliedStateRef.current = { projects: state.projects, currentProjectId: keptId };
      setProjects(state.projects);
      setCurrentProjectId(keptId);
      setHasConflict(false);
    };

    const sync = createSyncController({
      load: async () => toSyncResult(await loadProjectState({
        shouldImportLegacy: () => showConfirm({
          title: 'Importar proyectos locales',
          text: 'Hay proyectos guardados en este navegador y el backend está vacío. ¿Quieres importarlos a la base compartida?',
          icon: 'info',
          confirmText: 'Importar',
          cancelText: 'No importar',
        }),
      })),
      reload: async () => toSyncResult(await loadProjectState()),
      save: saveProjectState,
      fetchRevision: fetchProjectsRevision,
      onLoaded: (state) => {
        appliedStateRef.current = state;
        setProjects(state.projects);
        setCurrentProjectId(state.currentProjectId);
        setSaveStatus(`Datos cargados ${new Date().toLocaleTimeString()}`);
      },
      onRemoteChange: (state) => {
        applyRemote(state);
        setSaveStatus(`Cambios recibidos del servidor ${new Date().toLocaleTimeString()}`);
      },
      onConflict: () => {
        setHasConflict(true);
        setSaveStatus('Conflicto: los proyectos cambiaron en el servidor. Tus cambios no se han guardado.');
      },
      onLoadError: () => setSaveStatus('No se pudieron cargar los proyectos desde el backend. Reintentando… (los cambios no se guardarán hasta reconectar)'),
      onSaved: () => setSaveStatus(`Guardado ${new Date().toLocaleTimeString()}`),
      onSaveError: () => setSaveStatus('No se pudo autoguardar en el backend (red o servidor no disponible). Se reintentará.'),
      onRemoteError: () => setSaveStatus('No se pudo consultar el backend para buscar cambios (red o servidor no disponible)'),
    });
    syncRef.current = sync;
    sync.start();
    return () => sync.stop();
  }, [setSaveStatus]);

  useRemotePolling(syncRef);

  useEffect(() => {
    const applied = appliedStateRef.current;
    if (applied && applied.projects === projects && applied.currentProjectId === currentProjectId) return;
    syncRef.current?.localChange({ projects, currentProjectId });
  }, [projects, currentProjectId]);

  const reloadFromServer = () => syncRef.current?.resolveWithServer();

  const overwriteServer = async () => {
    const confirmed = await showConfirm({
      title: 'Sobrescribir proyectos',
      text: '¿Sobrescribir el servidor con tus cambios? Los cambios que hizo otra persona se reemplazarán (queda respaldo en snapshots).',
      confirmText: 'Sobrescribir',
    });
    if (!confirmed) return;
    setHasConflict(false);
    syncRef.current?.resolveWithLocal();
  };

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

  const createProject = async () => {
    const defaultName = `Proyecto ${projects.length + 1}`;
    const name = await showPrompt({ title: 'Nuevo proyecto', text: 'Nombre del nuevo proyecto:', defaultValue: defaultName, confirmText: 'Crear' });
    if (name === null) return;
    const project = makeProject(name.trim() || defaultName, makeBlankData());
    setProjects((currentProjects) => [...currentProjects, project]);
    setCurrentProjectId(project.id);
  };

  const switchProject = (projectId) => {
    setCurrentProjectId(projectId);
  };

  const renameProject = async () => {
    const name = await showPrompt({ title: 'Renombrar proyecto', text: 'Nuevo nombre del proyecto:', defaultValue: currentProject?.name || 'Proyecto', confirmText: 'Renombrar' });
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
        showAlert({ title: 'Archivo no válido', text: `El archivo no es un JSON válido: ${error.message}` });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return {
    projects,
    currentProjectId,
    hasConflict,
    reloadFromServer,
    overwriteServer,
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
