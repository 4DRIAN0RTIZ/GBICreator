import { toCanvas } from 'html-to-image';

// Se captura el viewport sin el pan/zoom actual (transform a identidad) para
// que el PNG salga siempre al 100% de calidad, sin importar cómo esté
// encuadrado el árbol en pantalla en este momento.
export async function exportTreeAsPng(viewport, filename) {
  const prevTransform = viewport.style.transform;
  viewport.style.transform = 'none';
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    const canvas = await toCanvas(viewport, { pixelRatio: 3, backgroundColor: '#eef0f4', cacheBust: true });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    viewport.style.transform = prevTransform;
  }
}
