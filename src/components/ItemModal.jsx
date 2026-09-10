import { FIELD_LABELS } from '../constants/fieldLabels.js';

export function ItemModal({ itemEdit, text, setText, onClose, onDelete, onSave }) {
  if (!itemEdit) return null;
  const isRemovable = itemEdit.index !== -1 && itemEdit.index !== 'new';
  return (
    <div id="item-modal" className="glass-modal">
      <div className="item-modal-head">
        <h3 id="item-modal-title">
          {itemEdit.index === 'new'
            ? `Agregar ${FIELD_LABELS[itemEdit.field] || ''}`
            : (FIELD_LABELS[itemEdit.field] || 'Editar')}
        </h3>
        <button type="button" id="btn-item-modal-close" className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <textarea id="item-modal-textarea" rows="4" value={text} onChange={(event) => setText(event.target.value)} autoFocus />
      <div className="editor-actions">
        <button type="button" id="btn-item-delete" className={`danger-btn${isRemovable ? '' : ' hidden'}`} onClick={onDelete}>Eliminar</button>
        <span className="spacer" />
        <button type="button" id="btn-item-cancel" onClick={onClose}>Cancelar</button>
        <button type="button" id="btn-item-save" className="primary-btn" onClick={onSave}>Guardar</button>
      </div>
    </div>
  );
}
