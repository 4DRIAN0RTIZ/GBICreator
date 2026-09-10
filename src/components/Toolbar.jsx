export function Toolbar({
  projects,
  currentProjectId,
  onSwitchProject,
  onCreateProject,
  onRenameProject,
  fileInputRef,
  onLoadFile,
  onSaveJson,
  onExportPng,
  onExportXlsx,
  onCreateIsolatedNode,
  onOpenCategoryPanel,
  onExpandAll,
  onCollapseAll,
  saveStatus,
}) {
  return (
    <header id="app-header">
      <h1><img src="/logo.png" alt="GBI Creator" /></h1>
      <div className="toolbar">
        <div className="toolbar-group project-group">
          <select className="project-picker" value={currentProjectId} onChange={(event) => onSwitchProject(event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <button id="btn-new" className="icon-tool-btn" title="Crear un proyecto nuevo sin borrar el actual" type="button" onClick={onCreateProject}><i className="fa-solid fa-folder-plus" /></button>
          <button className="icon-tool-btn" type="button" title="Cambiar el nombre del proyecto actual" onClick={onRenameProject}><i className="fa-solid fa-pen" /></button>
        </div>
        <div className="toolbar-group">
          <button id="btn-load" className="icon-tool-btn" title="Reemplazar solo el proyecto actual con un archivo .json" type="button" onClick={() => fileInputRef.current?.click()}><i className="fa-solid fa-upload" /></button>
          <input ref={fileInputRef} type="file" id="file-input" accept="application/json" hidden onChange={onLoadFile} />
          <button id="btn-save" className="icon-tool-btn" title="Descargar solo el proyecto actual como .json" type="button" onClick={onSaveJson}><i className="fa-solid fa-download" /></button>
          <button id="btn-export-png" className="icon-tool-btn" title="Exportar el árbol completo como imagen PNG en alta resolución" type="button" onClick={onExportPng}><i className="fa-solid fa-image" /></button>
          <button id="btn-export-xlsx" className="icon-tool-btn" title="Exportar todas las Aplicaciones de valor (todos los niveles) como tablero .xlsx" type="button" onClick={onExportXlsx}><i className="fa-solid fa-file-excel" /></button>
        </div>
        <div className="toolbar-group">
          <button id="btn-new-isolated" className="icon-tool-btn" title="Crear una Aplicación de valor suelta, sin conectar a nada todavía" type="button" onClick={onCreateIsolatedNode}><i className="fa-solid fa-circle-plus" /></button>
        </div>
        <div className="toolbar-group">
          <button className="icon-tool-btn" type="button" title="Administrar categorías compartidas (círculo de color por grupo)" onClick={onOpenCategoryPanel}><i className="fa-solid fa-tags" /></button>
        </div>
        <div className="toolbar-group">
          <button id="btn-expand-all" className="icon-tool-btn" title="Expandir todas las ramas" type="button" onClick={onExpandAll}><i className="fa-solid fa-expand" /></button>
          <button id="btn-collapse-all" className="icon-tool-btn" title="Colapsar todas las ramas" type="button" onClick={onCollapseAll}><i className="fa-solid fa-compress" /></button>
        </div>
        <span id="save-status" className="save-status">{saveStatus}</span>
      </div>
    </header>
  );
}
