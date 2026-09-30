import { describe, expect, it, vi } from 'vitest';
import {
  addMetric,
  addNode,
  addPolicy,
  createProject,
  deleteMetric,
  deleteNode,
  deletePolicy,
  moveNode,
  mutateProjectIn,
  runMutation,
  updateMetric,
  updateNode,
  updatePolicy,
  updateRoot,
} from './mcpMutations.js';

function makePayload() {
  return {
    currentProjectId: 'p1',
    revision: 4,
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
              isRoot: false,
              titulo: 'Control de activos',
              pregunta: '',
              intencionSubyacente: '',
              categoriaId: null,
              politicas: [{ id: 'pol1', texto: 'Política 1' }, { id: 'pol2', texto: 'Política 2' }],
              metricasValor: [{ id: 'mv1', texto: 'Valor 1', origenPoliticaId: 'pol1' }],
              metricasControl: [{ id: 'mc1', texto: 'Control 1', origenPoliticaId: 'pol2' }],
              hijos: [
                { id: 'n1-1', isRoot: false, titulo: 'Inventario de activos', politicas: [], metricasValor: [], metricasControl: [], hijos: [] },
              ],
            },
          ],
          sueltos: [
            { id: 's1', isRoot: false, titulo: 'Nodo suelto', politicas: [], metricasValor: [], metricasControl: [], hijos: [] },
          ],
        },
      },
    ],
  };
}

const project = (payload) => payload.projects[0];
const nodeN1 = (payload) => project(payload).data.hijos[0];

describe('updateRoot y updateNode', () => {
  it('actualiza solo los campos indicados del root', () => {
    const payload = makePayload();
    updateRoot(project(payload), { intencionSuperior: 'Nueva intención' });

    expect(project(payload).data.aplicacionValorSuperior).toBe('Gobierno TI');
    expect(project(payload).data.intencionSuperior).toBe('Nueva intención');
  });

  it('actualiza campos de un nodo y rechaza un título vacío', () => {
    const payload = makePayload();
    updateNode(project(payload), { nodeId: 'n1-1', pregunta: '¿Está completo?', categoriaId: 'c1' });

    expect(nodeN1(payload).hijos[0]).toMatchObject({ pregunta: '¿Está completo?', categoriaId: 'c1', titulo: 'Inventario de activos' });
    expect(() => updateNode(project(payload), { nodeId: 'n1', titulo: '  ' })).toThrow('titulo no puede estar vacío');
  });

  it('falla con un nodo inexistente', () => {
    expect(() => updateNode(project(makePayload()), { nodeId: 'nope', titulo: 'X' })).toThrow('No existe un nodo con id nope');
  });
});

describe('addNode, moveNode y deleteNode', () => {
  it('agrega un nodo como hijo en la posición indicada', () => {
    const payload = makePayload();
    const result = addNode(project(payload), { parentId: 'root', index: 0, titulo: 'Riesgo de activos' });

    expect(project(payload).data.hijos[0].titulo).toBe('Riesgo de activos');
    expect(project(payload).data.hijos[0]).toMatchObject({ politicas: [], metricasValor: [], metricasControl: [], hijos: [] });
    expect(result.index).toBe(0);
  });

  it('agrega un nodo suelto y exige título', () => {
    const payload = makePayload();
    addNode(project(payload), { loose: true, titulo: 'Otro suelto' });

    expect(project(payload).data.sueltos.map((node) => node.titulo)).toEqual(['Nodo suelto', 'Otro suelto']);
    expect(() => addNode(project(payload), { parentId: 'root' })).toThrow('titulo no puede estar vacío');
  });

  it('mueve un nodo suelto dentro del árbol', () => {
    const payload = makePayload();
    moveNode(project(payload), { nodeId: 's1', parentId: 'n1' });

    expect(project(payload).data.sueltos).toEqual([]);
    expect(nodeN1(payload).hijos.map((node) => node.id)).toEqual(['n1-1', 's1']);
  });

  it('impide mover un nodo dentro de su propio descendiente sin perderlo', () => {
    const payload = makePayload();

    expect(() => moveNode(project(payload), { nodeId: 'n1', parentId: 'n1-1' })).toThrow('descendientes');
    expect(nodeN1(payload).id).toBe('n1');
  });

  it('no despega el nodo si el destino no existe', () => {
    const payload = makePayload();

    expect(() => moveNode(project(payload), { nodeId: 's1', parentId: 'nope' })).toThrow('No existe un nodo con id nope');
    expect(project(payload).data.sueltos.map((node) => node.id)).toEqual(['s1']);
  });

  it('borra un nodo con sus descendientes y protege el root', () => {
    const payload = makePayload();
    deleteNode(project(payload), { nodeId: 'n1' });

    expect(project(payload).data.hijos).toEqual([]);
    expect(() => deleteNode(project(payload), { nodeId: 'root' })).toThrow('No se puede borrar el root');
  });
});

describe('políticas', () => {
  it('agrega y edita políticas', () => {
    const payload = makePayload();
    const { policy } = addPolicy(project(payload), { nodeId: 'n1', texto: 'Política 3' });
    updatePolicy(project(payload), { nodeId: 'n1', policyId: policy.id, texto: 'Política 3 editada' });

    expect(nodeN1(payload).politicas.at(-1)).toEqual({ id: policy.id, texto: 'Política 3 editada' });
  });

  it('al borrar una política reasigna sus métricas a la primera restante', () => {
    const payload = makePayload();
    const result = deletePolicy(project(payload), { nodeId: 'n1', policyId: 'pol1' });

    expect(result).toMatchObject({ relinkedTo: 'pol2', deletedMetricIds: [] });
    expect(nodeN1(payload).metricasValor[0].origenPoliticaId).toBe('pol2');
  });

  it('al borrar la última política elimina las métricas que dependían de ella', () => {
    const payload = makePayload();
    deletePolicy(project(payload), { nodeId: 'n1', policyId: 'pol1' });
    const result = deletePolicy(project(payload), { nodeId: 'n1', policyId: 'pol2' });

    expect(result.deletedMetricIds.sort()).toEqual(['mc1', 'mv1']);
  });

  it('rechaza políticas en el root', () => {
    expect(() => addPolicy(project(makePayload()), { nodeId: 'root', texto: 'X' })).toThrow('El root no admite');
  });
});

