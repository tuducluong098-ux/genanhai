/**
 * Main Application Orchestrator
 */

class App {
  constructor() {
    this.currentTab = 'crop';
    this.init();
  }

  init() {
    this.bindTabNavigation();
    this.setupKeyboardShortcuts();
    this.setupSampleLoader();

    // Check hash on load
    const hash = window.location.hash.replace('#', '');
    if (['crop', 'ai', 'downloader', 'api'].includes(hash)) {
      this.switchTab(hash);
    } else {
      this.switchTab('crop');
    }
  }

  bindTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        this.switchTab(target);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    window.location.hash = `#${tabId}`;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Update tab content panels
    document.querySelectorAll('.tab-content').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });

    // Trigger canvas fit if switching to crop tab
    if (tabId === 'crop' && window.cropEditor && window.cropEditor.currentImage) {
      setTimeout(() => window.cropEditor.fitToScreen(), 50);
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger when typing in inputs/textareas
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          window.cropEditor?.redo();
        } else {
          window.cropEditor?.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        window.cropEditor?.redo();
      } else if (e.key === 'Escape') {
        if (window.cropEditor?.isCropping) {
          window.cropEditor.cancelCrop();
        }
        window.imageDownloader?.closePreviewModal();
      }
    });
  }

  setupSampleLoader() {
    // Provide a sample image button
    document.getElementById('btnLoadSampleImage')?.addEventListener('click', () => {
      this.loadDefaultSample();
    });
  }

  loadDefaultSample() {
    // High quality aesthetic Unsplash photo
    const sampleUrl = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000&auto=format&fit=crop&q=80';
    this.showToast('Đang tải ảnh mẫu nghệ thuật...', 'info');
    window.cropEditor.loadImageFromUrl(sampleUrl);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Bootstrap once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.cropEditor = new CropEditor();
  window.aiEditor = new AiEditor();
  window.imageDownloader = new ImageDownloader();
  window.apiTester = new ApiTester();

  // Load a sample image automatically if canvas is empty on startup
  setTimeout(() => {
    if (!window.cropEditor.currentImage) {
      window.app.loadDefaultSample();
    }
  }, 300);
});
