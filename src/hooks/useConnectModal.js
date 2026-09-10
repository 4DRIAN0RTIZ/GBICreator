import { useMemo, useState } from 'react';
import { findNode, findNodeIn, detachNodeById, flattenTreeForPicker } from '../domain/tree.js';

export function useConnectModal(data, mutateData) {
  const [currentConnectId, setCurrentConnectId] = useState(null);
  const [connectTarget, setConnectTarget] = useState('root');
  const currentConnectNode = currentConnectId ? findNode(data, currentConnectId) : null;
  const pickerOptions = useMemo(() => flattenTreeForPicker(data), [data]);

  const connectNode = () => {
    if (!currentConnectId || !connectTarget || currentConnectId === connectTarget) return;
    const target = findNode(data, connectTarget);
    const subtree = findNode(data, currentConnectId);
    if (!target || !subtree) return;
    if (findNodeIn(subtree, connectTarget)) {
      alert('No se puede conectar un nodo dentro de su propio sub-árbol.');
      return;
    }
    mutateData((next) => {
      const nextTarget = findNode(next, connectTarget);
      const detached = detachNodeById(next, currentConnectId);
      if (!nextTarget || !detached) return;
      nextTarget.hijos.push(detached);
      nextTarget.collapsed = false;
    });
  };

  const openConnectModal = (id) => {
    setCurrentConnectId(id);
    setConnectTarget('root');
  };

  const closeConnectModal = () => {
    setCurrentConnectId(null);
    setConnectTarget('root');
  };

  return {
    currentConnectId,
    connectTarget,
    setConnectTarget,
    currentConnectNode,
    pickerOptions,
    connectNode,
    openConnectModal,
    closeConnectModal,
  };
}