describe('métricas', () => {
  it('agrega una métrica exigiendo una política de origen válida', () => {
    const payload = makePayload();
    addMetric(project(payload), { nodeId: 'n1', type: 'control', texto: 'Control 2', origenPoliticaId: 'pol1' });

    expect(nodeN1(payload).metricasControl.at(-1)).toMatchObject({ texto: 'Control 2', origenPoliticaId: 'pol1' });
    expect(() => addMetric(project(payload), { nodeId: 'n1', type: 'valor', texto: 'X', origenPoliticaId: 'nope' })).toThrow('no tiene la política nope');
    expect(() => addMetric(project(payload), { nodeId: 'n1', type: 'otro', texto: 'X', origenPoliticaId: 'pol1' })).toThrow('type debe ser');
  });

  it('edita texto, origen y tipo de una métrica', () => {
    const payload = makePayload();
    updateMetric(project(payload), { nodeId: 'n1', metricId: 'mv1', texto: 'Valor editado', origenPoliticaId: 'pol2', type: 'control' });

    expect(nodeN1(payload).metricasValor).toEqual([]);
    expect(nodeN1(payload).metricasControl.at(-1)).toEqual({ id: 'mv1', texto: 'Valor editado', origenPoliticaId: 'pol2' });
  });

  it('borra una métrica', () => {
    const payload = makePayload();
    deleteMetric(project(payload), { nodeId: 'n1', metricId: 'mc1' });

    expect(nodeN1(payload).metricasControl).toEqual([]);
    expect(() => deleteMetric(project(payload), { nodeId: 'n1', metricId: 'mc1' })).toThrow('no tiene la métrica mc1');
  });
});

describe('createProject y mutateProjectIn', () => {
  it('crea un proyecto vacío sin cambiar el proyecto actual salvo que se pida', () => {
    const payload = makePayload();
    const { project: created } = createProject(payload, { name: 'Nuevo', aplicacionValorSuperior: 'Gobierno X' });

    expect(payload.projects).toHaveLength(2);
    expect(payload.currentProjectId).toBe('p1');
    expect(created).toMatchObject({ name: 'Nuevo', rootLabel: 'Gobierno X', topLevelCount: 0 });
  });

  it('aplica la mutación sobre el proyecto indicado y actualiza updatedAt', () => {
    const payload = makePayload();
    const result = mutateProjectIn(payload, undefined, updateRoot, { intencionSuperior: 'Otra' });

    expect(result.projectId).toBe('p1');
    expect(project(payload).updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('runMutation', () => {
  it('guarda con la revisión leída sin mutar el estado leído', async () => {
    const current = makePayload();
    const saveProjects = vi.fn().mockResolvedValue({ revision: 5 });

    const result = await runMutation({
      fetchProjects: vi.fn().mockResolvedValue(current),
      saveProjects,
      mutator: (draft) => mutateProjectIn(draft, 'p1', updateRoot, { intencionSuperior: 'Nueva' }),
    });

    expect(saveProjects.mock.calls[0][0].baseRevision).toBe(4);
    expect(saveProjects.mock.calls[0][0].projects[0].data.intencionSuperior).toBe('Nueva');
    expect(current.projects[0].data.intencionSuperior).toBe('Intención superior');
    expect(result).toMatchObject({ projectId: 'p1', revision: 5 });
  });

  it('reintenta sobre el estado nuevo cuando el guardado responde 409', async () => {
    const stale = makePayload();
    const fresh = { ...makePayload(), revision: 7 };
    fresh.projects[0].data.aplicacionValorSuperior = 'Cambio de otra persona';
    const conflict = Object.assign(new Error('conflicto'), { status: 409 });
    const saveProjects = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValue({ revision: 8 });

    await runMutation({
      fetchProjects: vi.fn().mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh),
      saveProjects,
      mutator: (draft) => mutateProjectIn(draft, 'p1', updateRoot, { intencionSuperior: 'Mía' }),
    });

    const saved = saveProjects.mock.calls[1][0];
    expect(saved.baseRevision).toBe(7);
    expect(saved.projects[0].data).toMatchObject({ aplicacionValorSuperior: 'Cambio de otra persona', intencionSuperior: 'Mía' });
  });

  it('aborta sin guardar si el borrador perdió algún proyecto', async () => {
    const saveProjects = vi.fn();

    await expect(runMutation({
      fetchProjects: vi.fn().mockResolvedValue(makePayload()),
      saveProjects,
      mutator: (draft) => {
        draft.projects = [];
        return {};
      },
    })).rejects.toThrow('se perderían los proyectos p1');
    expect(saveProjects).not.toHaveBeenCalled();
  });

  it('propaga errores que no son de concurrencia sin reintentar', async () => {
    const saveProjects = vi.fn().mockRejectedValue(Object.assign(new Error('HTTP 500'), { status: 500 }));

    await expect(runMutation({
      fetchProjects: vi.fn().mockResolvedValue(makePayload()),
      saveProjects,
      mutator: () => ({}),
    })).rejects.toThrow('HTTP 500');
    expect(saveProjects).toHaveBeenCalledTimes(1);
  });
});
