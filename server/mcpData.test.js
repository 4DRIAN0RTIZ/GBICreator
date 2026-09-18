import { describe, expect, it } from 'vitest';
import {
  getNode,
  getProject,
  getTreeOutline,
  listMetrics,
  listNodeChildren,
  listPolicies,
  listProjects,
  listTopLevelNodes,
  searchNodes,
  validateProject,
} from './mcpData.js';

const payload = {
  currentProjectId: 'p1',
  isEmpty: false,
  projects: [
    {
      id: 'p1',
      name: 'Proyecto GBI',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: {
        id: 'root',
        isRoot: true,
        aplicacionValorSuperior: 'Gobierno TI',
        intencionSuperior: 'Intención superior',
        hijos: [
          {
            id: 'n1',
            titulo: 'Quiero controlar activos',
            categoriaId: 'c1',
            pregunta: '¿Los activos están controlados?',
            intencionSubyacente: 'Mantener inventario y responsabilidad vigentes',
            politicas: [{ id: 'pol1', texto: 'Política de inventario' }],
            metricasValor: [{ id: 'mv1', texto: 'Métrica valor de inventario', origenPoliticaId: 'pol1' }],
            metricasControl: [],
            hijos: [
              {
                id: 'n1-1',
                titulo: 'Quiero inventario confiable',
                hijos: [],
              },
            ],
          },
        ],
        sueltos: [
          {
            id: 's1',
            titulo: 'Nodo suelto',
            hijos: [
              {
                id: 's1-1',
                titulo: 'Hijo suelto',
                hijos: [],
              },
            ],
          },
        ],
      },
    },
  ],
};

describe('helpers del MCP GBI', () => {
  it('lista proyectos con resumen navegable', () => {
    expect(listProjects(payload)).toEqual({
      currentProjectId: 'p1',
      isEmpty: false,
      projects: [
        {
          id: 'p1',
          name: 'Proyecto GBI',
          updatedAt: '2026-01-01T00:00:00.000Z',
          rootLabel: 'Gobierno TI',
          topLevelCount: 1,
          looseCount: 1,
        },
      ],
    });
  });

  it('lista nodos de primer nivel incluyendo sueltos', () => {
    const project = getProject(payload);

    const result = listTopLevelNodes(project);

    expect(result.root).toMatchObject({ id: 'root', label: 'Gobierno TI', childrenCount: 1 });
    expect(result.nodes.map((node) => [node.id, node.label, node.location])).toEqual([
      ['n1', 'Quiero controlar activos', 'hijos'],
      ['s1', 'Nodo suelto', 'sueltos'],
    ]);
  });

  it('lista hijos directos de un nodo del árbol principal', () => {
    const project = getProject(payload);

    const result = listNodeChildren(project, 'n1');

    expect(result.path.map((entry) => entry.id)).toEqual(['root', 'n1']);
    expect(result.children.map((child) => child.id)).toEqual(['n1-1']);
  });

  it('encuentra nodos dentro de la bandeja de sueltos', () => {
    const project = getProject(payload);

    const result = getNode(project, 's1-1');

    expect(result.location).toBe('sueltos');
    expect(result.path.map((entry) => entry.id)).toEqual(['root', 's1', 's1-1']);
    expect(result.node.titulo).toBe('Hijo suelto');
  });

  it('falla de forma explícita cuando un nodo no existe', () => {
    const project = getProject(payload);

    expect(() => listNodeChildren(project, 'nope')).toThrow('No existe un nodo con id nope');
  });

  it('busca nodos por texto en campos y contenidos relacionados', () => {
    const project = getProject(payload);

    const result = searchNodes(project, { query: 'inventario' });

    expect(result.matches.map((match) => match.id)).toEqual(['n1', 'n1-1']);
    expect(result.matches[0].matchedFields).toEqual(['intencionSubyacente', 'politicas.0', 'metricasValor.0']);
  });

  it('genera un outline jerárquico del árbol incluyendo sueltos', () => {
    const project = getProject(payload);

    const result = getTreeOutline(project);

    expect(result.items.map((item) => [item.id, item.depth, item.location])).toEqual([
      ['root', 0, 'hijos'],
      ['n1', 1, 'hijos'],
      ['n1-1', 2, 'hijos'],
      ['s1', 1, 'sueltos'],
      ['s1-1', 2, 'sueltos'],
    ]);
  });

  it('lista políticas con nodo y ruta de origen', () => {
    const project = getProject(payload);

    const result = listPolicies(project);

    expect(result.count).toBe(1);
    expect(result.policies[0]).toMatchObject({ id: 'pol1', texto: 'Política de inventario' });
    expect(result.policies[0].node.id).toBe('n1');
  });

  it('lista métricas con política de origen resuelta', () => {
    const project = getProject(payload);

    const result = listMetrics(project);

    expect(result.count).toBe(1);
    expect(result.metrics[0]).toMatchObject({ id: 'mv1', type: 'valor', origenPoliticaId: 'pol1', hasBrokenOrigin: false, isOrphan: false });
    expect(result.metrics[0].originPolicy).toMatchObject({ id: 'pol1', index: 0 });
  });

  it('valida inconsistencias básicas del proyecto', () => {
    const invalidPayload = structuredClone(payload);
    invalidPayload.projects[0].data.sueltos[0].id = 'n1';
    invalidPayload.projects[0].data.hijos[0].metricasControl = [{ id: 'mc1', texto: 'Métrica rota', origenPoliticaId: 'missing' }];

    const result = validateProject(getProject(invalidPayload));

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['duplicate_node_id', 'metric_broken_origin']));
  });
});
