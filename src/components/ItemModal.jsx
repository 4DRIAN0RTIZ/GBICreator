import { FIELD_LABELS } from '../constants/fieldLabels.js';

const METRIC_FIELDS = new Set(['metricasValor', 'metricasControl']);

export function ItemModal({ itemEdit, text, setText, origin, setOrigin, policies, onClose, onDelete, onSave }) {
  if (!itemEdit) return null;
  const isMetric = METRIC_FIELDS.has(itemEdit.field);
  const isRemovable = itemEdit.index !== -1 && itemEdit.index !== 'new';
  const canSave = !isMetric || !!origin;

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
      {isMetric ? (
        <label className="origin-picker">
          ¿De qué política nace esta métrica?
          <select value={origin || ''} onChange={(event) => setOrigin(event.target.value || null)}>
            <option value="" disabled>— Elegí una política —</option>
            {policies.map((policy, index) => (
              <option key={policy.id} value={policy.id}>{`P${index + 1} · ${policy.texto || '(sin texto)'}`}</option>
            ))}
          </select>
          {!policies.length ? <p className="field-hint warning">No hay políticas en este nodo todavía — agregá una primero.</p> : null}
        </label>
      ) : null}
      <textarea id="item-modal-textarea" rows="4" value={text} onChange={(event) => setText(event.target.value)} autoFocus />
      <div className="editor-actions">
        <button type="button" id="btn-item-delete" className={`danger-btn${isRemovable ? '' : ' hidden'}`} onClick={onDelete}>Eliminar</button>
        <span className="spacer" />
        <button type="button" id="btn-item-cancel" onClick={onClose}>Cancelar</button>
        <button type="button" id="btn-item-save" className="primary-btn" disabled={!canSave} onClick={onSave}>Guardar</button>
      </div>
    </div>
  );
}
