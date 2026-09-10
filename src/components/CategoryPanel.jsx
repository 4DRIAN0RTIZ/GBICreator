import { useState } from 'react';
import { IconPicker } from './IconPicker.jsx';
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from '../lib/color.js';

export function CategoryPanel({ visible, onClose, categories, onAdd, onUpdate, onDelete }) {
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [draftIcon, setDraftIcon] = useState(DEFAULT_CATEGORY_ICON);

  if (!visible) return null;

  const submit = (event) => {
    event.preventDefault();
    if (!draftName.trim()) return;
    onAdd(draftName, draftColor, draftIcon);
    setDraftName('');
    setDraftColor(DEFAULT_CATEGORY_COLOR);
    setDraftIcon(DEFAULT_CATEGORY_ICON);
  };

  return (
    <div id="category-modal" className="glass-modal">
      <div className="item-modal-head">
        <h3>Categorías</h3>
        <button type="button" className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className="category-list">
        {categories.length === 0 ? <p className="modal-desc">Todavía no hay categorías. Agrega la primera abajo.</p> : null}
        {categories.map((category) => (
          <div className="category-row" key={category.id}>
            <IconPicker value={category.icon} onChange={(icon) => onUpdate(category.id, { icon })} />
            <input type="color" value={category.color} onChange={(event) => onUpdate(category.id, { color: event.target.value })} title="Color de la categoría" />
            <input type="text" value={category.name} onChange={(event) => onUpdate(category.id, { name: event.target.value })} />
            <button type="button" className="remove-row-btn" title="Eliminar categoría" onClick={() => onDelete(category.id)}>×</button>
          </div>
        ))}
      </div>
      <form className="category-add-form" onSubmit={submit}>
        <IconPicker value={draftIcon} onChange={setDraftIcon} />
        <input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} title="Color de la nueva categoría" />
        <input type="text" placeholder="Nombre de la categoría nueva" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
        <button type="submit" className="primary-btn">+ Agregar</button>
      </form>
    </div>
  );
}
