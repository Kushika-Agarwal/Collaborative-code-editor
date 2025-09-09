// Socket routes - handles all socket events and delegates to controllers
import RoomController from "../controllers/RoomController.js";
import VideoCallController from "../controllers/VideoCallController.js";

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
      console.log("User connected:", socket.id);

      // Register grouped event handlers
      this.registerFileEvents(socket);
      this.registerRoomEvents(socket);
      this.registerChatEvents(socket);
      this.registerVideoCallEvents(socket);

      // Disconnect handling
      socket.on("disconnect", () => {
        this.handleResult(
          socket,
          this.roomController.handleDisconnect(socket),
          "disconnect"
        );
        this.handleResult(
          socket,
          this.videoCallController.handleDisconnect(socket),
          "disconnect"
        );
        console.log("User disconnected:", socket.id);
      });
    });
  }

  /**
   * Handles controller results and emits standardized error events.
   */
  handleResult(socket, result, eventType) {
    if (!result.success) {
      console.error(`${eventType} error:`, result.error);
      socket.emit("error", { type: eventType, message: result.error });
    }
  }

  /**
   * File management socket events
   */
  registerFileEvents(socket) {
    const events = [
      "createFile",
      "deleteFile",
      "renameFile",
      "switchFile",
      "getFiles",
      "fileCodeChange",
      "fileLanguageChange",
    ];

    events.forEach((event) => {
      socket.on(event, (data) => {
        const methodName = `handle${this.capitalize(event)}`;
        if (typeof this.roomController[methodName] === "function") {
          const result = this.roomController[methodName](socket, data);
          this.handleResult(socket, result, event);
        } else {
          console.warn(`No handler for ${event}`);
        }
      });
    });
  }

  /**
   * Room-related events
   */
  registerRoomEvents(socket) {
    socket.on("join-room", (data) => {
      this.handleResult(
        socket,
        this.roomController.handleJoinRoom(socket, data),
        "join-room"
      );
    });

    socket.on("leave-room", () => {
      this.handleResult(
        socket,
        this.roomController.handleLeaveRoom(socket),
        "leave-room"
      );
    });
  }

  /**
   * Chat-related events
   */
  registerChatEvents(socket) {
    socket.on("chatMessage", (data) => {
      this.handleResult(
        socket,
        this.roomController.handleChatMessage(socket, data),
        "chatMessage"
      );
    });

    socket.on("typing", ({ roomId, user }) => {
      socket.to(roomId).emit("userTyping", { user });
    });

    socket.on("stopTyping", ({ roomId, user }) => {
      socket.to(roomId).emit("userStopTyping", { user });
    });
  }

  /**
   * Video call events
   */
  registerVideoCallEvents(socket) {
    socket.on("join-call", (data) => {
      this.handleResult(
        socket,
        this.videoCallController.handleJoinCall(socket, data),
        "join-call"
      );
    });

    socket.on("leave-call", (data) => {
      this.handleResult(
        socket,
        this.videoCallController.handleLeaveCall(socket, data),
        "leave-call"
      );
    });

    socket.on("signal", (data) => {
      this.handleResult(
        socket,
        this.videoCallController.handleSignal(socket, data),
        "signal"
      );
    });

    socket.on("toggle-camera", () => {
      this.handleResult(
        socket,
        this.videoCallController.handleToggleCamera(socket),
        "toggle-camera"
      );
    });

    socket.on("toggle-microphone", () => {
      this.handleResult(
        socket,
        this.videoCallController.handleToggleMicrophone(socket),
        "toggle-microphone"
      );
    });
  }

  /**
   * Utility: Capitalize event names for method mapping
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Analytics
  getRoomStats() {
    return this.roomController ? this.roomController.getRoomStats() : null;
  }

  getCallStats() {
    return this.videoCallController
      ? this.videoCallController.getCallStats()
      : null;
  }
}

export default new SocketRoutes();
