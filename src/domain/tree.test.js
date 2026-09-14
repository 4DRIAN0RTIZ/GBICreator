import { describe, expect, it } from 'vitest';
import { normalizeLoadedData, normalizeNode } from './tree.js';

describe('normalizeNode', () => {
  it('rellena valores por defecto preservando el id provisto', () => {
    const node = normalizeNode({ id: 'n1', titulo: 'Reducir riesgo' });
    expect(node.id).toBe('n1');
    expect(node.titulo).toBe('Reducir riesgo');
    expect(node.isRoot).toBe(false);
    expect(node.politicas).toEqual([]);
    expect(node.metricasValor).toEqual([]);
    expect(node.metricasControl).toEqual([]);
    expect(node.hijos).toEqual([]);
  });

  it('normaliza hijos recursivamente preservando sus ids', () => {
    const node = normalizeNode({
      id: 'root-node',
      hijos: [{ id: 'child-1' }, { id: 'child-2' }],
    });
    expect(node.hijos).toHaveLength(2);
    expect(node.hijos.map((child) => child.id)).toEqual(['child-1', 'child-2']);
  });
});

describe('normalizeLoadedData', () => {
  it('normaliza un árbol vacío a la forma esperada', () => {
    const data = normalizeLoadedData({});
    expect(data).toEqual({
      id: 'root',
      isRoot: true,
      aplicacionValorSuperior: '',
      intencionSuperior: '',
      hijos: [],
      sueltos: [],
    });
  });
});
