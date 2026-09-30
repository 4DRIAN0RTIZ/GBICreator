import Crystal from './vendor/crystal-alert/crystal-alert.js';

// Adaptador sobre CrystalAlert: la app pide diálogos por aquí, nunca a
// `Crystal` directamente ni a alert/confirm/prompt nativos.
//
// CrystalAlert es un singleton sin cola: un segundo fire() mientras hay uno
// abierto reemplaza su contenido y la promesa del primero nunca se resuelve.
// Por eso cada diálogo espera a que termine el anterior.
export function createDialogs(crystal) {
  let queue = Promise.resolve();

  const enqueue = (open) => {
    const next = queue.then(open, open);
    queue = next.catch(() => {});
    return next;
  };

  const showAlert = ({ title, text, icon = 'error', confirmText = 'Entendido' }) => enqueue(async () => {
    await crystal.fire({ title, text, icon, confirmButtonText: confirmText });
  });

  // Resuelve true solo si se pulsa el botón de confirmar; cancelar, Escape o
  // clic fuera resuelven false.
  const showConfirm = ({ title, text, icon = 'warning', confirmText = 'Aceptar', cancelText = 'Cancelar' }) => enqueue(async () => {
    const result = await crystal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
    });
    return result === true;
  });

  // CrystalAlert no trae campo de texto: se inyecta un <input> vacío por
  // `html` y el valor inicial se asigna por DOM (nunca interpolado en HTML).
  // Resuelve el texto escrito, o null si se cancela.
  const showPrompt = ({ title, text = '', defaultValue = '', confirmText = 'Aceptar', cancelText = 'Cancelar' }) => enqueue(async () => {
    let input = null;
    const result = await crystal.fire({
      title,
      html: `${text ? '<p class="ca-text"></p>' : ''}<input class="ca-input" type="text" autocomplete="off">`,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      onOpen: (modal) => {
        const textEl = modal.querySelector('.ca-text');
        if (textEl) textEl.textContent = text;
        input = modal.querySelector('.ca-input');
        input.value = defaultValue;
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') modal.querySelector('.ca-btn-confirm')?.click();
        });
        input.focus();
        input.select();
      },
      preConfirm: () => input?.value ?? '',
    });
    return typeof result === 'string' ? result : null;
  });

  return { showAlert, showConfirm, showPrompt };
}

export const { showAlert, showConfirm, showPrompt } = createDialogs(Crystal);
