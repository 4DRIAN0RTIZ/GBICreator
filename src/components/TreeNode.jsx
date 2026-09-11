import { Branch } from './Branch.jsx';
import { CategoryPicker } from './CategoryPicker.jsx';
import { policyOriginMeta } from '../domain/tree.js';

export function TreeNode({ node, depth = 0, actions, categories }) {
  const levelClass = !node.isRoot ? `level-${((depth - 1) % 5) + 1}` : '';
  const hasPolicies = (node.politicas || []).length > 0;
  const policyItems = (node.politicas || []).map((policy, index) => ({
    text: policy.texto, cls: 'policy-bubble', field: 'politicas', index, originLabel: `P${index + 1}`, originIndex: index % 6,
  }));
  const metricItems = (node.metricasValor || [])
    .map((metric, index) => ({
      text: metric.texto, cls: 'metric-bubble valor', field: 'metricasValor', index, ...policyOriginMeta(node.politicas, metric.origenPoliticaId),
    }))
    .concat((node.metricasControl || []).map((metric, index) => ({
      text: metric.texto, cls: 'metric-bubble control', field: 'metricasControl', index, ...policyOriginMeta(node.politicas, metric.origenPoliticaId),
    })));
  const card = (
    <div className={`node-card${node.isRoot ? ' root-card' : ''}`} data-id={node.id}>
      {node.isRoot ? (
        <>
          <div className="titulo" data-field="aplicacionValorSuperior" onClick={(event) => actions.openItem(event, node.id, 'aplicacionValorSuperior')}>
            {node.aplicacionValorSuperior || '(Sin definir) Aplicación de valor Superior'}
          </div>
          <div className="intencion-band" data-field="intencionSuperior" onClick={(event) => actions.openItem(event, node.id, 'intencionSuperior')}>
            {node.intencionSuperior || 'Intención Superior sin definir — clic para editar'}
          </div>
        </>
      ) : (
        <>
          <div className="titulo" data-field="titulo" onClick={(event) => actions.openItem(event, node.id, 'titulo')}>
            {node.titulo || '(Sin título)'}
          </div>
          {node.pregunta ? (
            <div className="pregunta" data-field="pregunta" onClick={(event) => actions.openItem(event, node.id, 'pregunta')}>
              {node.pregunta}
            </div>
          ) : null}
          {node.intencionSubyacente ? (
            <div className="intencion-band" data-field="intencionSubyacente" onClick={(event) => actions.openItem(event, node.id, 'intencionSubyacente')}>
              {node.intencionSubyacente}
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  const nodeWrap = (
    <div className="node-wrap">
      {card}
      <div className="node-actions">
        <button type="button" className="add-child-btn" title="Agregar Aplicación de valor hija, a partir de esta Intención Subyacente" onClick={(event) => actions.addChild(event, node.id)}>+</button>
        {!node.isRoot ? (
          <>
            <button type="button" className="duplicate-btn" title="Duplicar este bloque (aplicación, intención, políticas y métricas)" onClick={(event) => actions.duplicateNode(event, node.id)}>⧉</button>
            <button type="button" className="disconnect-btn" title="Desconectar (mover a Nodos aislados, sin borrar)" onClick={(event) => actions.disconnectNode(event, node.id)}>⏏</button>
            <button type="button" className="delete-btn" title="Eliminar este nodo y lo que cuelgue de él" onClick={(event) => actions.deleteNode(event, node.id)}>×</button>
          </>
        ) : null}
      </div>
      {node.hijos?.length ? (
        <button
          type="button"
          className="toggle-btn"
          title={node.collapsed ? 'Expandir hijos' : 'Colapsar hijos'}
          onClick={(event) => actions.toggleCollapsed(event, node.id)}
        >
          {node.collapsed ? '+' : '–'}
        </button>
      ) : null}
    </div>
  );

  return (
    <li className={levelClass}>
      {node.isRoot ? nodeWrap : (
        <div className="node-row">
          <Branch
            side="policy"
            items={policyItems}
            onEditItem={(field, index) => actions.openItem(null, node.id, field, index)}
            addButtons={[
              { field: 'politicas', cls: 'policy', label: 'política', title: 'Agregar política', onClick: () => actions.openNewItem(node.id, 'politicas') },
            ]}
          />
          {nodeWrap}
          <Branch
            side="metric"
            items={metricItems}
            onEditItem={(field, index) => actions.openItem(null, node.id, field, index)}
            addButtons={[
              {
                field: 'metricasValor',
                cls: 'valor',
                label: 'valor',
                title: hasPolicies ? 'Agregar métrica de valor' : 'Agregá primero una política',
                disabled: !hasPolicies,
                onClick: () => actions.openNewItem(node.id, 'metricasValor'),
              },
              {
                field: 'metricasControl',
                cls: 'control',
                label: 'control',
                title: hasPolicies ? 'Agregar métrica de control' : 'Agregá primero una política',
                disabled: !hasPolicies,
                onClick: () => actions.openNewItem(node.id, 'metricasControl'),
              },
            ]}
          />
          <CategoryPicker node={node} categories={categories} onSetCategory={(categoryId) => actions.setCategory(node.id, categoryId)} />
        </div>
      )}
      {node.hijos?.length ? (
        <ul className={`children-list${node.collapsed ? ' children-collapsed' : ''}`}>
          {node.hijos.map((child) => <TreeNode key={child.id} node={child} depth={depth + 1} actions={actions} categories={categories} />)}
        </ul>
      ) : null}
    </li>
  );
}
