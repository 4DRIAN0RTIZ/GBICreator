// Coordina la carga inicial, el autoguardado y la sincronización de un estado
// contra el backend.
//
// Reglas clave:
// - Mientras la carga inicial no termine bien, los cambios locales NO se
//   guardan: guardar el estado inicial de la UI (proyecto de ejemplo,
//   categorías vacías) encima de la base compartida la borraría entera.
// - Cada guardado declara la revisión sobre la que trabajó. Si el servidor
//   responde conflicto, los cambios locales se conservan y se deja de guardar
//   hasta que alguien decida (recargar del servidor o sobrescribir).
// - Los cambios remotos solo se aplican si no hay cambios locales pendientes.
//
// Contrato de las funciones inyectadas:
// - load() / reload() -> { value, revision }
// - save(value, baseRevision) -> { revision }; ante conflicto lanza un error
//   con `conflict: { value, revision }` (estado vigente del servidor).
// - fetchRevision() -> revision
export function createSyncController({
  load,
  reload = load,
  save,
  fetchRevision,
  onLoaded,
  onRemoteChange = () => {},
  onConflict = () => {},
  onLoadError = () => {},
  onSaved = () => {},
  onSaveError = () => {},
  onRemoteError = () => {},
  retryDelayMs = 5000,
}) {
  let loaded = false;
  let stopped = false;
  let retryTimer = null;
  let revision = null;
  let conflict = null;
  let latest;
  let pending = false;
  let saving = false;
  let checking = false;

  const isBusy = () => pending || saving || !!conflict;

  async function start() {
    retryTimer = null;
    try {
      const result = await load();
      if (stopped) return;
      revision = result.revision;
      loaded = true;
      onLoaded(result.value);
    } catch (error) {
      if (stopped) return;
      onLoadError(error);
      retryTimer = setTimeout(start, retryDelayMs);
    }
  }

  // Solo un guardado en vuelo a la vez; los cambios que llegan mientras tanto
  // se agrupan y se envían al terminar, siempre con el último valor y la
  // revisión que devolvió el guardado anterior.
  async function flush() {
    if (saving || !pending || conflict || stopped) return;
    saving = true;
    pending = false;
    const value = latest;
    try {
      const result = await save(value, revision);
      saving = false;
      if (stopped) return;
      revision = result.revision;
      onSaved();
      flush();
    } catch (error) {
      saving = false;
      if (stopped) return;
      pending = true;
      if (error.conflict) {
        conflict = error.conflict;
        onConflict(conflict.value);
        return;
      }
      // Queda pendiente: se reintenta con el siguiente cambio o chequeo.
      onSaveError(error);
    }
  }

  function localChange(value) {
    if (!loaded || stopped) return;
    latest = value;
    pending = true;
    flush();
  }

  async function checkRemote() {
    if (!loaded || stopped || checking || saving || conflict) return;
    if (pending) {
      flush();
      return;
    }
    checking = true;
    try {
      const remoteRevision = await fetchRevision();
      if (stopped || isBusy() || remoteRevision === revision) return;
      const result = await reload();
      if (stopped || isBusy()) return;
      revision = result.revision;
      onRemoteChange(result.value);
    } catch (error) {
      if (!stopped) onRemoteError(error);
    } finally {
      checking = false;
    }
  }

  // Descarta los cambios locales y adopta el estado vigente del servidor.
  function resolveWithServer() {
    if (!conflict) return;
    const { value, revision: serverRevision } = conflict;
    conflict = null;
    pending = false;
    revision = serverRevision;
    onRemoteChange(value);
  }

  // Sobrescribe el servidor con los cambios locales, tomando como base la
  // revisión vigente que informó el conflicto.
  function resolveWithLocal() {
    if (!conflict) return;
    revision = conflict.revision;
    conflict = null;
    pending = true;
    flush();
  }

  function stop() {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
  }

  return {
    start,
    stop,
    localChange,
    checkRemote,
    resolveWithServer,
    resolveWithLocal,
    isLoaded: () => loaded,
    hasPendingChanges: () => pending || saving,
    hasConflict: () => !!conflict,
  };
}
