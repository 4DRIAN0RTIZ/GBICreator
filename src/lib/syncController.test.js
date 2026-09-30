import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncController } from './syncController.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSyncController', () => {
  it('no guarda cambios locales si la carga inicial falló', async () => {
    const load = vi.fn().mockRejectedValue(new Error('HTTP 502'));
    const save = vi.fn().mockResolvedValue({ revision: 1 });
    const onLoadError = vi.fn();
    const sync = createSyncController({ load, save, onLoaded: vi.fn(), onLoadError });

    await sync.start();
    sync.localChange({ projects: ['ejemplo'] });
    await vi.runOnlyPendingTimersAsync();

    expect(onLoadError).toHaveBeenCalled();
    expect(sync.isLoaded()).toBe(false);
    expect(save).not.toHaveBeenCalled();
    sync.stop();
  });

  it('reintenta la carga y habilita el guardado cuando el backend responde', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP 502'))
      .mockResolvedValueOnce({ value: { projects: ['real'] }, revision: 1 });
    const save = vi.fn().mockResolvedValue({});
    const onLoaded = vi.fn();
    const sync = createSyncController({ load, save, onLoaded, retryDelayMs: 1000 });

    await sync.start();
    await vi.advanceTimersByTimeAsync(1000);
    sync.localChange({ projects: ['editado'] });
    await vi.runAllTimersAsync();

    expect(load).toHaveBeenCalledTimes(2);
    expect(onLoaded).toHaveBeenCalledWith({ projects: ['real'] });
    expect(save).toHaveBeenCalledWith({ projects: ['editado'] }, 1);
    sync.stop();
  });

  it('deja de reintentar la carga tras stop', async () => {
    const load = vi.fn().mockRejectedValue(new Error('HTTP 502'));
    const sync = createSyncController({ load, save: vi.fn(), onLoaded: vi.fn(), retryDelayMs: 1000 });

    await sync.start();
    sync.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('mantiene un solo guardado en vuelo y envía el último valor al terminar', async () => {
    const firstSave = deferred();
    const save = vi.fn()
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValue({ revision: 3 });
    const sync = createSyncController({ load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }), save, onLoaded: vi.fn() });

    await sync.start();
    sync.localChange('a');
    sync.localChange('b');
    sync.localChange('c');
    expect(save).toHaveBeenCalledTimes(1);

    firstSave.resolve({ revision: 2 });
    await vi.runAllTimersAsync();

    expect(save.mock.calls).toEqual([['a', 1], ['c', 2]]);
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it('conserva el cambio pendiente si el guardado falla', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValue({ revision: 2 });
    const onSaveError = vi.fn();
    const sync = createSyncController({ load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }), save, onLoaded: vi.fn(), onSaveError });

    await sync.start();
    sync.localChange('a');
    await vi.runAllTimersAsync();

    expect(onSaveError).toHaveBeenCalled();
    expect(sync.hasPendingChanges()).toBe(true);
  });

  it('conserva los cambios locales ante un conflicto y deja de guardar hasta resolverlo', async () => {
    const conflictError = Object.assign(new Error('409'), { conflict: { value: 'remoto', revision: 5 } });
    const save = vi.fn().mockRejectedValueOnce(conflictError).mockResolvedValue({ revision: 6 });
    const onConflict = vi.fn();
    const sync = createSyncController({ load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }), save, onLoaded: vi.fn(), onConflict });

    await sync.start();
    sync.localChange('mio');
    await vi.runAllTimersAsync();
    sync.localChange('mio 2');
    await vi.runAllTimersAsync();

    expect(onConflict).toHaveBeenCalledWith('remoto');
    expect(sync.hasConflict()).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('sobrescribe con los cambios locales usando la revisión vigente del conflicto', async () => {
    const conflictError = Object.assign(new Error('409'), { conflict: { value: 'remoto', revision: 5 } });
    const save = vi.fn().mockRejectedValueOnce(conflictError).mockResolvedValue({ revision: 6 });
    const sync = createSyncController({ load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }), save, onLoaded: vi.fn() });

    await sync.start();
    sync.localChange('mio');
    await vi.runAllTimersAsync();
    sync.localChange('mio 2');
    sync.resolveWithLocal();
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenLastCalledWith('mio 2', 5);
    expect(sync.hasConflict()).toBe(false);
    expect(sync.hasPendingChanges()).toBe(false);
  });

  it('descarta los cambios locales y aplica el estado del servidor al resolver con el servidor', async () => {
    const conflictError = Object.assign(new Error('409'), { conflict: { value: 'remoto', revision: 5 } });
    const save = vi.fn().mockRejectedValueOnce(conflictError).mockResolvedValue({ revision: 6 });
    const onRemoteChange = vi.fn();
    const sync = createSyncController({ load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }), save, onLoaded: vi.fn(), onRemoteChange });

    await sync.start();
    sync.localChange('mio');
    await vi.runAllTimersAsync();
    sync.resolveWithServer();

    expect(onRemoteChange).toHaveBeenCalledWith('remoto');
    expect(sync.hasPendingChanges()).toBe(false);
    sync.localChange('nuevo');
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenLastCalledWith('nuevo', 5);
  });

  it('aplica cambios remotos cuando la revisión cambió y no hay cambios locales', async () => {
    const reload = vi.fn().mockResolvedValue({ value: 'remoto', revision: 2 });
    const onRemoteChange = vi.fn();
    const sync = createSyncController({
      load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }),
      reload,
      save: vi.fn(),
      fetchRevision: vi.fn().mockResolvedValue(2),
      onLoaded: vi.fn(),
      onRemoteChange,
    });

    await sync.start();
    await sync.checkRemote();

    expect(onRemoteChange).toHaveBeenCalledWith('remoto');
  });

  it('no recarga si la revisión no cambió', async () => {
    const reload = vi.fn();
    const sync = createSyncController({
      load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }),
      reload,
      save: vi.fn(),
      fetchRevision: vi.fn().mockResolvedValue(1),
      onLoaded: vi.fn(),
    });

    await sync.start();
    await sync.checkRemote();

    expect(reload).not.toHaveBeenCalled();
  });

  it('no pisa cambios locales pendientes con cambios remotos', async () => {
    const firstSave = deferred();
    const reload = vi.fn().mockResolvedValue({ value: 'remoto', revision: 9 });
    const onRemoteChange = vi.fn();
    const sync = createSyncController({
      load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }),
      reload,
      save: vi.fn().mockReturnValue(firstSave.promise),
      fetchRevision: vi.fn().mockResolvedValue(9),
      onLoaded: vi.fn(),
      onRemoteChange,
    });

    await sync.start();
    sync.localChange('mio');
    await sync.checkRemote();

    expect(reload).not.toHaveBeenCalled();
    expect(onRemoteChange).not.toHaveBeenCalled();
  });

  it('reintenta un guardado fallido en el siguiente chequeo remoto', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValue({ revision: 2 });
    const sync = createSyncController({
      load: vi.fn().mockResolvedValue({ value: 'inicial', revision: 1 }),
      save,
      fetchRevision: vi.fn(),
      onLoaded: vi.fn(),
    });

    await sync.start();
    sync.localChange('mio');
    await vi.runAllTimersAsync();
    await sync.checkRemote();
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(sync.hasPendingChanges()).toBe(false);
  });
});
