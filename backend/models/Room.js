// Room model - handles room data and operations
import roomDatabase from '../config/database.js';

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.users = new Set();
    this.files = new Map(); // Map of filename -> { code, language, lastModified }
    this.activeFile = 'untitled.js'; // Currently active file
    this.messages = [];
    
    // Initialize with default file
    this.files.set('untitled.js', {
      code: '',
      language: 'javascript',
      lastModified: new Date().toISOString(),
      createdBy: 'system'
    });
  }
  // File management methods
  
  // Create a new file
  createFile(filename, createdBy, code = '', language = 'javascript') {
    if (this.files.has(filename)) {
      return { success: false, error: 'File already exists' };
    }
    
    this.files.set(filename, {
      code,
      language,
      lastModified: new Date().toISOString(),
      createdBy
    });
    
    return { success: true, file: this.getFile(filename) };
  }
  
  // Delete a file
  deleteFile(filename) {
    if (!this.files.has(filename)) {
      return { success: false, error: 'File not found' };
    }
    
    if (this.files.size <= 1) {
      return { success: false, error: 'Cannot delete the last file in room' };
    }
    
    this.files.delete(filename);
    
    // If deleted file was active, switch to first available file
    if (this.activeFile === filename) {
      this.activeFile = this.files.keys().next().value;
    }
    
    return { success: true };
  }
  
  // Rename a file
  renameFile(oldFilename, newFilename) {
    if (!this.files.has(oldFilename)) {
      return { success: false, error: 'File not found' };
    }
    
    if (this.files.has(newFilename)) {
      return { success: false, error: 'File with new name already exists' };
    }
    
    const fileData = this.files.get(oldFilename);
    this.files.delete(oldFilename);
    this.files.set(newFilename, {
      ...fileData,
      lastModified: new Date().toISOString()
    });
    
    // Update active file if necessary
    if (this.activeFile === oldFilename) {
      this.activeFile = newFilename;
    }
    
    return { success: true };
  }
  
  // Set active file
  setActiveFile(filename) {
    if (!this.files.has(filename)) {
      return { success: false, error: 'File not found' };
    }
    
    this.activeFile = filename;
    return { success: true };
  }
  
  // Get active file
  getActiveFile() {
    return this.activeFile;
  }
  
  // Get specific file
  getFile(filename) {
    const fileData = this.files.get(filename);
    if (!fileData) return null;
    
    return {
      filename,
      ...fileData,
      isActive: filename === this.activeFile
    };
  }
  
  // Get all files
   getAllFiles() {
  return Array.from(this.files.entries())
    .map(([filename, fileData]) => ({
      filename,
      ...fileData,
      isActive: filename === this.activeFile
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

  
  // Update file content
  updateFileCode(filename, code) {
    if (!this.files.has(filename)) {
      return { success: false, error: 'File not found' };
    }
    
    const fileData = this.files.get(filename);
    this.files.set(filename, {
      ...fileData,
      code,
      lastModified: new Date().toISOString()
    });
    
    return { success: true };
  }
  
  // Update file language
  updateFileLanguage(filename, language) {
    if (!this.files.has(filename)) {
      return { success: false, error: 'File not found' };
    }
    
    const fileData = this.files.get(filename);
    this.files.set(filename, {
      ...fileData,
      language,
      lastModified: new Date().toISOString()
    });
    
    return { success: true };
  }

  // Legacy methods for backward compatibility
  updateFilename(newFilename) {
    const result = this.renameFile(this.activeFile, newFilename);
    return result.success ? newFilename : null;
  }

  getFilename() {
    return this.activeFile;
  }

  // Add user to room
  addUser(userName) {
    this.users.add(userName);
    roomDatabase.addUserToRoom(this.roomId, userName);
    return this.getUsers();
  }

  // Remove user from room
  removeUser(userName) {
    this.users.delete(userName);
    roomDatabase.removeUserFromRoom(this.roomId, userName);
    return this.getUsers();
  }

  // Get all users in room
  getUsers() {
    return Array.from(this.users);
  }

  // Update code in room (for active file)
  updateCode(code) {
    return this.updateFileCode(this.activeFile, code).success ? code : null;
  }

  // Get current code (from active file)
  getCode() {
    const file = this.getFile(this.activeFile);
    return file ? file.code : '';
  }

  // Update language (for active file)
  updateLanguage(language) {
    return this.updateFileLanguage(this.activeFile, language).success ? language : null;
  }

  // Get current language (from active file)
  getLanguage() {
    const file = this.getFile(this.activeFile);
    return file ? file.language : 'javascript';
  }

  // Add chat message
  addMessage(userName, message) {
    const messageObj = {
      userName,
      message,
      timestamp: new Date().toISOString()
    };
    this.messages.push(messageObj);
    return messageObj;
  }

  // Get recent messages (last 50)
  getMessages() {
    return this.messages.slice(-50);
  }

  // Check if user is in room
  hasUser(userName) {
    return this.users.has(userName);
  }

  // Get room info
  getInfo() {
    return {
      roomId: this.roomId,
      users: this.getUsers(),
      userCount: this.users.size,
      language: this.getLanguage(),
      activeFile: this.activeFile,
      files: this.getAllFiles()
    };
  }
}

export default Room; 