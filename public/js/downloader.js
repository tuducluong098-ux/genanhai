/**
 * Web Image Downloader (Extension Style: cnpniohnfphhjihaiiggeabnkjhpaldj)
 * Features:
 * - Scrapes images from any webpage URL
 * - Real-time filtering by Min Width, Min Height, Format, URL text, Orientation
 * - Select All, Deselect All, Invert Selection
 * - Bulk download as ZIP or individual files
 * - 1-Click transfer to Crop Studio or AI Studio
 */

class ImageDownloader {
  constructor() {
    this.images = []; // raw scraped images: { url, alt, format, width, height, isBase64 }
    this.filteredImages = [];
    this.selectedUrls = new Set();

    // Filters
    this.filters = {
      minWidth: 0,
      minHeight: 0,
      format: 'ALL', // 'ALL' or 'JPG', 'PNG', 'WEBP', 'SVG', 'GIF', 'AVIF'
      searchQuery: '',
      orientation: 'all' // 'all' | 'landscape' | 'portrait' | 'square'
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupSampleChips();
  }

  bindEvents() {
    // Scan button
    document.getElementById('btnStartScrape')?.addEventListener('click', () => this.startScrape());
    document.getElementById('downloaderUrlInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.startScrape();
    });

    // Min Width & Height Sliders
    this.bindSlider('sliderMinWidth', 'valMinWidth', 'inputMinWidth', (v) => {
      this.filters.minWidth = v;
      this.applyFilters();
    });

    this.bindSlider('sliderMinHeight', 'valMinHeight', 'inputMinHeight', (v) => {
      this.filters.minHeight = v;
      this.applyFilters();
    });

    // Format tags
    document.querySelectorAll('.format-tag').forEach((tag) => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.format-tag').forEach((t) => t.classList.remove('active'));
        tag.classList.add('active');
        this.filters.format = tag.getAttribute('data-format');
        this.applyFilters();
      });
    });

    // Search query filter
    document.getElementById('downloaderSearchFilter')?.addEventListener('input', (e) => {
      this.filters.searchQuery = e.target.value.toLowerCase().trim();
      this.applyFilters();
    });

    // Orientation filter
    document.querySelectorAll('input[name="orientationFilter"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.filters.orientation = e.target.value;
        this.applyFilters();
      });
    });

    // Selection buttons
    document.getElementById('btnSelectAll')?.addEventListener('click', () => this.selectAll());
    document.getElementById('btnDeselectAll')?.addEventListener('click', () => this.deselectAll());
    document.getElementById('btnInvertSelection')?.addEventListener('click', () => this.invertSelection());

    // Download Actions
    document.getElementById('btnDownloadZip')?.addEventListener('click', () => this.downloadSelectedZip());
    document.getElementById('btnDownloadIndividual')?.addEventListener('click', () => this.downloadSelectedIndividual());

    // Modal close
    document.getElementById('previewModalClose')?.addEventListener('click', () => this.closePreviewModal());
    document.getElementById('previewModalBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'previewModalBackdrop') this.closePreviewModal();
    });
  }

  bindSlider(sliderId, labelId, inputId, setter) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    const input = document.getElementById(inputId);

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (label) label.textContent = `${val}px`;
        if (input) input.value = val;
        setter(val);
      });
    }

    if (input) {
      input.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 0;
        if (slider) slider.value = val;
        if (label) label.textContent = `${val}px`;
        setter(val);
      });
    }
  }

  setupSampleChips() {
    const samples = [
      { name: 'Wikipedia (Mèo)', url: 'https://en.wikipedia.org/wiki/Cat' },
      { name: 'Unsplash Photos', url: 'https://unsplash.com' },
      { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/Main_Page' },
      { name: 'VnExpress', url: 'https://vnexpress.net' }
    ];

    const container = document.getElementById('downloaderSampleChips');
    if (!container) return;

    samples.forEach((s) => {
      const chip = document.createElement('span');
      chip.className = 'sample-chip';
      chip.textContent = s.name;
      chip.addEventListener('click', () => {
        const input = document.getElementById('downloaderUrlInput');
        if (input) {
          input.value = s.url;
          this.startScrape();
        }
      });
      container.appendChild(chip);
    });
  }

  async startScrape() {
    const urlInput = document.getElementById('downloaderUrlInput');
    const targetUrl = urlInput ? urlInput.value.trim() : '';

    if (!targetUrl || !targetUrl.startsWith('http')) {
      window.app.showToast('Vui lòng nhập đường dẫn URL hợp lệ (bắt đầu bằng http:// hoặc https://)', 'error');
      return;
    }

    const scanBtn = document.getElementById('btnStartScrape');
    const spinner = document.getElementById('downloaderSpinner');
    const btnText = document.getElementById('downloaderBtnText');
    const emptyState = document.getElementById('downloaderEmptyState');
    const grid = document.getElementById('downloaderGalleryGrid');
    const filterCard = document.getElementById('downloaderFilterCard');
    const actionsBar = document.getElementById('downloaderActionsBar');

    if (scanBtn) scanBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Đang quét trang web...';

    window.app.showToast(`Đang quét ảnh từ: ${targetUrl}`, 'info');

    try {
      const res = await fetch('/api/scrape-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể quét ảnh từ trang web này.');
      }

      this.images = data.images || [];
      this.selectedUrls.clear();

      if (this.images.length === 0) {
        window.app.showToast('Không tìm thấy hình ảnh nào trên trang web này.', 'warning');
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (filterCard) filterCard.style.display = 'flex';
      if (actionsBar) actionsBar.style.display = 'flex';
      if (grid) grid.style.display = 'grid';

      // Load natural dimensions for images in parallel in background
      this.resolveDimensions();

      this.applyFilters();
      window.app.showToast(`Quét thành công! Tìm thấy ${this.images.length} hình ảnh.`, 'success');
    } catch (err) {
      console.error('Scrape error:', err);
      window.app.showToast(`Lỗi quét: ${err.message}`, 'error');
    } finally {
      if (scanBtn) scanBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (btnText) btnText.textContent = 'Quét ảnh ngay';
    }
  }

  // Pre-load natural dimensions asynchronously
  resolveDimensions() {
    this.images.forEach((item) => {
      if (item.width && item.height) return;

      const img = new Image();
      const proxyUrl = item.isBase64 ? item.url : `/api/proxy-image?url=${encodeURIComponent(item.url)}`;
      img.onload = () => {
        item.width = img.naturalWidth;
        item.height = img.naturalHeight;
        this.updateCardBadge(item);
      };
      img.src = proxyUrl;
    });
  }

  applyFilters() {
    const { minWidth, minHeight, format, searchQuery, orientation } = this.filters;

    this.filteredImages = this.images.filter((img) => {
      // Dimension filter (if dimension known)
      if (img.width && img.width < minWidth) return false;
      if (img.height && img.height < minHeight) return false;

      // Format filter
      if (format !== 'ALL' && img.format !== format) return false;

      // Search query
      if (searchQuery) {
        const u = (img.url || '').toLowerCase();
        const a = (img.alt || '').toLowerCase();
        if (!u.includes(searchQuery) && !a.includes(searchQuery)) return false;
      }

      // Orientation
      if (orientation !== 'all' && img.width && img.height) {
        if (orientation === 'landscape' && img.width <= img.height) return false;
        if (orientation === 'portrait' && img.height <= img.width) return false;
        if (orientation === 'square' && img.width !== img.height) return false;
      }

      return true;
    });

    this.renderGrid();
    this.updateCounters();
  }

  renderGrid() {
    const grid = document.getElementById('downloaderGalleryGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (this.filteredImages.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <p>Không có ảnh nào khớp với bộ lọc hiện tại.</p>
        </div>
      `;
      return;
    }

    this.filteredImages.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `image-card ${this.selectedUrls.has(item.url) ? 'selected' : ''}`;
      card.setAttribute('data-url', item.url);

      const proxySrc = item.isBase64 ? item.url : `/api/proxy-image?url=${encodeURIComponent(item.url)}`;
      const dimText = item.width && item.height ? `${item.width} × ${item.height}` : 'Loading...';

      card.innerHTML = `
        <div class="card-select-overlay">
          <input type="checkbox" class="card-select-checkbox" ${this.selectedUrls.has(item.url) ? 'checked' : ''} />
        </div>
        <div class="card-badges">
          <span class="card-badge format-badge">${item.format}</span>
          <span class="card-badge dim-badge" id="badge-dim-${index}">${dimText}</span>
        </div>
        <div class="card-image-wrap">
          <img class="card-img" src="${proxySrc}" alt="${item.alt || 'Web image'}" loading="lazy" />
        </div>
        <div class="card-footer">
          <div class="card-actions-grid">
            <button class="btn btn-secondary btn-sm btn-card-crop" title="Chuyển sang Cắt & Xoay">
              ✂️ Cắt/Xoay
            </button>
            <button class="btn btn-secondary btn-sm btn-card-ai" title="Chuyển sang Chỉnh AI">
              🎨 Chỉnh AI
            </button>
          </div>
          <div class="card-actions-grid">
            <button class="btn btn-primary btn-sm btn-card-download" title="Tải ảnh này về máy">
              ⬇️ Tải ảnh
            </button>
            <button class="btn btn-secondary btn-sm btn-card-copy" title="Sao chép liên kết ảnh">
              🔗 Sao chép
            </button>
          </div>
        </div>
      `;

      // Click card checkbox or wrap to toggle selection
      const checkbox = card.querySelector('.card-select-checkbox');
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleSelect(item.url, checkbox.checked, card);
      });

      // Click image to zoom / preview modal
      card.querySelector('.card-image-wrap').addEventListener('click', () => {
        this.openPreviewModal(item);
      });

      // Card action buttons
      card.querySelector('.btn-card-crop').addEventListener('click', (e) => {
        e.stopPropagation();
        window.app.switchTab('crop');
        window.cropEditor.loadImageFromUrl(proxySrc);
        window.app.showToast('Đã tải ảnh vào Studio Cắt & Xoay!', 'success');
      });

      card.querySelector('.btn-card-ai').addEventListener('click', (e) => {
        e.stopPropagation();
        window.app.switchTab('ai');
        window.aiEditor.loadSourceImage(proxySrc);
        window.app.showToast('Đã tải ảnh vào Studio AI Prompt!', 'success');
      });

      card.querySelector('.btn-card-download').addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadSingleImage(item);
      });

      card.querySelector('.btn-card-copy').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(item.url).then(() => {
          window.app.showToast('Đã sao chép liên kết ảnh vào clipboard!', 'info');
        });
      });

      grid.appendChild(card);
    });
  }

  updateCardBadge(item) {
    const card = document.querySelector(`.image-card[data-url="${CSS.escape(item.url)}"]`);
    if (card) {
      const dimBadge = card.querySelector('.dim-badge');
      if (dimBadge && item.width && item.height) {
        dimBadge.textContent = `${item.width} × ${item.height}`;
      }
    }
  }

  toggleSelect(url, isSelected, cardEl) {
    if (isSelected) {
      this.selectedUrls.add(url);
      cardEl.classList.add('selected');
    } else {
      this.selectedUrls.delete(url);
      cardEl.classList.remove('selected');
    }
    this.updateCounters();
  }

  selectAll() {
    this.filteredImages.forEach((img) => this.selectedUrls.add(img.url));
    this.renderGrid();
    this.updateCounters();
  }

  deselectAll() {
    this.selectedUrls.clear();
    this.renderGrid();
    this.updateCounters();
  }

  invertSelection() {
    this.filteredImages.forEach((img) => {
      if (this.selectedUrls.has(img.url)) {
        this.selectedUrls.delete(img.url);
      } else {
        this.selectedUrls.add(img.url);
      }
    });
    this.renderGrid();
    this.updateCounters();
  }

  updateCounters() {
    const counterEl = document.getElementById('downloaderSelectedCounter');
    const totalEl = document.getElementById('downloaderTotalCounter');
    const zipBtn = document.getElementById('btnDownloadZip');
    const indivBtn = document.getElementById('btnDownloadIndividual');

    if (counterEl) counterEl.textContent = this.selectedUrls.size;
    if (totalEl) totalEl.textContent = this.filteredImages.length;

    const hasSelection = this.selectedUrls.size > 0;
    if (zipBtn) zipBtn.disabled = !hasSelection;
    if (indivBtn) indivBtn.disabled = !hasSelection;
  }

  // Download single image
  downloadSingleImage(item) {
    const link = document.createElement('a');
    const proxyUrl = item.isBase64 ? item.url : `/api/proxy-image?url=${encodeURIComponent(item.url)}`;
    link.href = proxyUrl;
    link.download = `image_${Date.now()}.${(item.format || 'jpg').toLowerCase()}`;
    link.click();
    window.app.showToast('Đang tải ảnh về máy...', 'success');
  }

  // Batch download ZIP via server endpoint
  async downloadSelectedZip() {
    if (this.selectedUrls.size === 0) return;

    const zipBtn = document.getElementById('btnDownloadZip');
    const origText = zipBtn ? zipBtn.innerHTML : '';
    if (zipBtn) {
      zipBtn.disabled = true;
      zipBtn.innerHTML = '<span class="spinner"></span> Đang nén ZIP...';
    }

    window.app.showToast(`Đang đóng gói ${this.selectedUrls.size} ảnh vào file ZIP...`, 'info');

    try {
      const urlsArray = Array.from(this.selectedUrls);
      const res = await fetch('/api/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlsArray, zipName: `images_pack_${Date.now()}.zip` })
      });

      if (!res.ok) throw new Error('Không thể tạo file nén ZIP.');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `images_pack_${Date.now()}.zip`;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);

      window.app.showToast('Tải file ZIP thành công!', 'success');
    } catch (err) {
      console.error('ZIP download error:', err);
      window.app.showToast(`Lỗi tải ZIP: ${err.message}`, 'error');
    } finally {
      if (zipBtn) {
        zipBtn.disabled = false;
        zipBtn.innerHTML = origText;
      }
    }
  }

  // Sequential individual downloads
  downloadSelectedIndividual() {
    if (this.selectedUrls.size === 0) return;
    const urls = Array.from(this.selectedUrls);
    window.app.showToast(`Bắt đầu tải ${urls.length} ảnh lần lượt...`, 'info');

    urls.forEach((u, i) => {
      setTimeout(() => {
        const item = this.images.find((x) => x.url === u) || { url: u, format: 'jpg' };
        this.downloadSingleImage(item);
      }, i * 350); // slight delay to prevent browser block
    });
  }

  // Preview Modal
  openPreviewModal(item) {
    const modal = document.getElementById('previewModalBackdrop');
    const img = document.getElementById('modalPreviewImage');
    const title = document.getElementById('modalPreviewTitle');
    const dim = document.getElementById('modalPreviewDimensions');
    const link = document.getElementById('modalPreviewLink');

    if (!modal) return;

    const proxySrc = item.isBase64 ? item.url : `/api/proxy-image?url=${encodeURIComponent(item.url)}`;
    if (img) img.src = proxySrc;
    if (title) title.textContent = item.alt || 'Xem chi tiết hình ảnh';
    if (dim) dim.textContent = item.width && item.height ? `${item.width} × ${item.height} px (${item.format})` : item.format;
    if (link) link.href = item.url;

    modal.classList.add('open');
  }

  closePreviewModal() {
    const modal = document.getElementById('previewModalBackdrop');
    if (modal) modal.classList.remove('open');
  }
}

window.ImageDownloader = ImageDownloader;
