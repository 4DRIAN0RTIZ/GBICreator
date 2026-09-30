import { useEffect, useRef, useState } from 'react';
import { fetchCategoriesRevision, loadCategories, saveCategories } from '../lib/storage.js';
import { createSyncController } from '../lib/syncController.js';
import { showConfirm } from '../lib/dialogs.js';
import { useRemotePolling } from './useRemotePolling.js';
import { genId } from '../domain/tree.js';
import { DEFAULT_CATEGORY_ICON } from '../lib/color.js';

export function useCategories(setSaveStatus) {
  const [categories, setCategories] = useState([]);

  const [hasConflict, setHasConflict] = useState(false);
  const syncRef = useRef(null);
  const appliedCategoriesRef = useRef(null);

  useEffect(() => {
    const toSyncResult = ({ categories: loadedCategories, revision }) => ({ value: loadedCategories, revision });
    const applyRemote = (remoteCategories) => {
      appliedCategoriesRef.current = remoteCategories;
      setCategories(remoteCategories);
      setHasConflict(false);
    };

    const sync = createSyncController({
      load: async () => toSyncResult(await loadCategories({
        shouldImportLegacy: () => showConfirm({
          title: 'Importar categorías locales',
          text: 'Hay categorías guardadas en este navegador y el backend está vacío. ¿Quieres importarlas a la base compartida?',
          icon: 'info',
          confirmText: 'Importar',
          cancelText: 'No importar',
        }),
      })),
      reload: async () => toSyncResult(await loadCategories()),
      save: saveCategories,
      fetchRevision: fetchCategoriesRevision,
      onLoaded: applyRemote,
      onRemoteChange: applyRemote,
      onConflict: () => {
        setHasConflict(true);
        setSaveStatus('Conflicto: las categorías cambiaron en el servidor. Tus cambios no se han guardado.');
      },
      onLoadError: () => setSaveStatus('No se pudieron cargar las categorías desde el backend. Reintentando… (los cambios no se guardarán hasta reconectar)'),
      onSaveError: () => setSaveStatus('No se pudieron guardar las categorías en el backend (red o servidor no disponible). Se reintentará.'),
    });
    syncRef.current = sync;
    sync.start();
    return () => sync.stop();
  }, [setSaveStatus]);

  useRemotePolling(syncRef);

  useEffect(() => {
    if (appliedCategoriesRef.current === categories) return;
    syncRef.current?.localChange(categories);
  }, [categories]);

  const reloadFromServer = () => syncRef.current?.resolveWithServer();

  const overwriteServer = async () => {
    const confirmed = await showConfirm({
      title: 'Sobrescribir categorías',
      text: '¿Sobrescribir las categorías del servidor con las tuyas? Los cambios que hizo otra persona se reemplazarán.',
      confirmText: 'Sobrescribir',
    });
    if (!confirmed) return;
    setHasConflict(false);
    syncRef.current?.resolveWithLocal();
  };

  const addCategory = (name, color, icon) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCategories((current) => [...current, { id: genId(), name: trimmed, color, icon: icon || DEFAULT_CATEGORY_ICON }]);
  };

  const updateCategory = (id, patch) => {
    setCategories((current) => current.map((category) => (category.id === id ? { ...category, ...patch } : category)));
  };

  const removeCategory = (id) => {
    setCategories((current) => current.filter((item) => item.id !== id));
  };

  return { categories, hasConflict, reloadFromServer, overwriteServer, addCategory, updateCategory, removeCategory };
}
