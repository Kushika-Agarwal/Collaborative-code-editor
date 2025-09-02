// Main server file - Collaborative Code Editor Backend
// MVC Architecture with Socket.IO for real-time collaboration

import express from "express";
import http from "http";
import { Server } from "socket.io";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import cors from "cors";

// Import configurations
import { serverConfig, staticConfig } from './config/server.js';

// Import routes
import httpRoutes from './routes/httpRoutes.js';
import socketRoutes from './routes/socketRoutes.js';

// Import middleware
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
  cors: serverConfig.socket.cors
});

// Middleware setup
app.use(cors(serverConfig.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// API routes
app.use('/', httpRoutes);

// Serve static files from frontend build
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, staticConfig.path)));

// Socket.IO event handlers
socketRoutes.initializeSocketHandlers(io);

// Catch-all route for SPA (Single Page Application)
app.get("/*", (req, res) => {
  res.sendFile(join(__dirname, staticConfig.path, staticConfig.options.index));
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const port = serverConfig.port;
server.listen(port, () => {
  console.log(`🚀 Collaborative Code Editor Server is running on port ${port}`);
  console.log(`📊 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${port}/health`);
  console.log(`📈 Room Stats: http://localhost:${port}/api/rooms/stats`);
  console.log(`📞 Call Stats: http://localhost:${port}/api/calls/stats`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app; 