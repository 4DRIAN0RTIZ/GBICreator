import { useState } from 'react';
import { findNode } from '../domain/tree.js';

export function useItemEditor(data, mutateData) {
  const [currentItemEdit, setCurrentItemEdit] = useState(null);
  const [itemText, setItemText] = useState('');

  const openItem = (event, nodeId, field, index = -1) => {
    event?.stopPropagation();
    const node = findNode(data, nodeId);
    if (!node) return;
    setCurrentItemEdit({ nodeId, field, index });
    setItemText(index !== -1 ? node[field][index] : (node[field] || ''));
  };

  const openNewItem = (nodeId, field) => {
    setCurrentItemEdit({ nodeId, field, index: 'new' });
    setItemText('');
  };

  const closeItemModal = () => {
    setCurrentItemEdit(null);
    setItemText('');
  };

  const saveItemEdit = () => {
    if (!currentItemEdit) return;
    const value = itemText.trim();
    mutateData((next) => {
      const node = findNode(next, currentItemEdit.nodeId);
      if (!node) return;
      const { field, index } = currentItemEdit;
      if (index === 'new') {
        if (value) node[field].push(value);
      } else if (index !== -1) {
        if (!value) node[field].splice(index, 1);
        else node[field][index] = value;
      } else {
        node[field] = value;
      }
    });
    closeItemModal();
  };

  const deleteItemEdit = () => {
    if (!currentItemEdit || currentItemEdit.index === -1 || currentItemEdit.index === 'new') return;
    mutateData((next) => {
      const node = findNode(next, currentItemEdit.nodeId);
      if (node) node[currentItemEdit.field].splice(currentItemEdit.index, 1);
    });
    closeItemModal();
  };

  return {
    currentItemEdit,
    itemText,
    setItemText,
    openItem,
    openNewItem,
    closeItemModal,
    saveItemEdit,
    deleteItemEdit,
  };
}
