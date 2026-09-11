import { useState } from 'react';
import { findNode, genId, removePolicyFromNode } from '../domain/tree.js';

const METRIC_FIELDS = new Set(['metricasValor', 'metricasControl']);
const LIST_FIELDS = new Set(['politicas', 'metricasValor', 'metricasControl']);

export function useItemEditor(data, mutateData) {
  const [currentItemEdit, setCurrentItemEdit] = useState(null);
  const [itemText, setItemText] = useState('');
  const [itemOrigin, setItemOrigin] = useState(null);
  const [itemPolicies, setItemPolicies] = useState([]);

  const openItem = (event, nodeId, field, index = -1) => {
    event?.stopPropagation();
    const node = findNode(data, nodeId);
    if (!node) return;
    setCurrentItemEdit({ nodeId, field, index });
    setItemPolicies(node.politicas || []);
    if (!LIST_FIELDS.has(field)) {
      setItemText(node[field] || '');
      setItemOrigin(null);
      return;
    }
    const item = index !== -1 ? node[field][index] : null;
    setItemText(item?.texto || '');
    setItemOrigin(METRIC_FIELDS.has(field) ? (item?.origenPoliticaId ?? node.politicas[0]?.id ?? null) : null);
  };

  const openNewItem = (nodeId, field) => {
    const node = findNode(data, nodeId);
    setCurrentItemEdit({ nodeId, field, index: 'new' });
    setItemText('');
    setItemPolicies(node?.politicas || []);
    setItemOrigin(METRIC_FIELDS.has(field) ? (node?.politicas[0]?.id ?? null) : null);
  };

  const closeItemModal = () => {
    setCurrentItemEdit(null);
    setItemText('');
    setItemOrigin(null);
    setItemPolicies([]);
  };

  const saveItemEdit = () => {
    if (!currentItemEdit) return;
    const value = itemText.trim();
    const { field, index } = currentItemEdit;
    mutateData((next) => {
      const node = findNode(next, currentItemEdit.nodeId);
      if (!node) return;

      if (field === 'politicas') {
        if (index === 'new') {
          if (value) node.politicas.push({ id: genId(), texto: value });
        } else if (index !== -1) {
          if (!value) removePolicyFromNode(node, node.politicas[index].id);
          else node.politicas[index] = { ...node.politicas[index], texto: value };
        }
        return;
      }

      if (METRIC_FIELDS.has(field)) {
        if (index === 'new') {
          if (value && itemOrigin) node[field].push({ id: genId(), texto: value, origenPoliticaId: itemOrigin });
        } else if (index !== -1) {
          if (!value) node[field].splice(index, 1);
          else node[field][index] = { ...node[field][index], texto: value, origenPoliticaId: itemOrigin };
        }
        return;
      }

      if (index === 'new' || index === -1) {
        node[field] = value;
      }
    });
    closeItemModal();
  };

  const deleteItemEdit = () => {
    if (!currentItemEdit || currentItemEdit.index === -1 || currentItemEdit.index === 'new') return;
    mutateData((next) => {
      const node = findNode(next, currentItemEdit.nodeId);
      if (!node) return;
      const { field, index } = currentItemEdit;
      if (field === 'politicas') removePolicyFromNode(node, node.politicas[index].id);
      else node[field].splice(index, 1);
    });
    closeItemModal();
  };

  return {
    currentItemEdit,
    itemText,
    setItemText,
    itemOrigin,
    setItemOrigin,
    itemPolicies,
    openItem,
    openNewItem,
    closeItemModal,
    saveItemEdit,
    deleteItemEdit,
  };
}
