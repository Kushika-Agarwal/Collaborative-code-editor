// Room controller - handles room-related socket events and business logic
import roomService from '../services/RoomService.js';
import userService from '../services/UserService.js';

class RoomController {
  // File management methods
  
  // Handle creating a new file
  handleCreateFile(socket, { roomId, filename, createdBy, code = '', language = 'javascript' }) {
    try {
      const result = roomService.createFileInRoom(roomId, filename, createdBy, code, language);
      if (result.success) {
        // Broadcast new file to all users in the room
        this.io.in(roomId).emit("fileCreated", { 
          file: result.file,
          createdBy 
        });
        return { success: true, file: result.file };
      }
      return result;
    } catch (error) {
      console.error('Error in handleCreateFile:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Handle deleting a file
  handleDeleteFile(socket, { roomId, filename, deletedBy }) {
    try {
      const result = roomService.deleteFileFromRoom(roomId, filename);
      if (result.success) {
        // Broadcast file deletion to all users in the room
        this.io.in(roomId).emit("fileDeleted", { 
          filename,
          deletedBy,
          newActiveFile: roomService.getRoomInfo(roomId).activeFile
        });
        return { success: true };
      }
      return result;
    } catch (error) {
      console.error('Error in handleDeleteFile:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Handle renaming a file
  handleRenameFile(socket, { roomId, oldFilename, newFilename, renamedBy }) {
    try {
      const result = roomService.renameFileInRoom(roomId, oldFilename, newFilename);
      if (result.success) {
        // Broadcast file rename to all users in the room
        this.io.in(roomId).emit("fileRenamed", { 
          oldFilename,
          newFilename,
          renamedBy 
        });
        return { success: true };
      }
      return result;
    } catch (error) {
      console.error('Error in handleRenameFile:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Handle switching active file
  handleSwitchFile(socket, { roomId, filename, switchedBy }) {
    try {
      const result = roomService.setActiveFileInRoom(roomId, filename);
      if (result.success) {
        const file = roomService.getRoomFile(roomId, filename);
        // Broadcast active file change to all users in the room
        this.io.in(roomId).emit("activeFileChanged", { 
          filename,
          file,
          switchedBy 
        });
        return { success: true, file };
      }
      return result;
    } catch (error) {
      console.error('Error in handleSwitchFile:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Handle getting all files in room
  handleGetFiles(socket, { roomId }) {
    try {
      const files = roomService.getRoomFiles(roomId);
      const activeFile = roomService.getRoomInfo(roomId)?.activeFile;
      socket.emit("filesUpdated", { files, activeFile });
      return { success: true, files };
    } catch (error) {
      console.error('Error in handleGetFiles:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Handle updating file code
  handleFileCodeChange(socket, { roomId, filename, code }) {
    try {
      const result = roomService.updateFileCodeInRoom(roomId, filename, code);
      if (result.success) {
        // Broadcast file code change to all users in the room except sender
        socket.to(roomId).emit("fileCodeUpdated", { filename, code });
        return { success: true };
      }
      return result;
    } catch (error) {
      console.error('Error in handleFileCodeChange:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Handle updating file language
  handleFileLanguageChange(socket, { roomId, filename, language }) {
    try {
      const result = roomService.updateFileLanguageInRoom(roomId, filename, language);
      if (result.success) {
        // Broadcast file language change to all users in the room except sender
        socket.to(roomId).emit("fileLanguageUpdated", { filename, language });
        return { success: true };
      }
      return result;
    } catch (error) {
      console.error('Error in handleFileLanguageChange:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle filename changes in room (legacy method, updated to work with new file system)
  handleFilenameChange(socket, { roomId, oldFilename, newFilename, userName }) {
    try {
      // Use the new rename file method
      const result = roomService.renameFileInRoom(roomId, oldFilename, newFilename);
      if (result.success) {
        // Broadcast filename change to all users in the room
        this.io.in(roomId).emit("filenameChanged", { oldFilename, newFilename, userName });
        // Broadcast system chat message
        const systemMessage = `Filename changed from "${oldFilename}" to "${newFilename}" by ${userName}`;
        this.io.in(roomId).emit("chatMessage", { userName: "System", message: systemMessage });
        console.log(systemMessage);
        return { success: true };
      }
      return result;
    } catch (error) {
      console.error('Error in handleFilenameChange:', error);
      return { success: false, error: error.message };
    }
  }
  constructor(io) {
    this.io = io; // Store io instance for broadcasting
  }
  
  // Handle remote cursor movement
  handleCursorMove(socket, { roomId, filename, position }) {
    try {
      const user = userService.getUser(socket.id);
      if (user) {
        // Broadcast to all users in the room except sender
        socket.to(roomId).emit("cursorPosition", {
          roomId,
          filename,
          position,
          userId: socket.id,
          userName: user.userName,
        });
      }
      return { success: true };
    } catch (error) {
      console.error('Error in handleCursorMove:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle clearing of a user's cursor (e.g., on leave/disconnect)
  handleCursorClear(socket, { roomId, userId }) {
    try {
      // Broadcast to all users in the room except sender
      socket.to(roomId).emit("cursorCleared", { userId });
      return { success: true };
    } catch (error) {
      console.error('Error in handleCursorClear:', error);
      return { success: false, error: error.message };
    }
  }
  // Handle user joining a room
  handleJoinRoom(socket, { roomId, userName }) {
    try {
      // Create user if doesn't exist
      let user = userService.getUser(socket.id);
      if (!user) {
        user = userService.createUser(socket.id, userName);
      } else {
        // Update user name if changed
        userService.updateUserName(socket.id, userName);
      }

      // Leave previous room if any
      const previousRoom = user.getCurrentRoom();
      if (previousRoom) {
        socket.leave(previousRoom);
        const { users } = roomService.removeUserFromRoom(previousRoom, user.userName);
        this.io.in(previousRoom).emit("userJoined", users);
      }

      // Join new room
      socket.join(roomId);
      userService.updateUserRoom(socket.id, roomId);
      const { users } = roomService.addUserToRoom(roomId, userName);

      // Notify all users in the room
      this.io.in(roomId).emit("userJoined", users);
      
      // Send current files and active file to the newly joined user
      const roomInfo = roomService.getRoomInfo(roomId);
      if (roomInfo) {
        socket.emit("filesUpdated", { 
          files: roomInfo.files, 
          activeFile: roomInfo.activeFile 
        });
        
        // Send current active file content
        const activeFileData = roomService.getRoomFile(roomId, roomInfo.activeFile);
        if (activeFileData) {
          socket.emit("codeUpdated", activeFileData.code);
          socket.emit("languageUpdated", activeFileData.language);
        }
      }
      
      console.log(`User ${userName} joined room ${roomId}`);
      return { success: true, users };
    } catch (error) {
      console.error('Error in handleJoinRoom:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle code changes in room
  handleCodeChange(socket, { roomId, code }) {
    try {
      const updatedCode = roomService.updateRoomCode(roomId, code);
        if (updatedCode !== null) {
          // Broadcast to all users in the room, including sender
          this.io.in(roomId).emit("codeUpdated", code);
          return { success: true };
        }
      return { success: false, error: 'Room not found' };
    } catch (error) {
      console.error('Error in handleCodeChange:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle language changes in room
  handleLanguageChange(socket, { roomId, language }) {
    try {
      const updatedLanguage = roomService.updateRoomLanguage(roomId, language);
      if (updatedLanguage !== null) {
        socket.to(roomId).emit("languageUpdated", language);
        return { success: true };
      }
      return { success: false, error: 'Room not found' };
    } catch (error) {
      console.error('Error in handleLanguageChange:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle user leaving room
  handleLeaveRoom(socket) {
    try {
      const user = userService.getUser(socket.id);
      if (user && user.getCurrentRoom()) {
        const roomId = user.getCurrentRoom();
        const userName = user.userName;

        socket.leave(roomId);
        userService.removeUserFromRoom(socket.id);
        const { users } = roomService.removeUserFromRoom(roomId, userName);

        socket.to(roomId).emit("userJoined", users);
        console.log(`User ${userName} left room ${roomId}`);
        return { success: true };
      }
      return { success: false, error: 'User not in room' };
    } catch (error) {
      console.error('Error in handleLeaveRoom:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle typing indicator
  handleTyping(socket, { roomId, userName }) {
    try {
      userService.updateUserTyping(socket.id, true);
      socket.to(roomId).emit("userTyping", userName);
      return { success: true };
    } catch (error) {
      console.error('Error in handleTyping:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle chat messages
  handleChatMessage(socket, { roomId, userName, message }) {
    try {
      const messageObj = roomService.addMessageToRoom(roomId, userName, message);
      if (messageObj) {
        // Send to all users in the room including sender
        this.io.to(roomId).emit("chatMessage", { userName, message });
        return { success: true, message: messageObj };
      }
      return { success: false, error: 'Room not found' };
    } catch (error) {
      console.error('Error in handleChatMessage:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle user disconnect
  handleDisconnect(socket) {
    try {
      const user = userService.getUser(socket.id);
      if (user) {
        const roomId = user.getCurrentRoom();
        const userName = user.userName;

        if (roomId) {
          const { users } = roomService.removeUserFromRoom(roomId, userName);
          socket.to(roomId).emit("userJoined", users);
        }

        userService.removeUser(socket.id);
        console.log(`User ${userName} disconnected`);
      }
      return { success: true };
    } catch (error) {
      console.error('Error in handleDisconnect:', error);
      return { success: false, error: error.message };
    }
  }

  // Get room info
  getRoomInfo(roomId) {
    try {
      return roomService.getRoomInfo(roomId);
    } catch (error) {
      console.error('Error in getRoomInfo:', error);
      return null;
    }
  }

  // Get room statistics
  getRoomStats() {
    try {
      return roomService.getRoomStats();
    } catch (error) {
      console.error('Error in getRoomStats:', error);
      return null;
    }
  }
}

export default RoomController;
