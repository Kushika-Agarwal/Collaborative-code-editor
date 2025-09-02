import express from "express";
import http from "http";
import { Server } from "socket.io";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();
io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join_room", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom).delete(socket.id);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);
    io.to(roomId).emit("userJoined", Array.from(rooms.get(currentRoom)));
  });

  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdated", code);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    socket.to(roomId).emit("languageUpdated", language);
  });

  // Chat message event
  socket.on("chatMessage", ({ roomId, userName, message }) => {
    io.to(roomId).emit("chatMessage", { userName, message });
  });

  // Video call signaling events
  socket.on("join-call", ({ roomId, userName }) => {
    socket.join(roomId + "-call");
    socket.to(roomId + "-call").emit("user-joined-call", { userName, socketId: socket.id });
  });

  socket.on("signal", ({ roomId, signal, to }) => {
    io.to(to).emit("signal", { signal, from: socket.id });
  });

  socket.on("leave-call", ({ roomId }) => {
    socket.leave(roomId + "-call");
    socket.to(roomId + "-call").emit("user-left-call", { socketId: socket.id });
  });

  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }
    console.log("A user disconnected", socket.id);
  });
});

const port = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, "../frontend/vite-project/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/vite-project/dist/index.html"));
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
