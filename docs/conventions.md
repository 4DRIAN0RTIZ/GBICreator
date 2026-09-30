# Convenciones de código

> Homogeneidad extrema. La IA predice mejor cuando el repositorio se parece
> a sí mismo en todas partes.

## Estilo JS/React

- **Lenguaje:** JavaScript + JSX. Sin TypeScript (no hay `.ts`/`.tsx` ni
  `tsconfig.json` en el repo — no lo introduzcas sin discutirlo primero).
- **Módulos:** ES modules (`import`/`export`), `"type": "module"` en
  `package.json`.
- **Componentes:** función + hooks, sin clases.
- **Strings:** comillas simples `'...'`, salvo para interpolación (usa
  template literals).

## Nombres

| Tipo                       | Convención     | Ejemplo                 |
|-----------------------------|----------------|--------------------------|
| Componentes (archivo+export)| `PascalCase.jsx` | `CategoryPanel.jsx`   |
| Hooks (archivo+export)      | `useXxx.js`     | `useProjects.js`        |
| Módulos de dominio/lib      | `camelCase.js`  | `tree.js`, `storage.js` |
| Funciones / variables       | `camelCase`     | `loadProjectState`      |
| Claves de localStorage      | `kebab-case` + sufijo de versión | `gbi-creator-data-v1` |

## Estructura de un hook de estado + persistencia

Sigue el patrón de `useProjects.js` / `useCategories.js`:

```js
import { useEffect, useState } from 'react';
import { loadXxx, XXX_STORAGE_KEY } from '../lib/storage.js';

export function useXxx(setSaveStatus) {
  const [state, setState] = useState(() => loadXxx());

  useEffect(() => {
    try {
      localStorage.setItem(XXX_STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      setSaveStatus('No se pudo guardar Xxx (localStorage lleno o bloqueado)');
    }
  }, [state, setSaveStatus]);

  // ...acciones que llaman a setState
}
```

Tras la feature 1, la persistencia vive en `src/lib/storage.js` y los hooks
usan `loadXxx` / `saveXxx` async contra el backend. El patrón se mantiene:
primero cargan desde API, evitan autoguardar hasta terminar esa carga inicial,
y comunican errores de red o servidor vía `setSaveStatus` sin tragarlos en
silencio.

## Diálogos

- **Nunca** uses `alert()`, `confirm()` ni `prompt()` nativos. Usa
  `showAlert`, `showConfirm` y `showPrompt` de `src/lib/dialogs.js`
  (CrystalAlert). Devuelven promesas: `showConfirm` resuelve `true` solo al
  confirmar y `showPrompt` resuelve el texto o `null` si se cancela.
- No importes `Crystal` directamente: el adaptador serializa los diálogos
  porque CrystalAlert es un singleton sin cola. La librería está vendorizada en
  `src/lib/vendor/crystal-alert/` (ver su README).

## Tests

- Un archivo de test junto al módulo que prueba: `<módulo>.test.js` (Vitest).
- `describe('<función o módulo>', () => { it('hace X cuando Y', ...) })`.
- Nombres de test descriptivos en español, igual que el resto del código.
- Evita invocar `genId()` (usa `window.crypto.randomUUID`) en tests que
  corren en entorno Node puro sin `window` — pasa ids explícitos en los
  fixtures de entrada en su lugar (ver `src/domain/tree.test.js`).

## Comentarios

Por defecto **no** se escriben. Solo se permiten cuando explican un *por qué*
no obvio (p. ej. una migración de datos legados, un workaround documentado,
un invariante sutil) — así ya lo hace `src/lib/exportXlsx.js` y
`src/domain/tree.js`. Los nombres deben hacer el resto.
