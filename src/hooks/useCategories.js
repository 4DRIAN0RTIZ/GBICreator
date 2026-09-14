import { useEffect, useState } from 'react';
import { loadCategories, saveCategories } from '../lib/storage.js';
import { genId } from '../domain/tree.js';
import { DEFAULT_CATEGORY_ICON } from '../lib/color.js';

export function useCategories(setSaveStatus) {
  const [categories, setCategories] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadCategories({
      shouldImportLegacy: () => window.confirm('Hay categorías guardadas en este navegador y el backend está vacío. ¿Quieres importarlas a la base compartida?'),
    })
      .then((loadedCategories) => {
        if (!active) return;
        setCategories(loadedCategories);
        setHasLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setHasLoaded(true);
        setSaveStatus('No se pudieron cargar las categorías desde el backend');
      });
    return () => {
      active = false;
    };
  }, [setSaveStatus]);

  useEffect(() => {
    if (!hasLoaded) return;
    let active = true;
    saveCategories(categories)
      .catch(() => {
        if (active) setSaveStatus('No se pudieron guardar las categorías en el backend (red o servidor no disponible)');
      });
    return () => {
      active = false;
    };
  }, [categories, hasLoaded, setSaveStatus]);

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

  return { categories, addCategory, updateCategory, removeCategory };
}
