import ExcelJS from 'exceljs';
import { flattenValueNodes, policyOriginMeta } from '../domain/tree.js';

function metricLabel(politicas, metric) {
  const { originLabel } = policyOriginMeta(politicas, metric.origenPoliticaId);
  return `[${originLabel}] ${metric.texto}`;
}

// Replica la estructura del tablero de referencia de gobernanza ITAM, pero en
// vez de aplanar todo el árbol en una sola fila de bloques, cada hijo de
// primer nivel de la raíz es un "carril" (rango fijo de columnas) y sus
// propios descendientes se apilan DEBAJO de él dentro de ese mismo carril,
// indentados hacia la derecha según su profundidad — para que la posición en
// la hoja replique, en la medida de lo posible, el árbol de jerarquía.
export async function exportTreeAsXlsx(data, filename) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Sheet1');

  const BLOCK_WIDTH = 5;
  const MIN_BLOCK_WIDTH = 3;
  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8CCE4' } };
  const THIN = { style: 'thin', color: { argb: 'FFC9CDD6' } };
  const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
  const CENTER_WRAP = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const CENTER_TOP_WRAP = { horizontal: 'center', vertical: 'top', wrapText: true };

  const lanes = data.hijos || [];
  const allNodes = flattenValueNodes(data);
  const totalCols = Math.max(1, lanes.length) * BLOCK_WIDTH;
  const maxValor = Math.max(1, ...allNodes.map((node) => node.metricasValor?.length || 0));
  const maxControl = Math.max(1, ...allNodes.map((node) => node.metricasControl?.length || 0));

  const TOP_START_ROW = 11;
  const GAP_ROWS = 2;
  // Filas relativas dentro de un bloque (0 = primera fila del bloque):
  // encabezado(1) + vacía(1) + título(2) + encabezado(1) + intención(4)
  // + encabezado(1) + políticas(5) + encabezado(1) + métricas de valor
  // + encabezado(1) + métricas de control.
  const BAND_ROWS = 1 + 1 + 2 + 1 + 4 + 1 + 5 + 1 + maxValor + 1 + maxControl;
  const BAND_STRIDE = BAND_ROWS + GAP_ROWS;

  const mergedCell = (r1, c1, r2, c2, value, { fill, bold, alignment, border } = {}) => {
    ws.mergeCells(r1, c1, r2, c2);
    const cell = ws.getCell(r1, c1);
    cell.value = value || '';
    cell.alignment = alignment || CENTER_WRAP;
    if (fill) cell.fill = fill;
    if (bold) cell.font = { bold: true };
    if (border) {
      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) ws.getCell(r, c).border = BORDER;
      }
    }
    return cell;
  };

  mergedCell(1, 1, 1, totalCols, 'Aplicación de valor superior', { fill: HEADER_FILL, bold: true });
  mergedCell(2, 1, 2, totalCols, data.aplicacionValorSuperior, { alignment: CENTER_WRAP });
  ws.getRow(2).height = 30;
  mergedCell(4, 1, 4, totalCols, 'Intencion Superior', { fill: HEADER_FILL, bold: true });
  mergedCell(5, 1, 10, totalCols, data.intencionSuperior, { alignment: CENTER_TOP_WRAP });

  const writeNodeBlock = (node, c1, c2, depth) => {
    const row = TOP_START_ROW + depth * BAND_STRIDE;
    const rTitulo = row + 2;
    const rIntencionHeader = rTitulo + 2;
    const rIntencion = rIntencionHeader + 1;
    const rPoliticasHeader = rIntencion + 4;
    const rPoliticas = rPoliticasHeader + 1;
    const rMetValorHeader = rPoliticas + 5;
    const rMetValor = rMetValorHeader + 1;
    const rMetControlHeader = rMetValor + maxValor;
    const rMetControl = rMetControlHeader + 1;

    mergedCell(row, c1, row, c2, 'Aplicación de valor', { fill: HEADER_FILL, bold: true, border: true });
    mergedCell(row + 1, c1, row + 1, c2, '', { border: true });
    mergedCell(rTitulo, c1, rTitulo + 1, c2, node.titulo, { alignment: CENTER_TOP_WRAP, border: true });

    mergedCell(rIntencionHeader, c1, rIntencionHeader, c2, 'Intencion Subyacente', { fill: HEADER_FILL, bold: true, border: true });
    mergedCell(rIntencion, c1, rIntencion + 3, c2, node.intencionSubyacente, { alignment: CENTER_TOP_WRAP, border: true });

    const politicas = node.politicas || [];
    mergedCell(rPoliticasHeader, c1, rPoliticasHeader, c2, 'Tablero de Politicas & Criterios de Valor', { fill: HEADER_FILL, bold: true, border: true });
    mergedCell(rPoliticas, c1, rPoliticas + 4, c2, politicas.map((policy, index) => `[P${index + 1}] ${policy.texto}`).join('\n'), { alignment: CENTER_TOP_WRAP, border: true });

    mergedCell(rMetValorHeader, c1, rMetValorHeader, c2, 'Metricas de valor', { fill: HEADER_FILL, bold: true, border: true });
    for (let i = 0; i < maxValor; i += 1) {
      const metric = node.metricasValor?.[i];
      mergedCell(rMetValor + i, c1, rMetValor + i, c2, metric ? metricLabel(politicas, metric) : '', { alignment: CENTER_WRAP, border: true });
    }

    mergedCell(rMetControlHeader, c1, rMetControlHeader, c2, 'Metricas de control', { fill: HEADER_FILL, bold: true, border: true });
    for (let i = 0; i < maxControl; i += 1) {
      const metric = node.metricasControl?.[i];
      mergedCell(rMetControl + i, c1, rMetControl + i, c2, metric ? metricLabel(politicas, metric) : '', { alignment: CENTER_WRAP, border: true });
    }
  };

  // Recorre el sub-árbol de un carril en profundidad (padre, luego cada hijo
  // con su propio sub-árbol) y devuelve el próximo índice de banda libre,
  // para que hermanos y sus descendientes no se pisen entre sí.
  const placeSubtree = (node, laneC1, laneC2, depth, bandIndex) => {
    const indent = Math.min(depth, BLOCK_WIDTH - MIN_BLOCK_WIDTH);
    writeNodeBlock(node, laneC1 + indent, laneC2, bandIndex);
    let nextBand = bandIndex + 1;
    (node.hijos || []).forEach((child) => {
      nextBand = placeSubtree(child, laneC1, laneC2, depth + 1, nextBand);
    });
    return nextBand;
  };

  lanes.forEach((lane, index) => {
    const laneC1 = index * BLOCK_WIDTH + 1;
    const laneC2 = laneC1 + BLOCK_WIDTH - 1;
    placeSubtree(lane, laneC1, laneC2, 0, 0);
  });

  for (let c = 1; c <= totalCols; c += 1) ws.getColumn(c).width = 14;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
