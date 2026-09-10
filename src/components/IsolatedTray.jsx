export function IsolatedTray({ nodes, onEditNode, onConnectNode, onDeleteNode }) {
  return (
    <section id="isolated-tray" className={nodes.length ? '' : 'hidden'}>
      <div className="tray-label">Nodos aislados — sin conectar todavía</div>
      <div id="isolated-list" className="tray-list">
        {nodes.map((node) => {
          const nPol = node.politicas.length;
          const nMet = node.metricasValor.length + node.metricasControl.length;
          const nHijos = node.hijos.length;
          return (
            <div className="tray-chip" key={node.id} onClick={() => onEditNode(node.id)}>
              <div className="titulo">{node.titulo || '(Sin título)'}</div>
              <div className="node-badges">
                <span className="badge">{nPol} pol.</span>
                <span className="badge">{nMet} mét.</span>
                {nHijos ? <span className="badge">{nHijos} hijo(s)</span> : null}
              </div>
              <div className="tray-actions">
                <button type="button" className="connect-btn" onClick={(event) => { event.stopPropagation(); onConnectNode(node.id); }}>Conectar</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteNode(node.id); }}>Eliminar</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
