import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { TorrentManager } from './torrent-manager.js';
import { StreamHandler } from './stream-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize managers
const torrentManager = new TorrentManager();
const streamHandler = new StreamHandler(torrentManager);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.post('/api/start', async (req, res) => {
  try {
    const { magnetUri } = req.body;
    
    if (!magnetUri) {
      return res.status(400).json({ 
        error: 'Magnet URI is required' 
      });
    }

    if (!magnetUri.startsWith('magnet:')) {
      return res.status(400).json({ 
        error: 'Invalid magnet URI format' 
      });
    }

    console.log('Starting torrent for magnet:', magnetUri.substring(0, 50) + '...');

    const result = await torrentManager.addTorrent(magnetUri);
    
    res.json({
      success: true,
      infoHash: result.infoHash,
      name: result.name,
      files: result.files.map((file, index) => ({
        index,
        name: file.name,
        size: file.length,
        path: file.path
      })),
      streamUrl: `/api/stream/${result.infoHash}/${result.videoFileIndex}`
    });

  } catch (error) {
    console.error('Error starting torrent:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to start torrent streaming' 
    });
  }
});

// Stream endpoint with HTTP range support
app.get('/api/stream/:infoHash/:fileIndex', (req, res) => {
  streamHandler.handleStream(req, res);
});

// Get torrent info
app.get('/api/info/:infoHash', (req, res) => {
  try {
    const { infoHash } = req.params;
    const torrent = torrentManager.getTorrent(infoHash);
    
    if (!torrent) {
      return res.status(404).json({ error: 'Torrent not found' });
    }

    res.json({
      infoHash: torrent.infoHash,
      name: torrent.name,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      numPeers: torrent.numPeers,
      files: torrent.files.map((file, index) => ({
        index,
        name: file.name,
        size: file.length,
        downloaded: file.downloaded
      }))
    });
  } catch (error) {
    console.error('Error getting torrent info:', error);
    res.status(500).json({ error: 'Failed to get torrent info' });
  }
});

// Get active torrents
app.get('/api/torrents', (req, res) => {
  try {
    const torrents = torrentManager.getActiveTorrents();
    res.json(torrents.map(torrent => ({
      infoHash: torrent.infoHash,
      name: torrent.name,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      numPeers: torrent.numPeers,
      files: torrent.files.map((file, index) => ({
        index,
        name: file.name,
        size: file.length,
        downloaded: file.downloaded
      }))
    })));
  } catch (error) {
    console.error('Error getting active torrents:', error);
    res.status(500).json({ error: 'Failed to get active torrents' });
  }
});

//

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeTorrents: torrentManager.getActiveTorrentsCount(),
    uptime: process.uptime()
  });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});


// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error' 
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  torrentManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  torrentManager.cleanup();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🎬 StreamHub server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api/`);
});