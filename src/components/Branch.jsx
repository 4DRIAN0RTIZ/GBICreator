export function Branch({ side, items, onEditItem, addButtons }) {
  return (
    <div className={`${side}-branch${items.length ? ' has-items' : ''}`}>
      {items.map(({ text, cls, field, index, originLabel, originIndex, unassigned }) => (
        <div className="branch-item" key={`${field}-${index}`}>
          <div
            className={`bubble ${cls}`}
            title={text}
            onClick={(event) => {
              event.stopPropagation();
              onEditItem(field, index);
            }}
          >
            {originLabel ? (
              <span
                className={`origin-badge${unassigned ? ' origin-unassigned' : ''}`}
                data-origin-index={originIndex ?? undefined}
                title={unassigned ? 'Sin política de origen asignada' : `Nace de la política ${originLabel}`}
              >
                {originLabel}
              </span>
            ) : null}
            {text}
          </div>
        </div>
      ))}
      {addButtons?.length ? (
        <div className="branch-add-row">
          {addButtons.map((btn) => (
            <button
              type="button"
              key={btn.field}
              className={`branch-add-btn ${btn.cls}`}
              title={btn.title}
              disabled={btn.disabled}
              onClick={(event) => {
                event.stopPropagation();
                btn.onClick();
              }}
            >
              + {btn.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
