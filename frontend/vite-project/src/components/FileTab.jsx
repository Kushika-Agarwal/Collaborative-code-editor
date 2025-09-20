import React, { useState, useEffect, useRef } from 'react';
import './FileTab.css';
import { io } from 'socket.io-client';

// Replace with your backend port
const socket = io('http://localhost:3000');

const FileTab = ({
  file,
  isActive,
  onClick,
  onClose,
  onRename,
  isRenamable = true,
  isCollapsed = false,
  roomId,
  currentUser
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(file.filename);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeout = useRef(null);

  useEffect(() => {
    socket.on('userTyping', ({ user }) => {
      setTypingUsers((prev) =>
        prev.includes(user) ? prev : [...prev, user]
      );
    });

    socket.on('userStopTyping', ({ user }) => {
      setTypingUsers((prev) => prev.filter((u) => u !== user));
    });

    return () => {
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, []);

  const handleDoubleClick = () => {
    if (isRenamable) {
      setIsEditing(true);
      setNewName(file.filename);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newName.trim() && newName !== file.filename) {
      onRename(file.filename, newName.trim());
    }
    setIsEditing(false);
    socket.emit('stopTyping', { roomId, user: currentUser });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setNewName(file.filename);
      socket.emit('stopTyping', { roomId, user: currentUser });
    }
  };

  const handleCloseClick = (e) => {
    e.stopPropagation();
    onClose(file.filename);
  };

  const handleInputChange = (e) => {
    setNewName(e.target.value);
    socket.emit('typing', { roomId, user: currentUser });

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('stopTyping', { roomId, user: currentUser });
    }, 1000);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return '📄';
      case 'ts':
      case 'tsx':
        return '📘';
      case 'py':
        return '🐍';
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'txt':
        return '📄';
      default:
        return '📄';
    }
  };

  return (
    <div
      className={`file-tab ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      title={`${file.filename} - ${isActive ? 'Active' : 'Click to open'}`}
    >
      <span className="file-icon">{getFileIcon(file.filename)}</span>

      {!isCollapsed && (
        <>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="file-rename-form">
              <input
                type="text"
                value={newName}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  setIsEditing(false);
                  socket.emit('stopTyping', { roomId, user: currentUser });
                }}
                className="file-rename-input"
                autoFocus
              />
            </form>
          ) : (
            <span className="file-name">{file.filename}</span>
          )}

          {onClose && (
            <button
              className="file-close-btn"
              onClick={handleCloseClick}
              title="Close file"
            >
              ×
            </button>
          )}
        </>
      )}

      {file.lastModified && !isActive && (
        <span className="file-modified-indicator" title="File has unsaved changes">
          •
        </span>
      )}

      {!isCollapsed && <TypingIndicator typingUsers={typingUsers} currentUser={currentUser} />}
    </div>
  );
};

function TypingIndicator({ typingUsers, currentUser }) {
  const othersTyping = typingUsers.filter((u) => u !== currentUser);
  if (othersTyping.length === 0) return null;

  return (
    <div className="typing-indicator">
      {othersTyping.join(', ')} {othersTyping.length === 1 ? 'is' : 'are'} typing...
    </div>
  );
}

export default FileTab;