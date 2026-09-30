import { describe, expect, it } from 'vitest';
import {
  accessLevel,
  assertCanWriteAll,
  canRead,
  canWrite,
  filterProjectsPayload,
  filterSnapshot,
  filterSnapshotList,
  parseProjectAccess,
  resolveProjectId,
} from './mcpAccess.js';

const payload = {
  currentProjectId: 'iptm',
  isEmpty: false,
  revision: 3,
  projects: [
    { id: 'itam', name: 'ITAM' },
    { id: 'iptm', name: 'IPTM' },
    { id: 'otro', name: 'Otro' },
  ],
};

describe('parseProjectAccess', () => {
  it('sin variable no restringe nada', () => {
    const access = parseProjectAccess('');

    expect(access).toBeNull();
    expect(canWrite(access, 'cualquiera')).toBe(true);
  });

  it('interpreta niveles por proyecto y el comodín', () => {
    const access = parseProjectAccess(' itam:rw , iptm:R, *:r ');

    expect(accessLevel(access, 'itam')).toBe('rw');
    expect(accessLevel(access, 'iptm')).toBe('r');
    expect(accessLevel(access, 'otro')).toBe('r');
  });

  it('sin comodín, los proyectos no listados quedan fuera', () => {
    const access = parseProjectAccess('itam:rw');

    expect(canRead(access, 'iptm')).toBe(false);
    expect(canWrite(access, 'itam')).toBe(true);
  });

  it('rechaza entradas mal formadas', () => {
    expect(() => parseProjectAccess('itam')).toThrow('GBI_MCP_PROJECTS inválido en "itam"');
    expect(() => parseProjectAccess('itam:admin')).toThrow('inválido');
    expect(() => parseProjectAccess(':rw')).toThrow('inválido');
  });
});

describe('filterProjectsPayload', () => {
  it('deja solo proyectos legibles y reajusta el proyecto actual', () => {
    const view = filterProjectsPayload(payload, parseProjectAccess('itam:rw'));

    expect(view.projects.map((project) => project.id)).toEqual(['itam']);
    expect(view.currentProjectId).toBe('itam');
    expect(view.revision).toBe(3);
  });

  it('marca isEmpty cuando no hay proyectos accesibles', () => {
    const view = filterProjectsPayload(payload, parseProjectAccess('inexistente:r'));

    expect(view).toMatchObject({ projects: [], currentProjectId: null, isEmpty: true });
  });
});

describe('resolveProjectId', () => {
  const access = parseProjectAccess('itam:rw,iptm:r');

  it('usa el proyecto actual dentro del alcance si no se indica uno', () => {
    expect(resolveProjectId(payload, undefined, parseProjectAccess('itam:rw'))).toBe('itam');
  });

  it('permite leer un proyecto de solo lectura pero no escribirlo', () => {
    expect(resolveProjectId(payload, 'iptm', access)).toBe('iptm');
    expect(() => resolveProjectId(payload, 'iptm', access, { write: true })).toThrow('es de solo lectura');
  });

  it('distingue un proyecto fuera de alcance de uno inexistente', () => {
    expect(() => resolveProjectId(payload, 'otro', access)).toThrow('fuera del alcance');
    expect(() => resolveProjectId(payload, 'nope', access)).toThrow('No existe un proyecto con id nope');
  });

  it('escribe por defecto en el proyecto actual del alcance', () => {
    expect(resolveProjectId(payload, undefined, parseProjectAccess('itam:rw'), { write: true })).toBe('itam');
  });
});

describe('operaciones globales y snapshots', () => {
  it('crear o restaurar exige acceso sin restricción o *:rw', () => {
    expect(() => assertCanWriteAll(parseProjectAccess('itam:rw'), 'Restaurar snapshots')).toThrow('Restaurar snapshots no está permitido');
    expect(() => assertCanWriteAll(parseProjectAccess('itam:r,*:rw'), 'Crear proyectos')).not.toThrow();
    expect(() => assertCanWriteAll(null, 'Crear proyectos')).not.toThrow();
  });

  it('recorta los snapshots a proyectos legibles y oculta los que quedan vacíos', () => {
    const list = {
      snapshots: [
        { id: 2, projects: [{ id: 'itam' }, { id: 'iptm' }] },
        { id: 1, projects: [{ id: 'iptm' }] },
      ],
    };

    const filtered = filterSnapshotList(list, parseProjectAccess('itam:r'));

    expect(filtered.snapshots).toEqual([{ id: 2, projects: [{ id: 'itam' }] }]);
  });

  it('no expone un snapshot sin proyectos accesibles', () => {
    const snapshot = { id: 1, projects: [{ id: 'iptm', data: {} }], currentProjectId: 'iptm' };

    expect(() => filterSnapshot(snapshot, parseProjectAccess('itam:r'))).toThrow('no contiene proyectos dentro del alcance');
    expect(filterSnapshot(snapshot, null).projects).toHaveLength(1);
  });
});
