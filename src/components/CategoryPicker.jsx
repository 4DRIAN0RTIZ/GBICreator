import { useEffect, useRef, useState } from 'react';
import { getContrastText, DEFAULT_CATEGORY_ICON } from '../lib/color.js';

export function CategoryPicker({ node, categories, onSetCategory }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const category = node.categoriaId ? categories.find((item) => item.id === node.categoriaId) : null;

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className={`category-picker${category ? '' : ' category-picker-empty'}${open ? ' open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="category-badge"
        style={category ? { background: category.color, color: getContrastText(category.color) } : undefined}
        title={category ? category.name : 'Asignar categoría'}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <i className={`fa-solid fa-${category ? (category.icon || DEFAULT_CATEGORY_ICON) : 'plus'}`} />
      </button>
      {open ? (
        <div className="category-picker-menu" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={`category-picker-option${!node.categoriaId ? ' active' : ''}`}
            onClick={() => { onSetCategory(null); setOpen(false); }}
          >
            Sin categoría
          </button>
          {categories.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`category-picker-option${item.id === node.categoriaId ? ' active' : ''}`}
              onClick={() => { onSetCategory(item.id); setOpen(false); }}
            >
              <span className="category-picker-swatch" style={{ background: item.color, color: getContrastText(item.color) }}>
                <i className={`fa-solid fa-${item.icon || DEFAULT_CATEGORY_ICON}`} />
              </span>
              {item.name}
            </button>
          ))}
          {categories.length === 0 ? (
            <p className="category-picker-empty-note">No hay categorías todavía. Créalas con el botón de etiquetas en la barra superior.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
