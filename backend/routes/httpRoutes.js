// HTTP routes - handles REST API endpoints
import express from 'express';
import RoomController from '../controllers/RoomController.js';
import VideoCallController from '../controllers/VideoCallController.js';

// Create controller instances (io will be null for HTTP routes)
const roomController = new RoomController(null);
const videoCallController = new VideoCallController(null);

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Collaborative Code Editor API is running'
  });
});

// Get room statistics
router.get('/api/rooms/stats', (req, res) => {
  try {
    const stats = roomController.getRoomStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get room statistics' });
  }
});

// Get call statistics
router.get('/api/calls/stats', (req, res) => {
  try {
    const stats = videoCallController.getCallStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get call statistics' });
  }
});

// Get room info by ID
router.get('/api/rooms/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const roomInfo = roomController.getRoomInfo(roomId);
    
    if (roomInfo) {
      res.json(roomInfo);
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

// Get all active rooms
router.get('/api/rooms', (req, res) => {
  try {
    const rooms = roomController.getRoomStats();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// API documentation endpoint
router.get('/api/docs', (req, res) => {
  res.json({
    name: 'Collaborative Code Editor API',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check endpoint',
      'GET /api/rooms/stats': 'Get room statistics',
      'GET /api/calls/stats': 'Get call statistics',
      'GET /api/rooms/:roomId': 'Get specific room info',
      'GET /api/rooms': 'Get all active rooms'
    },
    description: 'Real-time collaborative code editor with video calling capabilities'
  });
});

export default router; 