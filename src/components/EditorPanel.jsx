export function EditorPanel({ node, draft, setDraft, onClose, onSave, onDelete, categories }) {
  if (!node || !draft) return null;

  const updateListItem = (listName, index, value) => {
    setDraft((current) => ({
      ...current,
      [listName]: current[listName].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const removeListItem = (listName, index) => {
    setDraft((current) => ({ ...current, [listName]: current[listName].filter((_, itemIndex) => itemIndex !== index) }));
  };

  const addListItem = (listName) => {
    setDraft((current) => ({ ...current, [listName]: [...current[listName], ''] }));
  };

  const renderDynamicList = (listName) => (
    <div id={`list-${listName}`} className="dynamic-list">
      {(draft[listName] || []).map((value, index) => (
        <div className="dynamic-row" key={`${listName}-${index}`}>
          <textarea rows="2" value={value} onChange={(event) => updateListItem(listName, index, event.target.value)} />
          <button type="button" className="remove-row-btn" title="Quitar esta línea" onClick={() => removeListItem(listName, index)}>×</button>
        </div>
      ))}
    </div>
  );

  return (
    <aside id="editor-panel">
      <div className="editor-head">
        <h2 id="editor-title">{node.isRoot ? 'Editar Aplicación de valor Superior' : 'Editar Aplicación de valor'}</h2>
        <button id="btn-close-editor" className="icon-btn" title="Cerrar" type="button" onClick={onClose}>✕</button>
      </div>
      <form id="editor-form" onSubmit={onSave}>
        <div id="fields-root" className={`field-group${node.isRoot ? '' : ' hidden'}`}>
          <label>Aplicación de valor Superior
            <textarea id="f-avs" rows="2" placeholder="Gobierno de X (Quiero...)" value={draft.aplicacionValorSuperior || ''} onChange={(event) => setDraft((current) => ({ ...current, aplicacionValorSuperior: event.target.value }))} />
          </label>
          <label>Intención Superior
            <textarea id="f-is" rows="3" placeholder="Estado deseado y continuo..." value={draft.intencionSuperior || ''} onChange={(event) => setDraft((current) => ({ ...current, intencionSuperior: event.target.value }))} />
          </label>
        </div>

        <div id="fields-node" className={`field-group${node.isRoot ? ' hidden' : ''}`}>
          <label>Aplicación de valor ("Quiero X")
            <textarea id="f-titulo" rows="2" placeholder="Quiero..." value={draft.titulo || ''} onChange={(event) => setDraft((current) => ({ ...current, titulo: event.target.value }))} />
          </label>
          <label>Pregunta que responde
            <textarea id="f-pregunta" rows="2" placeholder="¿...?" value={draft.pregunta || ''} onChange={(event) => setDraft((current) => ({ ...current, pregunta: event.target.value }))} />
          </label>
          <label>Intención Subyacente
            <textarea id="f-intencion" rows="3" placeholder="El estado/condición que sostiene esta aplicación de valor..." value={draft.intencionSubyacente || ''} onChange={(event) => setDraft((current) => ({ ...current, intencionSubyacente: event.target.value }))} />
          </label>
          <label>Categoría (círculo de color en la esquina del grupo)
            <select value={draft.categoriaId || ''} onChange={(event) => setDraft((current) => ({ ...current, categoriaId: event.target.value || null }))}>
              <option value="">— Sin categoría (color por nivel) —</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>

          {[
            ['politicas', 'Políticas & Criterios de Valor', '+ Agregar política'],
            ['metricasValor', 'Métricas de valor', '+ Agregar métrica'],
            ['metricasControl', 'Métricas de control', '+ Agregar métrica'],
          ].map(([listName, title, buttonText]) => (
            <div className="list-field" key={listName}>
              <div className="list-field-head">
                <span>{title}</span>
                <button type="button" className="add-row-btn" data-list={listName} onClick={() => addListItem(listName)}>{buttonText}</button>
              </div>
              {renderDynamicList(listName)}
            </div>
          ))}
        </div>

        <div className="editor-actions">
          <button type="button" id="btn-delete-node" className={`danger-btn${node.isRoot ? ' hidden' : ''}`} onClick={onDelete}>Eliminar nodo</button>
          <button type="submit" id="btn-save-node" className="primary-btn">Guardar</button>
        </div>
      </form>
    </aside>
  );
}
