import WebTorrent from 'webtorrent';

export class TorrentManager {
  constructor() {
    this.client = new WebTorrent();
    this.torrents = new Map();
    this.maxTorrents = 10; // LRU cache limit
    
    this.client.on('error', (error) => {
      console.error('WebTorrent client error:', error);
    });

    console.log('TorrentManager initialized');
  }

  async addTorrent(magnetUri) {
    return new Promise((resolve, reject) => {
      // Check if torrent already exists
      const existingTorrent = this.client.torrents.find(t => 
        t.magnetURI === magnetUri || t.infoHash === this.extractInfoHash(magnetUri)
      );

      if (existingTorrent && existingTorrent.ready) {
        console.log('Torrent already exists and ready');
        const videoFileIndex = this.findBestVideoFile(existingTorrent.files);
        
        if (videoFileIndex === -1) {
          return reject(new Error('No video files found in torrent'));
        }

        return resolve({
          infoHash: existingTorrent.infoHash,
          name: existingTorrent.name,
          files: existingTorrent.files,
          videoFileIndex
        });
      }

      // Clean up old torrents if we're at the limit
      this.cleanupOldTorrents();

      console.log('Adding new torrent...');
      const torrent = this.client.add(magnetUri, {
        path: '/tmp/webtorrent'
      });

      // Set timeout for metadata
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for torrent metadata. Check if the magnet link is valid and has active peers.'));
      }, 30000);

      torrent.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Torrent error:', error);
        reject(error);
      });

      torrent.on('metadata', () => {
        clearTimeout(timeout);
        console.log('Torrent metadata received:', torrent.name);
        
        // Find the best video file
        const videoFileIndex = this.findBestVideoFile(torrent.files);
        
        if (videoFileIndex === -1) {
          torrent.destroy();
          return reject(new Error('No video files found in this torrent'));
        }

        // Store torrent reference
        this.torrents.set(torrent.infoHash, {
          torrent,
          addedAt: Date.now(),
          lastAccessed: Date.now()
        });

        console.log(`Selected video file: ${torrent.files[videoFileIndex].name}`);
        
        resolve({
          infoHash: torrent.infoHash,
          name: torrent.name,
          files: torrent.files,
          videoFileIndex
        });
      });

      torrent.on('ready', () => {
        console.log('Torrent ready for streaming');
      });

      torrent.on('download', () => {
        // Update last accessed time
        const torrentData = this.torrents.get(torrent.infoHash);
        if (torrentData) {
          torrentData.lastAccessed = Date.now();
        }
      });
    });
  }

  findBestVideoFile(files) {
    // Video extensions in order of preference
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    
    // Filter video files
    const videoFiles = files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => {
        const name = file.name.toLowerCase();
        return videoExtensions.some(ext => name.endsWith(ext));
      });

    if (videoFiles.length === 0) {
      return -1;
    }

    // Sort by preference (mp4/mkv first) then by size (largest first)
    videoFiles.sort((a, b) => {
      const aName = a.file.name.toLowerCase();
      const bName = b.file.name.toLowerCase();
      
      // Prefer mp4 and mkv
      const aPreferred = aName.endsWith('.mp4') || aName.endsWith('.mkv');
      const bPreferred = bName.endsWith('.mp4') || bName.endsWith('.mkv');
      
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      
      // Then sort by size (largest first)
      return b.file.length - a.file.length;
    });

    return videoFiles[0].index;
  }

  getTorrent(infoHash) {
    const torrentData = this.torrents.get(infoHash);
    if (torrentData) {
      torrentData.lastAccessed = Date.now();
      return torrentData.torrent;
    }
    return null;
  }

  getFile(infoHash, fileIndex) {
    const torrent = this.getTorrent(infoHash);
    if (!torrent || !torrent.files[fileIndex]) {
      return null;
    }
    return torrent.files[fileIndex];
  }

  cleanupOldTorrents() {
    if (this.torrents.size < this.maxTorrents) {
      return;
    }

    // Sort by last accessed time and remove oldest
    const sortedTorrents = Array.from(this.torrents.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = sortedTorrents.slice(0, sortedTorrents.length - this.maxTorrents + 1);
    
    toRemove.forEach(([infoHash, torrentData]) => {
      console.log(`Cleaning up old torrent: ${torrentData.torrent.name}`);
      torrentData.torrent.destroy();
      this.torrents.delete(infoHash);
    });
  }

  extractInfoHash(magnetUri) {
    const match = magnetUri.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-fA-F0-9]{32})/);
    return match ? match[1].toLowerCase() : null;
  }

  getActiveTorrentsCount() {
    return this.torrents.size;
  }

  cleanup() {
    console.log('Cleaning up all torrents...');
    this.torrents.forEach((torrentData) => {
      torrentData.torrent.destroy();
    });
    this.torrents.clear();
    this.client.destroy();
  }
}