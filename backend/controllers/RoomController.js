// Room controller - handles room-related socket events and business logic
import roomService from '../services/RoomService.js';
import userService from '../services/UserService.js';

class RoomController {
  constructor(io) {
    this.io = io; // Store io instance for broadcasting
  }
  // Broadcast current typing users in a room
  broadcastTypingUsers(roomId) {
    const usersInRoom = userService.getUsersInRoom(roomId);
    const typingUsers = usersInRoom
      .filter((u) => u.isTyping)
      .map((u) => u.userName);
    this.io.to(roomId).emit("typingUsers", typingUsers);
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
        socket.to(previousRoom).emit("userJoined", users);
      }

      // Join new room
      socket.join(roomId);
      userService.updateUserRoom(socket.id, roomId);
      const { users } = roomService.addUserToRoom(roomId, userName);

      // Notify all users in the room
      socket.to(roomId).emit("userJoined", users);
      
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
        socket.to(roomId).emit("codeUpdated", code);
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
        // Ensure typing list is updated
        userService.updateUserTyping(socket.id, false);
        this.broadcastTypingUsers(roomId);
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
      this.broadcastTypingUsers(roomId);
      return { success: true };
    } catch (error) {
      console.error('Error in handleTyping:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle stop typing indicator
  handleStopTyping(socket, { roomId }) {
    try {
      userService.updateUserTyping(socket.id, false);
      this.broadcastTypingUsers(roomId);
      return { success: true };
    } catch (error) {
      console.error('Error in handleStopTyping:', error);
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
          // Ensure typing list is updated
          userService.updateUserTyping(socket.id, false);
          this.broadcastTypingUsers(roomId);
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