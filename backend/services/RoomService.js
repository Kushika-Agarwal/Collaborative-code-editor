// Room service - handles business logic for room operations
import Room from '../models/Room.js';

class RoomService {
  // File management methods
  
  // Create new file in room
  createFileInRoom(roomId, filename, createdBy, code = '', language = 'javascript') {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.createFile(filename, createdBy, code, language);
    }
    return { success: false, error: 'Room not found' };
  }
  
  // Delete file from room
  deleteFileFromRoom(roomId, filename) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.deleteFile(filename);
    }
    return { success: false, error: 'Room not found' };
  }
  
  // Rename file in room
  renameFileInRoom(roomId, oldFilename, newFilename) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.renameFile(oldFilename, newFilename);
    }
    return { success: false, error: 'Room not found' };
  }
  
  // Set active file in room
  setActiveFileInRoom(roomId, filename) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.setActiveFile(filename);
    }
    return { success: false, error: 'Room not found' };
  }
  
  // Get all files in room
  getRoomFiles(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.getAllFiles() : [];
  }
  
  // Get specific file in room
  getRoomFile(roomId, filename) {
    const room = this.rooms.get(roomId);
    return room ? room.getFile(filename) : null;
  }
  
  // Update file code in room
  updateFileCodeInRoom(roomId, filename, code) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.updateFileCode(filename, code);
    }
    return { success: false, error: 'Room not found' };
  }
  
  // Update file language in room
  updateFileLanguageInRoom(roomId, filename, language) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.updateFileLanguage(filename, language);
    }
    return { success: false, error: 'Room not found' };
  }

  // Update filename in room (legacy method for backward compatibility)
  updateRoomFilename(roomId, newFilename) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.updateFilename(newFilename);
    }
    return null;
  }
  constructor() {
    this.rooms = new Map(); // In-memory room storage
  }

  // Get or create a room
  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId));
    }
    return this.rooms.get(roomId);
  }

  // Add user to room
  addUserToRoom(roomId, userName) {
    const room = this.getOrCreateRoom(roomId);
    const users = room.addUser(userName);
    return { room, users };
  }

  // Remove user from room
  removeUserFromRoom(roomId, userName) {
    const room = this.rooms.get(roomId);
    if (room) {
      const users = room.removeUser(userName);
      
      // Clean up empty rooms
      if (users.length === 0) {
        this.rooms.delete(roomId);
      }
      
      return { room, users };
    }
    return { room: null, users: [] };
  }

  // Update code in room
  updateRoomCode(roomId, code) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.updateCode(code);
    }
    return null;
  }

  // Update language in room
  updateRoomLanguage(roomId, language) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.updateLanguage(language);
    }
    return null;
  }

  // Add message to room
  addMessageToRoom(roomId, userName, message) {
    const room = this.rooms.get(roomId);
    if (room) {
      return room.addMessage(userName, message);
    }
    return null;
  }

  // Get room users
  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.getUsers() : [];
  }

  // Get room info
  getRoomInfo(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.getInfo() : null;
  }

  // Check if room exists
  roomExists(roomId) {
    return this.rooms.has(roomId);
  }

  // Get all rooms (for admin purposes)
  getAllRooms() {
    return Array.from(this.rooms.keys());
  }

  // Get room statistics
  getRoomStats() {
    const stats = {
      totalRooms: this.rooms.size,
      rooms: []
    };

    for (const [roomId, room] of this.rooms) {
      stats.rooms.push({
        roomId,
        userCount: room.getUsers().length,
        language: room.getLanguage()
      });
    }

    return stats;
  }
}

export default new RoomService(); 