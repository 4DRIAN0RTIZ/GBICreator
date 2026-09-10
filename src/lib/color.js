export const DEFAULT_CATEGORY_COLOR = '#3b5bdb';
export const DEFAULT_CATEGORY_ICON = 'tag';

// Contraste del texto/ícono dentro del círculo de categoría: blanco sobre
// colores oscuros, texto oscuro sobre colores claros (luminancia relativa).
export function getContrastText(hex) {
  const clean = (hex || DEFAULT_CATEGORY_COLOR).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#1f2430' : '#ffffff';
}
