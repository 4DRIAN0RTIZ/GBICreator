export function SyncConflictBanner({ label, onReloadFromServer, onOverwriteServer }) {
  return (
    <div className="sync-conflict" role="alert">
      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
      <span>
        Alguien más modificó {label} en el servidor mientras editabas. Tus cambios siguen en pantalla pero <strong>no se han guardado</strong>.
      </span>
      <button type="button" onClick={onReloadFromServer}>Descartar los míos y recargar</button>
      <button type="button" className="danger-btn" onClick={onOverwriteServer}>Sobrescribir con los míos</button>
    </div>
  );
}
