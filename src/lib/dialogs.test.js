import { describe, expect, it, vi } from 'vitest';
import { createDialogs } from './dialogs.js';

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// Simula el modal que CrystalAlert entrega a onOpen.
function fakeModal() {
  const listeners = {};
  const input = {
    value: '',
    focus: vi.fn(),
    select: vi.fn(),
    addEventListener: (type, handler) => {
      listeners[type] = handler;
    },
  };
  const textEl = { textContent: '' };
  const confirmButton = { click: vi.fn() };
  const modal = {
    querySelector: (selector) => ({ '.ca-input': input, '.ca-text': textEl, '.ca-btn-confirm': confirmButton })[selector] || null,
  };
  return { modal, input, textEl, confirmButton, listeners };
}

describe('createDialogs', () => {
  it('showConfirm resuelve true solo al confirmar', async () => {
    const crystal = { fire: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(null) };
    const { showConfirm } = createDialogs(crystal);

    await expect(showConfirm({ title: '¿Seguro?' })).resolves.toBe(true);
    await expect(showConfirm({ title: '¿Seguro?' })).resolves.toBe(false);
    await expect(showConfirm({ title: '¿Seguro?' })).resolves.toBe(false);
    expect(crystal.fire).toHaveBeenCalledWith(expect.objectContaining({ showCancelButton: true, confirmButtonText: 'Aceptar', cancelButtonText: 'Cancelar' }));
  });

  it('no abre un diálogo hasta que se cierra el anterior', async () => {
    const first = deferred();
    const crystal = { fire: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(true) };
    const { showConfirm } = createDialogs(crystal);

    const firstResult = showConfirm({ title: 'Proyectos' });
    const secondResult = showConfirm({ title: 'Categorías' });
    await Promise.resolve();
    expect(crystal.fire).toHaveBeenCalledTimes(1);

    first.resolve(false);

    await expect(firstResult).resolves.toBe(false);
    await expect(secondResult).resolves.toBe(true);
    expect(crystal.fire).toHaveBeenCalledTimes(2);
  });

  it('sigue atendiendo la cola si un diálogo falla', async () => {
    const crystal = { fire: vi.fn().mockRejectedValueOnce(new Error('DOM')).mockResolvedValueOnce(true) };
    const { showAlert, showConfirm } = createDialogs(crystal);

    await expect(showAlert({ title: 'Error' })).rejects.toThrow('DOM');
    await expect(showConfirm({ title: 'Otro' })).resolves.toBe(true);
  });

  it('showPrompt precarga el valor por DOM y devuelve lo escrito', async () => {
    const { modal, input, textEl, confirmButton, listeners } = fakeModal();
    const crystal = {
      fire: vi.fn(async (options) => {
        options.onOpen(modal);
        expect(input.value).toBe('Proyecto <1>');
        listeners.keydown({ key: 'Enter' });
        input.value = 'Nuevo nombre';
        return options.preConfirm();
      }),
    };
    const { showPrompt } = createDialogs(crystal);

    const result = await showPrompt({ title: 'Nombre', text: 'Escribe el nombre', defaultValue: 'Proyecto <1>' });

    expect(result).toBe('Nuevo nombre');
    expect(textEl.textContent).toBe('Escribe el nombre');
    expect(confirmButton.click).toHaveBeenCalled();
    expect(crystal.fire.mock.calls[0][0].html).not.toContain('Proyecto <1>');
  });

  it('showPrompt devuelve null al cancelar o cerrar', async () => {
    const crystal = { fire: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(null) };
    const { showPrompt } = createDialogs(crystal);

    await expect(showPrompt({ title: 'Nombre' })).resolves.toBeNull();
    await expect(showPrompt({ title: 'Nombre' })).resolves.toBeNull();
  });

  it('showPrompt distingue una cadena vacía de cancelar', async () => {
    const crystal = { fire: vi.fn(async (options) => { options.onOpen(fakeModal().modal); return options.preConfirm(); }) };
    const { showPrompt } = createDialogs(crystal);

    await expect(showPrompt({ title: 'Nombre' })).resolves.toBe('');
  });
});
