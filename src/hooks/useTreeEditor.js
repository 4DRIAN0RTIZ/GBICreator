import { useState } from 'react';
import { showConfirm } from '../lib/dialogs.js';
import {
  findNode,
  cloneData,
  makeBlankNode,
  cloneValueBlock,
  countDescendants,
  detachNodeById,
  insertNodeAfterSibling,
  setCollapsedRecursive,
  sanitizeMetricList,
} from '../domain/tree.js';

// Combina el estado del panel de edición con las acciones que mutan el
// árbol (agregar, duplicar, desconectar, eliminar, colapsar) porque varias
// de esas acciones necesitan abrir o cerrar el editor como parte del mismo
// gesto del usuario (ej.: agregar hijo abre su editor; eliminar el nodo que
// se está editando lo cierra).
export function useTreeEditor(data, mutateData) {
  const [currentEditId, setCurrentEditId] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);
  const currentEditNode = currentEditId ? findNode(data, currentEditId) : null;

  const openEditor = (_event, id) => {
    const node = findNode(data, id);
    if (!node) return;
    setCurrentEditId(id);
    setEditorDraft(cloneData(node));
  };

  const closeEditor = () => {
    setCurrentEditId(null);
    setEditorDraft(null);
  };

  const saveEditor = (event) => {
    event.preventDefault();
    if (!currentEditId || !editorDraft) return;
    mutateData((next) => {
      const node = findNode(next, currentEditId);
      if (!node) return;
      if (node.isRoot) {
        node.aplicacionValorSuperior = (editorDraft.aplicacionValorSuperior || '').trim();
        node.intencionSuperior = (editorDraft.intencionSuperior || '').trim();
      } else {
        node.titulo = (editorDraft.titulo || '').trim() || 'Quiero...';
        node.pregunta = (editorDraft.pregunta || '').trim();
        node.intencionSubyacente = (editorDraft.intencionSubyacente || '').trim();

        const politicas = (editorDraft.politicas || [])
          .map((item) => ({ id: item.id, texto: (item.texto || '').trim() }))
          .filter((item) => item.texto);
        const validPolicyIds = new Set(politicas.map((policy) => policy.id));
        const fallbackPolicyId = politicas[0]?.id ?? null;
        node.politicas = politicas;
        node.metricasValor = sanitizeMetricList(editorDraft.metricasValor, validPolicyIds, fallbackPolicyId);
        node.metricasControl = sanitizeMetricList(editorDraft.metricasControl, validPolicyIds, fallbackPolicyId);
        node.categoriaId = editorDraft.categoriaId || null;
      }
    });
    closeEditor();
  };

  const deleteNodeById = async (id) => {
    const node = findNode(data, id);
    if (!node || node.isRoot) return;
    const label = node.titulo || 'este nodo';
    const childCount = countDescendants(node);
    const msg = childCount > 0
      ? `¿Eliminar "${label}" y sus ${childCount} nodo(s) hijo(s)? Esta acción no se puede deshacer.`
      : `¿Eliminar "${label}"? Esta acción no se puede deshacer.`;
    if (!await showConfirm({ title: 'Eliminar nodo', text: msg, confirmText: 'Eliminar' })) return;
    mutateData((next) => detachNodeById(next, id));
    if (currentEditId === id) closeEditor();
  };

  const addChild = (event, parentId) => {
    event?.stopPropagation();
    const nuevo = makeBlankNode();
    mutateData((next) => {
      const parent = findNode(next, parentId);
      if (!parent) return;
      parent.hijos.push(nuevo);
      parent.collapsed = false;
    });
    setCurrentEditId(nuevo.id);
    setEditorDraft(cloneData(nuevo));
  };

  const disconnectNode = async (event, id) => {
    event?.stopPropagation();
    const node = findNode(data, id);
    if (!node || node.isRoot) return;
    const label = node.titulo || 'este nodo';
    const confirmed = await showConfirm({
      title: 'Desconectar nodo',
      text: `¿Desconectar "${label}" del árbol? Se mueve a Nodos aislados junto con lo que cuelgue de él, sin borrar nada.`,
      icon: 'info',
      confirmText: 'Desconectar',
    });
    if (!confirmed) return;
    mutateData((next) => {
      const detached = detachNodeById(next, id);
      if (detached) next.sueltos.push(detached);
    });
    if (currentEditId === id) closeEditor();
  };

  const duplicateNode = (event, id) => {
    event?.stopPropagation();
    const node = findNode(data, id);
    if (!node || node.isRoot) return;
    const duplicate = cloneValueBlock(node);
    mutateData((next) => insertNodeAfterSibling(next, id, duplicate));
    setCurrentEditId(duplicate.id);
    setEditorDraft(cloneData(duplicate));
  };

  const createIsolatedNode = () => {
    const nuevo = makeBlankNode();
    mutateData((next) => next.sueltos.push(nuevo));
    setCurrentEditId(nuevo.id);
    setEditorDraft(cloneData(nuevo));
  };

  const toggleCollapsed = (event, id) => {
    event.stopPropagation();
    mutateData((next) => {
      const node = findNode(next, id);
      if (node) node.collapsed = !node.collapsed;
    });
  };

  const setCollapsedEverywhere = (value) => {
    mutateData((next) => {
      setCollapsedRecursive(next, value);
      next.sueltos.forEach((loose) => setCollapsedRecursive(loose, value));
    });
  };

  const setNodeCategory = (nodeId, categoryId) => {
    mutateData((next) => {
      const node = findNode(next, nodeId);
      if (node) node.categoriaId = categoryId || null;
    });
  };

  return {
    currentEditId,
    editorDraft,
    setEditorDraft,
    currentEditNode,
    openEditor,
    closeEditor,
    saveEditor,
    deleteNodeById,
    addChild,
    disconnectNode,
    duplicateNode,
    createIsolatedNode,
    toggleCollapsed,
    setCollapsedEverywhere,
    setNodeCategory,
  };
}
