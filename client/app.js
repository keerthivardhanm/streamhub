class StreamHubApp {
  constructor() {
    this.currentStream = null;
    this.isLoading = false;
    
    this.init();
  }

  init() {
    this.initializeElements();
    this.bindEvents();
    this.updateStatus('Ready');
    console.log('StreamHub client initialized');
  }

  initializeElements() {
    // Sections
    this.inputSection = document.getElementById('inputSection');
    this.loadingSection = document.getElementById('loadingSection');
    this.playerSection = document.getElementById('playerSection');
    this.errorSection = document.getElementById('errorSection');
    
    // Input elements
    this.magnetInput = document.getElementById('magnetInput');
    this.streamBtn = document.getElementById('streamBtn');
    this.exampleBtns = document.querySelectorAll('.example-btn');
    
    // Loading elements
    this.loadingTitle = document.getElementById('loadingTitle');
    this.loadingText = document.getElementById('loadingText');
    this.progressFill = document.getElementById('progressFill');
    this.progressText = document.getElementById('progressText');
    
    // Video elements
    this.videoPlayer = document.getElementById('videoPlayer');
    this.videoTitle = document.getElementById('videoTitle');
    this.videoSize = document.getElementById('videoSize');
    this.torrentInfo = document.getElementById('torrentInfo');
    this.backBtn = document.getElementById('backBtn');
    
    // Error elements
    this.errorMessage = document.getElementById('errorMessage');
    this.retryBtn = document.getElementById('retryBtn');
    this.backToInputBtn = document.getElementById('backToInputBtn');
    
    // Status
    this.statusEl = document.getElementById('status');
  }

  bindEvents() {
    // Stream button
    this.streamBtn?.addEventListener('click', () => this.handleStream());
    
    // Enter key in input
    this.magnetInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isLoading) {
        this.handleStream();
      }
    });
    
    // Example buttons
    this.exampleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const magnet = e.target.dataset.magnet;
        if (magnet) {
          this.magnetInput.value = magnet;
          this.handleStream();
        }
      });
    });
    
    // Navigation buttons
    this.backBtn?.addEventListener('click', () => this.showSection('input'));
    this.retryBtn?.addEventListener('click', () => this.handleStream());
    this.backToInputBtn?.addEventListener('click', () => this.showSection('input'));
    
    // Video events
    this.videoPlayer?.addEventListener('loadstart', () => {
      console.log('Video loading started');
    });
    
    this.videoPlayer?.addEventListener('loadedmetadata', () => {
      console.log('Video metadata loaded');
      this.updateStatus('Streaming');
    });
    
    
    this.videoPlayer?.addEventListener('error', (e) => {
      console.error('Video error:', e);
      this.showError('Video playback error. The stream may be unavailable.');
    });
  }

  async handleStream() {
    const magnetUri = this.magnetInput?.value?.trim();
    
    if (!magnetUri) {
      this.showToast('Please enter a magnet link', 'warning');
      return;
    }

    if (!magnetUri.startsWith('magnet:')) {
      this.showToast('Please enter a valid magnet link', 'error');
      return;
    }

    try {
      this.setLoading(true);
      this.showSection('loading');
      this.updateLoadingState('Connecting to torrent...', 'Analyzing magnet link and connecting to peers');
      this.updateStatus('Connecting');

      const response = await fetch('/api/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ magnetUri })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start streaming');
      }

      console.log('Torrent started:', data);
      
      this.currentStream = data;
      this.updateLoadingState('Preparing video stream...', 'Video file found, preparing for playback');
      
      // Set up video player
      this.setupVideoPlayer(data);
      
      // Show player section
      this.showSection('player');
      this.updateStatus('Streaming');
      
      this.showToast('Streaming started successfully!', 'success');
      
    } catch (error) {
      console.error('Stream error:', error);
      this.showError(error.message);
      this.updateStatus('Error');
    } finally {
      this.setLoading(false);
    }
  }

  setupVideoPlayer(streamData) {
    if (!this.videoPlayer) return;
    
    // Set video source
    this.videoPlayer.src = streamData.streamUrl;
    
    // Update video info
    if (this.videoTitle) {
      this.videoTitle.textContent = streamData.name || 'Video Stream';
    }
    
    if (this.videoSize && streamData.files && streamData.files.length > 0) {
      const totalSize = streamData.files.reduce((sum, file) => sum + file.size, 0);
      this.videoSize.textContent = `Size: ${this.formatBytes(totalSize)}`;
    }
    
    if (this.torrentInfo) {
      this.torrentInfo.textContent = `Files: ${streamData.files?.length || 0}`;
    }
    
    // Auto-play
    this.videoPlayer.autoplay = true;
    this.videoPlayer.load();
  }

  updateLoadingState(title, text, progress = null) {
    if (this.loadingTitle) {
      this.loadingTitle.textContent = title;
    }
    
    if (this.loadingText) {
      this.loadingText.textContent = text;
    }
    
    if (progress !== null && this.progressFill && this.progressText) {
      this.progressFill.style.width = `${progress}%`;
      this.progressText.textContent = `${Math.round(progress)}% complete`;
    }
  }

  showSection(section) {
    // Hide all sections
    const sections = [this.inputSection, this.loadingSection, this.playerSection, this.errorSection];
    sections.forEach(s => s?.classList.add('hidden'));
    
    // Show target section
    switch (section) {
      case 'input':
        this.inputSection?.classList.remove('hidden');
        this.updateStatus('Ready');
        break;
      case 'loading':
        this.loadingSection?.classList.remove('hidden');
        break;
      case 'player':
        this.playerSection?.classList.remove('hidden');
        break;
      case 'error':
        this.errorSection?.classList.remove('hidden');
        break;
    }
  }

  showError(message) {
    this.showSection('error');
    if (this.errorMessage) {
      this.errorMessage.textContent = message;
    }
    this.showToast(message, 'error');
  }

  setLoading(loading) {
    this.isLoading = loading;
    
    if (this.streamBtn) {
      this.streamBtn.disabled = loading;
      if (loading) {
        this.streamBtn.classList.add('loading');
      } else {
        this.streamBtn.classList.remove('loading');
      }
    }
  }

  updateStatus(status) {
    if (this.statusEl) {
      this.statusEl.textContent = status;
      
      // Update status color
      this.statusEl.className = 'status';
      if (status === 'Ready') {
        this.statusEl.style.color = 'var(--success-color)';
      } else if (status === 'Connecting') {
        this.statusEl.style.color = 'var(--warning-color)';
      } else if (status === 'Streaming') {
        this.statusEl.style.color = 'var(--success-color)';
      } else if (status === 'Error') {
        this.statusEl.style.color = 'var(--error-color)';
      }
    }
  }

  showToast(message, type = 'info', duration = 4000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, duration);
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// Add slideOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.streamHub = new StreamHubApp();
});

// Export for global access
window.StreamHubApp = StreamHubApp;