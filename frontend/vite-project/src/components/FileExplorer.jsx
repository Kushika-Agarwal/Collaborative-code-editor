import React, { useState } from 'react';
import FileTab from './FileTab';
import './FileExplorer.css';
import { detectFileType } from '../utils/fileTypeDetection';

const FileExplorer = ({ 
  files = [], 
  activeFile, 
  onFileCreate, 
  onFileDelete, 
  onFileRename, 
  onFileSwitch,
  userName
}) => {
  const [showNewFileForm, setShowNewFileForm] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(null);
  const fileInputRef = React.useRef(null);
  const folderInputRef = React.useRef(null);

  const handleCreateFile = (e) => {
    e.preventDefault();
    if (newFileName.trim()) {
      const filename = newFileName.trim();
      const language = detectFileType(filename) || 'javascript';
      onFileCreate(filename, userName, '', language);
      setNewFileName('');
      setShowNewFileForm(false);
    }
  };

  const handleFileDelete = (filename) => {
    if (files.length <= 1) {
      alert('Cannot delete the last file in the room');
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${filename}"?`)) {
      onFileDelete(filename, userName);
    }
    setShowContextMenu(null);
  };

  const handleContextMenu = (e, filename) => {
    e.preventDefault();
    setShowContextMenu({ filename, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setShowContextMenu(null);
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Import: read selected FileList and create files in room
  const importFileList = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const readFile = (f) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result ?? '');
      reader.onerror = reject;
      reader.readAsText(f);
    });
    for (const f of fileList) {
      try {
        // Prefer webkitRelativePath to preserve folders; fallback to name
        const name = (f.webkitRelativePath && f.webkitRelativePath.length > 0) ? f.webkitRelativePath : f.name;
        const code = await readFile(f);
        const language = detectFileType(name) || 'javascript';
        onFileCreate(name, userName, code, language);
      } catch (err) {
        console.error('Failed to import file:', f.name, err);
      }
    }
  };

  const triggerImportFiles = () => fileInputRef.current?.click();
  const triggerImportFolder = () => folderInputRef.current?.click();

  const onFilesSelected = async (e) => {
    const list = e.target.files;
    await importFileList(list);
    e.target.value = '';
  };

  const onFolderSelected = async (e) => {
    const list = e.target.files;
    await importFileList(list);
    e.target.value = '';
  };

  // Export helpers
  const downloadBlob = (content, filename, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportCurrent = () => {
    const file = files.find(f => f.filename === activeFile);
    if (!file) {
      alert('No active file to export');
      return;
    }
    downloadBlob(file.code ?? '', file.filename);
  };

  const handleExportAll = async () => {
    if (!files || files.length === 0) {
      alert('No files to export');
      return;
    }
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      files.forEach(f => {
        const path = f.filename || 'untitled.txt';
        zip.file(path, f.code ?? '');
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export all failed:', err);
      alert('Failed to export all files');
    }
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <h3>Files</h3>
        <button 
          className="new-file-btn"
          onClick={() => setShowNewFileForm(!showNewFileForm)}
          title="Create new file"
        >
          +
        </button>
      </div>

      {/* File Actions Toolbar */}
      <div className="file-actions-toolbar">
        <div className="import-actions">
          <button className="import-files-btn" onClick={triggerImportFiles} title="Import files">
            <span className="icon">📄</span> <span>Import Files</span>
          </button>
          <button className="import-folder-btn" onClick={triggerImportFolder} title="Import a folder">
            <span className="icon">📁</span> <span>Import Folder</span>
          </button>
        </div>
        <div className="export-actions">
          <button className="export-current-btn" onClick={handleExportCurrent} title="Download active file">
            <span className="icon">⬇️</span> <span>Export Current</span>
          </button>
          <button className="export-all-btn" onClick={handleExportAll} title="Download all files as ZIP">
            <span className="icon">📦</span> <span>Export All</span>
          </button>
        </div>
        {/* Hidden inputs for file/folder selection */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={onFilesSelected}
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          style={{ display: 'none' }}
          onChange={onFolderSelected}
        />
      </div>

      {showNewFileForm && (
        <div className="new-file-form-container">
          <form onSubmit={handleCreateFile} className="new-file-form">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter filename (e.g., main.js)"
              className="new-file-input"
              autoFocus
            />
            <div className="new-file-buttons">
              <button type="submit" className="create-btn">Create</button>
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => {
                  setShowNewFileForm(false);
                  setNewFileName('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="file-tabs-container">
        {files.map((file) => (
          <div
            key={file.filename}
            onContextMenu={(e) => handleContextMenu(e, file.filename)}
          >
            <FileTab
              file={file}
              isActive={file.filename === activeFile}
              onClick={() => onFileSwitch(file.filename, userName)}
              onClose={files.length > 1 ? (filename) => handleFileDelete(filename) : null}
              onRename={onFileRename}
              isRenamable={true}
            />
          </div>
        ))}
      </div>

      {files.length === 0 && (
        <div className="no-files-message">
          No files in this room. Create a new file to get started.
        </div>
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: showContextMenu.x,
            top: showContextMenu.y,
            zIndex: 1000
          }}
        >
          <button
            className="context-menu-item"
            onClick={() => handleFileDelete(showContextMenu.filename)}
            disabled={files.length <= 1}
          >
            Delete File
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              // Trigger rename by simulating double click on the tab
              closeContextMenu();
            }}
          >
            Rename File
          </button>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
