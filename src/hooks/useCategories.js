import { useEffect, useState } from 'react';
import { loadCategories, CATEGORIES_STORAGE_KEY } from '../lib/storage.js';
import { genId } from '../domain/tree.js';
import { DEFAULT_CATEGORY_ICON } from '../lib/color.js';

export function useCategories(setSaveStatus) {
  const [categories, setCategories] = useState(() => loadCategories());

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (_error) {
      setSaveStatus('No se pudieron guardar las categorías (localStorage lleno o bloqueado)');
    }
  }, [categories, setSaveStatus]);

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
