import { getContrastText, DEFAULT_CATEGORY_ICON } from '../lib/color.js';

export function LegendRows({ categories }) {
  return (
    <>
      <div className="legend-row"><span className="legend-swatch legend-superior-titulo" />Aplicación de valor Superior</div>
      <div className="legend-row"><span className="legend-swatch legend-superior-intencion" />Intención Superior</div>
      <div className="legend-row"><span className="legend-swatch legend-titulo" />Aplicación de valor</div>
      <div className="legend-row"><span className="legend-swatch legend-intencion" />Intención Subyacente</div>
      <div className="legend-row"><span className="legend-swatch legend-policy" />Política &amp; Criterio de Valor</div>
      <div className="legend-row"><span className="legend-swatch legend-metric-valor" />Métrica de valor</div>
      <div className="legend-row"><span className="legend-swatch legend-metric-control" />Métrica de control</div>
      <p className="legend-note">El tono de la Aplicación de valor, su Intención, y sus burbujas cambia según qué tan profundo está el nodo en el árbol (nivel 1, 2, 3…) — así se distingue de un vistazo de qué generación es cada Aplicación de valor. El tipo de cosa (aplicación / intención / política / métrica) se distingue por la forma y el tono dentro de esa misma familia de color, no por el color en sí.</p>
      {categories.length ? (
        <>
          <div className="legend-divider" />
          <div className="legend-subtitle">Categorías (círculo en la esquina del grupo)</div>
          {categories.map((category) => (
            <div className="legend-row" key={category.id}>
              <span className="legend-swatch legend-category-badge" style={{ background: category.color, color: getContrastText(category.color) }}>
                <i className={`fa-solid fa-${category.icon || DEFAULT_CATEGORY_ICON}`} />
              </span>
              {category.name}
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}

export function Legend({ visible, setVisible, categories }) {
  return (
    <>
      <button type="button" id="btn-legend" title="¿Qué significa cada color?" onClick={() => setVisible((current) => !current)}>?</button>
      <div id="legend-panel" className={visible ? '' : 'hidden'}>
        <div className="legend-head">
          <strong>Simbología</strong>
          <button type="button" id="btn-legend-close" className="icon-btn" onClick={() => setVisible(false)}>✕</button>
        </div>
        <LegendRows categories={categories} />
      </div>
    </>
  );
}
