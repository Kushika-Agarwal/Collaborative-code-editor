// Socket routes - handles all socket events and delegates to controllers
import RoomController from '../controllers/RoomController.js';
import VideoCallController from '../controllers/VideoCallController.js';

class SocketRoutes {
  constructor() {
    this.roomController = null;
    this.videoCallController = null;
  }
  // Initialize socket event handlers
  initializeSocketHandlers(io) {
    // Initialize controllers with io instance
    this.roomController = new RoomController(io);
    this.videoCallController = new VideoCallController(io);

    io.on("connection", (socket) => {
      console.log("A user connected", socket.id);

      // Room-related events
      socket.on("join_room", (data) => {
        const result = this.roomController.handleJoinRoom(socket, data);
        if (!result.success) {
          console.error('Join room error:', result.error);
        }
      });

      socket.on("codeChange", (data) => {
        const result = this.roomController.handleCodeChange(socket, data);
        if (!result.success) {
          console.error('Code change error:', result.error);
        }
      });

      socket.on("languageChange", (data) => {
        const result = this.roomController.handleLanguageChange(socket, data);
        if (!result.success) {
          console.error('Language change error:', result.error);
        }
      });

      socket.on("leaveRoom", () => {
        const result = this.roomController.handleLeaveRoom(socket);
        if (!result.success) {
          console.error('Leave room error:', result.error);
        }
      });

      socket.on("typing", (data) => {
        const result = this.roomController.handleTyping(socket, data);
        if (!result.success) {
          console.error('Typing error:', result.error);
        }
      });

      socket.on("stopTyping", (data) => {
        const result = this.roomController.handleStopTyping(socket, data);
        if (!result.success) {
          console.error('Stop typing error:', result.error);
        }
      });

      socket.on("cursorMove", (data) => {
        const result = this.roomController.handleCursorMove(socket, data);
        if (!result.success) {
          console.error('Cursor move error:', result.error);
        }
      });

      socket.on("cursorClear", (data) => {
        const result = this.roomController.handleCursorClear(socket, data);
        if (!result.success) {
          console.error('Cursor clear error:', result.error);
        }
      });

      socket.on("chatMessage", (data) => {
        const result = this.roomController.handleChatMessage(socket, data);
        if (!result.success) {
          console.error('Chat message error:', result.error);
        }
      });

      // Video call events
      socket.on("join-call", (data) => {
        const result = this.videoCallController.handleJoinCall(socket, data);
        if (!result.success) {
          console.error('Join call error:', result.error);
        }
      });

      socket.on("signal", (data) => {
        const result = this.videoCallController.handleSignal(socket, data);
        if (!result.success) {
          console.error('Signal error:', result.error);
        }
      });

      socket.on("leave-call", (data) => {
        const result = this.videoCallController.handleLeaveCall(socket, data);
        if (!result.success) {
          console.error('Leave call error:', result.error);
        }
      });

      socket.on("toggle-camera", () => {
        const result = this.videoCallController.handleToggleCamera(socket);
        if (!result.success) {
          console.error('Toggle camera error:', result.error);
        }
      });

      socket.on("toggle-microphone", () => {
        const result = this.videoCallController.handleToggleMicrophone(socket);
        if (!result.success) {
          console.error('Toggle microphone error:', result.error);
        }
      });

      // Disconnect event
      socket.on("disconnect", () => {
        const result = this.roomController.handleDisconnect(socket);
        if (!result.success) {
          console.error('Disconnect error:', result.error);
        }
        console.log("A user disconnected", socket.id);
      });
    });
  }

  // Get room statistics (for admin/analytics)
  getRoomStats() {
    return this.roomController ? this.roomController.getRoomStats() : null;
  }

  // Get call statistics (for admin/analytics)
  getCallStats() {
    return this.videoCallController ? this.videoCallController.getCallStats() : null;
  }
}

export default new SocketRoutes(); 