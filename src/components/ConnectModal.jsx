export function ConnectModal({ node, target, setTarget, options, onCancel, onConfirm }) {
  if (!node) return null;
  return (
    <div id="connect-modal">
      <h2>Conectar nodo</h2>
      <p id="connect-modal-desc" className="modal-desc">Elige dónde conectar "{node.titulo || 'este nodo'}".</p>
      <label>Conectar como hijo de:
        <select id="connect-target" value={target} onChange={(event) => setTarget(event.target.value)}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <div className="editor-actions">
        <button type="button" id="btn-connect-cancel" onClick={onCancel}>Cancelar</button>
        <button type="button" id="btn-connect-confirm" className="primary-btn" onClick={onConfirm}>Conectar</button>
      </div>
    </div>
  );
}
