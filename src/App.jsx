import { useEffect, useRef, useState } from 'react';
import { safeFilename } from './lib/filename.js';
import { downloadJson } from './lib/downloadJson.js';
import { exportTreeAsPng } from './lib/exportPng.js';
import { exportTreeAsXlsx } from './lib/exportXlsx.js';
import { useProjects } from './hooks/useProjects.js';
import { useCategories } from './hooks/useCategories.js';
import { useCanvasView } from './hooks/useCanvasView.js';
import { useTreeEditor } from './hooks/useTreeEditor.js';
import { useItemEditor } from './hooks/useItemEditor.js';
import { useConnectModal } from './hooks/useConnectModal.js';
import { Toolbar } from './components/Toolbar.jsx';
import { IsolatedTray } from './components/IsolatedTray.jsx';
import { TreeNode } from './components/TreeNode.jsx';
import { EditorPanel } from './components/EditorPanel.jsx';
import { CategoryPanel } from './components/CategoryPanel.jsx';
import { Legend, LegendRows } from './components/Legend.jsx';
import { ConnectModal } from './components/ConnectModal.jsx';
import { ItemModal } from './components/ItemModal.jsx';

export default function App() {
  const [saveStatus, setSaveStatus] = useState('');
  const [categoryPanelVisible, setCategoryPanelVisible] = useState(false);
  const [legendVisible, setLegendVisible] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const fileInputRef = useRef(null);

  const projects = useProjects(setSaveStatus);
  const categoriesApi = useCategories(setSaveStatus);
  const canvas = useCanvasView();
  const treeEditor = useTreeEditor(projects.data, projects.mutateData);
  const itemEditor = useItemEditor(projects.data, projects.mutateData);
  const connect = useConnectModal(projects.data, projects.mutateData);

  const modalOpen = !!(treeEditor.currentEditId || itemEditor.currentItemEdit || connect.currentConnectId || categoryPanelVisible);

  const closeAllModals = () => {
    treeEditor.closeEditor();
    connect.closeConnectModal();
    itemEditor.closeItemModal();
    setCategoryPanelVisible(false);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      closeAllModals();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const handleCreateProject = () => {
    projects.createProject();
    closeAllModals();
    requestAnimationFrame(canvas.fitToScreen);
  };

  const handleSwitchProject = (projectId) => {
    projects.switchProject(projectId);
    closeAllModals();
    requestAnimationFrame(canvas.fitToScreen);
  };

  const handleLoadFile = (event) => {
    projects.loadFile(event, () => requestAnimationFrame(canvas.fitToScreen));
  };

  const deleteCategory = (id) => {
    const category = categoriesApi.categories.find((item) => item.id === id);
    if (!category) return;
    if (!confirm(`¿Eliminar la categoría "${category.name}"? Los nodos que la tengan asignada quedan sin categoría (vuelven al color por nivel) en todos los proyectos.`)) return;
    categoriesApi.removeCategory(id);
    projects.clearCategoryEverywhere(id);
  };

  const saveJson = () => {
    downloadJson(projects.data, `gbi-${safeFilename(projects.currentProject?.name)}-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const exportPng = async () => {
    const viewport = canvas.viewportRef.current;
    if (!viewport) return;
    setSaveStatus('Generando PNG…');
    setExportMode(true);
    try {
      await exportTreeAsPng(viewport, `gbi-${safeFilename(projects.currentProject?.name)}-${new Date().toISOString().slice(0, 10)}.png`);
      setSaveStatus(`PNG exportado ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setSaveStatus('No se pudo exportar el PNG');
      alert(`No se pudo exportar la imagen: ${error.message}`);
    } finally {
      setExportMode(false);
    }
  };

  const exportXlsx = async () => {
    setSaveStatus('Generando XLSX…');
    try {
      await exportTreeAsXlsx(projects.data, `gbi-${safeFilename(projects.currentProject?.name)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setSaveStatus(`XLSX exportado ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setSaveStatus('No se pudo exportar el XLSX');
      alert(`No se pudo exportar el Excel: ${error.message}`);
    }
  };

  const actions = {
    openItem: itemEditor.openItem,
    openNewItem: itemEditor.openNewItem,
    openEditor: treeEditor.openEditor,
    addChild: treeEditor.addChild,
    duplicateNode: treeEditor.duplicateNode,
    disconnectNode: treeEditor.disconnectNode,
    deleteNode: (event, id) => { event?.stopPropagation(); treeEditor.deleteNodeById(id); },
    toggleCollapsed: treeEditor.toggleCollapsed,
    setCategory: treeEditor.setNodeCategory,
  };

  return (
    <>
      <Toolbar
        projects={projects.projects}
        currentProjectId={projects.currentProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onRenameProject={projects.renameProject}
        fileInputRef={fileInputRef}
        onLoadFile={handleLoadFile}
        onSaveJson={saveJson}
        onExportPng={exportPng}
        onExportXlsx={exportXlsx}
        onCreateIsolatedNode={treeEditor.createIsolatedNode}
        onOpenCategoryPanel={() => setCategoryPanelVisible(true)}
        onExpandAll={() => treeEditor.setCollapsedEverywhere(false)}
        onCollapseAll={() => treeEditor.setCollapsedEverywhere(true)}
        saveStatus={saveStatus}
      />

      <IsolatedTray
        nodes={projects.data.sueltos}
        onEditNode={(id) => treeEditor.openEditor(null, id)}
        onConnectNode={connect.openConnectModal}
        onDeleteNode={treeEditor.deleteNodeById}
      />

      <main id="chart-scroll" ref={canvas.chartRef} className={canvas.isPanning ? 'panning' : ''} onMouseDown={canvas.handleCanvasMouseDown} onWheel={canvas.handleWheel}>
        <div id="tree-viewport" ref={canvas.viewportRef} style={{ transform: `translate(${canvas.view.x}px, ${canvas.view.y}px) scale(${canvas.view.scale})` }}>
          <div id="tree-root" className="tree">
            <ul><TreeNode node={projects.data} depth={0} actions={actions} categories={categoriesApi.categories} /></ul>
          </div>
          <div id="export-legend" className={exportMode ? '' : 'hidden'}>
            <strong>Simbología</strong>
            <LegendRows categories={categoriesApi.categories} />
          </div>
        </div>
        <div id="zoom-controls">
          <button type="button" id="zoom-out" title="Alejar (o rueda del mouse)" onClick={() => canvas.zoomAt(canvas.chartRef.current.getBoundingClientRect().width / 2, canvas.chartRef.current.getBoundingClientRect().height / 2, canvas.view.scale / 1.2)}>−</button>
          <button type="button" id="zoom-reset" title="Restablecer zoom a 100%" onClick={() => canvas.centerTree(1)}>{Math.round(canvas.view.scale * 100)}%</button>
          <button type="button" id="zoom-in" title="Acercar (o rueda del mouse)" onClick={() => canvas.zoomAt(canvas.chartRef.current.getBoundingClientRect().width / 2, canvas.chartRef.current.getBoundingClientRect().height / 2, canvas.view.scale * 1.2)}>+</button>
          <button type="button" id="zoom-fit" title="Ajustar todo el árbol a la pantalla" onClick={canvas.fitToScreen}>⤢</button>
        </div>
        <div id="canvas-hint" className={canvas.hintFaded ? 'faded' : ''}>Arrastra para mover · rueda del mouse para zoom</div>
        <Legend visible={legendVisible} setVisible={setLegendVisible} categories={categoriesApi.categories} />
      </main>

      <div id="overlay" className={modalOpen ? '' : 'hidden'} onClick={closeAllModals} />

      <EditorPanel
        node={treeEditor.currentEditNode}
        draft={treeEditor.editorDraft}
        setDraft={treeEditor.setEditorDraft}
        onClose={treeEditor.closeEditor}
        onSave={treeEditor.saveEditor}
        onDelete={() => treeEditor.currentEditId && treeEditor.deleteNodeById(treeEditor.currentEditId)}
        categories={categoriesApi.categories}
      />

      <CategoryPanel
        visible={categoryPanelVisible}
        onClose={() => setCategoryPanelVisible(false)}
        categories={categoriesApi.categories}
        onAdd={categoriesApi.addCategory}
        onUpdate={categoriesApi.updateCategory}
        onDelete={deleteCategory}
      />

      <ConnectModal
        node={connect.currentConnectNode}
        target={connect.connectTarget}
        setTarget={connect.setConnectTarget}
        options={connect.pickerOptions}
        onCancel={connect.closeConnectModal}
        onConfirm={() => { connect.connectNode(); connect.closeConnectModal(); }}
      />

      <ItemModal
        itemEdit={itemEditor.currentItemEdit}
        text={itemEditor.itemText}
        setText={itemEditor.setItemText}
        onClose={itemEditor.closeItemModal}
        onDelete={itemEditor.deleteItemEdit}
        onSave={itemEditor.saveItemEdit}
      />
    </>
  );
}
