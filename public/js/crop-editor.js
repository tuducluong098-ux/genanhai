/**
 * Crop & Rotate Editor (Inspired by pdfsimpli.com/app/vi/image-editor/edit)
 * Features:
 * - 8-handle interactive crop selection (nw, n, ne, e, se, s, sw, w)
 * - Aspect ratio presets (Free, 1:1, 4:3, 16:9, 9:16, 3:2, 2:3)
 * - Rotate 90°, -90°, 180°, free rotation slider (-180° to 180°)
 * - Flip Horizontal, Flip Vertical
 * - Resize width/height
 * - Brightness, Contrast, Blur, Opacity, Grayscale, Sepia, Invert, Pixelate
 * - Undo / Redo history stack, Zoom controls, Export formats
 */

class CropEditor {
  constructor() {
    this.container = document.getElementById('cropContainer');
    this.canvasWrapper = document.getElementById('cropCanvasWrapper');
    this.mainCanvas = document.getElementById('mainCanvas');
    this.ctx = this.mainCanvas ? this.mainCanvas.getContext('2d') : null;
    this.cropOverlay = document.getElementById('cropOverlay');
    this.cropSelection = document.getElementById('cropSelection');
    this.cropSizeBadge = document.getElementById('cropSizeBadge');

    this.currentImage = null;
    this.originalImage = null;
    this.historyStack = [];
    this.historyIndex = -1;

    // Zoom & display state
    this.scale = 1.0;
    this.rotationAngle = 0; // free angle
    this.flipH = false;
    this.flipV = false;

    // Filter adjustments
    this.filters = {
      brightness: 0, // -100 to 100
      contrast: 0,   // -100 to 100
      blur: 0,       // 0 to 20
      opacity: 100,  // 0 to 100
      grayscale: false,
      sepia: false,
      invert: false,
      pixelate: 1,   // 1 to 20
      threshold: 0   // 0 = off, 1-255
    };

    // Crop selection state (in canvas CSS space)
    this.isCropping = false;
    this.cropBox = { x: 0, y: 0, w: 0, h: 0 };
    this.aspectRatio = null; // null = free, 1, 4/3, 16/9, etc.
    this.activeDrag = null; // { type: 'move' | 'nw' | 'n' | ..., startX, startY, initBox }

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupDropZone();
    this.setupCropOverlayEvents();
  }

  bindEvents() {
    // File inputs
    const fileInput = document.getElementById('cropFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.loadFile(e.target.files[0]);
        }
      });
    }

    // Top bar actions
    document.getElementById('btnUndo')?.addEventListener('click', () => this.undo());
    document.getElementById('btnRedo')?.addEventListener('click', () => this.redo());
    document.getElementById('btnResetOriginal')?.addEventListener('click', () => this.resetToOriginal());
    document.getElementById('btnZoomIn')?.addEventListener('click', () => this.zoom(0.15));
    document.getElementById('btnZoomOut')?.addEventListener('click', () => this.zoom(-0.15));
    document.getElementById('btnZoomFit')?.addEventListener('click', () => this.fitToScreen());
    document.getElementById('btnZoom100')?.addEventListener('click', () => this.setZoom(1.0));
    document.getElementById('btnDownloadProcessed')?.addEventListener('click', () => this.exportImage());

    // Send to AI
    document.getElementById('btnSendToAi')?.addEventListener('click', () => {
      if (!this.mainCanvas) return;
      const dataUrl = this.mainCanvas.toDataURL('image/png');
      window.app.switchTab('ai');
      window.aiEditor.loadSourceImage(dataUrl);
      window.app.showToast('Đã chuyển ảnh sang Studio AI Prompt!', 'success');
    });

    // Transform buttons (PdfSimpli Style)
    document.getElementById('btnStartCrop')?.addEventListener('click', () => this.startCrop());
    document.getElementById('btnApplyCrop')?.addEventListener('click', () => this.applyCrop());
    document.getElementById('btnCancelCrop')?.addEventListener('click', () => this.cancelCrop());

    // Rotate buttons
    document.getElementById('btnRotate90CW')?.addEventListener('click', () => this.rotateFixed(90));
    document.getElementById('btnRotate90CCW')?.addEventListener('click', () => this.rotateFixed(-90));
    document.getElementById('btnRotate180')?.addEventListener('click', () => this.rotateFixed(180));

    // Free rotate slider
    const rotateSlider = document.getElementById('rotateSlider');
    const rotateValue = document.getElementById('rotateValue');
    if (rotateSlider) {
      rotateSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (rotateValue) rotateValue.textContent = `${val}°`;
        this.setFreeRotation(val);
      });
      rotateSlider.addEventListener('change', () => this.saveState('Xoay góc'));
    }

    document.getElementById('btnResetRotate')?.addEventListener('click', () => {
      if (rotateSlider) rotateSlider.value = 0;
      if (rotateValue) rotateValue.textContent = '0°';
      this.setFreeRotation(0);
      this.saveState('Đặt lại xoay');
    });

    // Flip buttons
    document.getElementById('btnFlipH')?.addEventListener('click', () => this.toggleFlip(true, false));
    document.getElementById('btnFlipV')?.addEventListener('click', () => this.toggleFlip(false, true));

    // Aspect ratio chips
    document.querySelectorAll('.chip-ratio').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip-ratio').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const ratioAttr = chip.getAttribute('data-ratio');
        if (ratioAttr === 'free') this.aspectRatio = null;
        else if (ratioAttr === '1:1') this.aspectRatio = 1;
        else if (ratioAttr === '4:3') this.aspectRatio = 4 / 3;
        else if (ratioAttr === '16:9') this.aspectRatio = 16 / 9;
        else if (ratioAttr === '9:16') this.aspectRatio = 9 / 16;
        else if (ratioAttr === '3:2') this.aspectRatio = 3 / 2;
        else if (ratioAttr === '2:3') this.aspectRatio = 2 / 3;

        if (this.isCropping) {
          this.adjustCropBoxToAspectRatio();
          this.updateCropUI();
        }
      });
    });

    // Resize controls
    document.getElementById('btnApplyResize')?.addEventListener('click', () => this.applyResize());

    // Preset resolution chips (1000x1500, etc.)
    document.querySelectorAll('.chip-res').forEach((chip) => {
      chip.addEventListener('click', () => {
        const w = parseInt(chip.getAttribute('data-w'), 10);
        const h = parseInt(chip.getAttribute('data-h'), 10);
        const wInput = document.getElementById('resizeWidthInput');
        const hInput = document.getElementById('resizeHeightInput');
        if (wInput) wInput.value = w;
        if (hInput) hInput.value = h;
        this.applyResize();
      });
    });

    // Light & Tone Sliders
    this.bindFilterSlider('sliderBrightness', 'valBrightness', (v) => { this.filters.brightness = v; }, '%');
    this.bindFilterSlider('sliderContrast', 'valContrast', (v) => { this.filters.contrast = v; }, '%');
    this.bindFilterSlider('sliderBlur', 'valBlur', (v) => { this.filters.blur = v; }, 'px');
    this.bindFilterSlider('sliderOpacity', 'valOpacity', (v) => { this.filters.opacity = v; }, '%');

    // Colors & Effects Buttons
    document.getElementById('btnFilterGrayscale')?.addEventListener('click', () => this.toggleEffect('grayscale'));
    document.getElementById('btnFilterSepia')?.addEventListener('click', () => this.toggleEffect('sepia'));
    document.getElementById('btnFilterInvert')?.addEventListener('click', () => this.toggleEffect('invert'));
    this.bindFilterSlider('sliderPixelate', 'valPixelate', (v) => { this.filters.pixelate = v; }, '');
    this.bindFilterSlider('sliderThreshold', 'valThreshold', (v) => { this.filters.threshold = v; }, '');

    document.getElementById('btnResetFilters')?.addEventListener('click', () => this.resetFilters());
  }

  bindFilterSlider(sliderId, labelId, setter, unit = '') {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (!slider) return;

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (label) label.textContent = `${val}${unit}`;
      setter(val);
      this.render();
    });

    slider.addEventListener('change', () => {
      this.saveState('Chỉnh màu / hiệu ứng');
    });
  }

  setupDropZone() {
    const dropZone = document.getElementById('cropDropZone');
    const emptyState = document.getElementById('cropEmptyState');

    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.files && dt.files.length > 0) {
        this.loadFile(dt.files[0]);
      }
    });

    emptyState?.addEventListener('click', () => {
      document.getElementById('cropFileInput')?.click();
    });
  }

  loadFile(file) {
    if (!file.type.startsWith('image/')) {
      window.app.showToast('Vui lòng chọn một file ảnh hợp lệ!', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.loadImageFromUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  loadImageFromUrl(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.originalImage = img;
      this.currentImage = img;

      // Reset transformations
      this.rotationAngle = 0;
      this.flipH = false;
      this.flipV = false;
      this.resetFilters(false);

      this.historyStack = [];
      this.historyIndex = -1;

      // Hide empty state, show canvas
      document.getElementById('cropEmptyState').style.display = 'none';
      document.getElementById('cropCanvasWrapper').style.display = 'block';

      this.render();
      this.fitToScreen();
      this.saveState('Mở ảnh ban đầu');
      this.updateDimensionInputs();
      window.app.showToast(`Đã mở ảnh: ${img.naturalWidth} × ${img.naturalHeight} px`, 'success');
    };
    img.onerror = () => {
      // Try proxy if external url failed
      if (url.startsWith('http')) {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const pImg = new Image();
        pImg.onload = () => {
          this.originalImage = pImg;
          this.currentImage = pImg;
          document.getElementById('cropEmptyState').style.display = 'none';
          document.getElementById('cropCanvasWrapper').style.display = 'block';
          this.render();
          this.fitToScreen();
          this.saveState('Mở ảnh ban đầu');
        };
        pImg.src = proxyUrl;
      } else {
        window.app.showToast('Không thể tải ảnh. Vui lòng kiểm tra lại.', 'error');
      }
    };
    img.src = url;
  }

  // Render currentImage onto mainCanvas applying rotation, flip, and filters
  render() {
    if (!this.currentImage || !this.mainCanvas) return;

    const naturalW = this.currentImage.naturalWidth || this.currentImage.width;
    const naturalH = this.currentImage.naturalHeight || this.currentImage.height;

    // Check if free angle requires bounding box expansion
    const rad = (this.rotationAngle * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const newW = Math.round(naturalW * absCos + naturalH * absSin);
    const newH = Math.round(naturalW * absSin + naturalH * absCos);

    this.mainCanvas.width = newW;
    this.mainCanvas.height = newH;

    this.ctx.clearRect(0, 0, newW, newH);
    this.ctx.save();

    // Move to center
    this.ctx.translate(newW / 2, newH / 2);
    this.ctx.rotate(rad);
    this.ctx.scale(this.flipH ? -1 : 1, this.flipV ? -1 : 1);

    // Apply CSS filters where supported or manual fallback
    let filterStr = `brightness(${100 + this.filters.brightness}%) contrast(${100 + this.filters.contrast}%)`;
    if (this.filters.blur > 0) filterStr += ` blur(${this.filters.blur}px)`;
    if (this.filters.opacity < 100) filterStr += ` opacity(${this.filters.opacity}%)`;
    if (this.filters.grayscale) filterStr += ` grayscale(100%)`;
    if (this.filters.sepia) filterStr += ` sepia(100%)`;
    if (this.filters.invert) filterStr += ` invert(100%)`;

    this.ctx.filter = filterStr;
    this.ctx.drawImage(this.currentImage, -naturalW / 2, -naturalH / 2, naturalW, naturalH);
    this.ctx.restore();

    // Manual pixelate & threshold post-processing if active
    if (this.filters.pixelate > 1 || this.filters.threshold > 0) {
      this.applyCanvasPixelEffects();
    }

    this.updateCanvasDisplayScale();
    this.updateDimensionInputs();
  }

  applyCanvasPixelEffects() {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    const imgData = this.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Pixelate
    if (this.filters.pixelate > 1) {
      const size = Math.floor(this.filters.pixelate);
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          const p = (y * w + x) * 4;
          const r = d[p], g = d[p + 1], b = d[p + 2], a = d[p + 3];

          for (let dy = 0; dy < size && y + dy < h; dy++) {
            for (let dx = 0; dx < size && x + dx < w; dx++) {
              const idx = ((y + dy) * w + (x + dx)) * 4;
              d[idx] = r;
              d[idx + 1] = g;
              d[idx + 2] = b;
              d[idx + 3] = a;
            }
          }
        }
      }
    }

    // Threshold
    if (this.filters.threshold > 0) {
      const th = this.filters.threshold;
      for (let i = 0; i < d.length; i += 4) {
        const avg = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = avg >= th ? 255 : 0;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  updateCanvasDisplayScale() {
    if (!this.mainCanvas || !this.canvasWrapper) return;
    const displayW = Math.round(this.mainCanvas.width * this.scale);
    const displayH = Math.round(this.mainCanvas.height * this.scale);

    this.mainCanvas.style.width = `${displayW}px`;
    this.mainCanvas.style.height = `${displayH}px`;
    this.canvasWrapper.style.width = `${displayW}px`;
    this.canvasWrapper.style.height = `${displayH}px`;

    const zoomLabel = document.getElementById('zoomDisplayLabel');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(this.scale * 100)}%`;

    if (this.isCropping) {
      this.updateCropUI();
    }
  }

  // ------------------------------------------------------------------------
  // Crop Tool Logic (8 Handles + Aspect Ratio Presets)
  // ------------------------------------------------------------------------
  startCrop() {
    if (!this.currentImage) {
      window.app.showToast('Vui lòng mở ảnh trước khi cắt.', 'info');
      return;
    }

    this.isCropping = true;
    this.cropOverlay.style.display = 'block';
    document.getElementById('cropActiveBar').style.display = 'flex';

    // Initialize crop box to 80% centered in display dimensions
    const dispW = parseFloat(this.mainCanvas.style.width);
    const dispH = parseFloat(this.mainCanvas.style.height);

    let w = dispW * 0.8;
    let h = dispH * 0.8;

    if (this.aspectRatio) {
      if (w / h > this.aspectRatio) {
        w = h * this.aspectRatio;
      } else {
        h = w / this.aspectRatio;
      }
    }

    const x = (dispW - w) / 2;
    const y = (dispH - h) / 2;

    this.cropBox = { x, y, w, h };
    this.updateCropUI();
  }

  setupCropOverlayEvents() {
    if (!this.cropSelection) return;

    // Drag inside crop box to move
    this.cropSelection.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('crop-handle')) return; // handled separately
      e.preventDefault();
      this.activeDrag = {
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        initBox: { ...this.cropBox }
      };
    });

    // Handle 8 resize points
    document.querySelectorAll('.crop-handle').forEach((handle) => {
      const type = handle.getAttribute('data-handle'); // nw, n, ne, e, se, s, sw, w
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeDrag = {
          type,
          startX: e.clientX,
          startY: e.clientY,
          initBox: { ...this.cropBox }
        };
      });
    });

    // Global window listeners for drag & drop smooth movement
    window.addEventListener('mousemove', (e) => {
      if (!this.activeDrag || !this.isCropping) return;
      this.handlePointerMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      this.activeDrag = null;
    });

    // Touch support for mobile / touchpads
    this.cropSelection.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('crop-handle')) return;
      if (e.touches.length === 1) {
        this.activeDrag = {
          type: 'move',
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          initBox: { ...this.cropBox }
        };
      }
    }, { passive: false });

    document.querySelectorAll('.crop-handle').forEach((handle) => {
      const type = handle.getAttribute('data-handle');
      handle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        if (e.touches.length === 1) {
          this.activeDrag = {
            type,
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            initBox: { ...this.cropBox }
          };
        }
      }, { passive: false });
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.activeDrag || !this.isCropping) return;
      if (e.touches.length === 1) {
        this.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      this.activeDrag = null;
    });
  }

  handlePointerMove(clientX, clientY) {
    const { type, startX, startY, initBox } = this.activeDrag;
    const dx = clientX - startX;
    const dy = clientY - startY;

    const maxW = parseFloat(this.mainCanvas.style.width);
    const maxH = parseFloat(this.mainCanvas.style.height);
    const minSize = 30; // minimum 30px crop

    let { x, y, w, h } = initBox;

    if (type === 'move') {
      x = Math.max(0, Math.min(initBox.x + dx, maxW - w));
      y = Math.max(0, Math.min(initBox.y + dy, maxH - h));
    } else {
      // 8 Resize handles
      if (type.includes('e')) {
        w = Math.max(minSize, Math.min(initBox.w + dx, maxW - x));
      }
      if (type.includes('s')) {
        h = Math.max(minSize, Math.min(initBox.h + dy, maxH - y));
      }
      if (type.includes('w')) {
        const newW = Math.max(minSize, initBox.w - dx);
        const newX = initBox.x + (initBox.w - newW);
        if (newX >= 0) {
          x = newX;
          w = newW;
        }
      }
      if (type.includes('n')) {
        const newH = Math.max(minSize, initBox.h - dy);
        const newY = initBox.y + (initBox.h - newH);
        if (newY >= 0) {
          y = newY;
          h = newH;
        }
      }

      // Aspect ratio lock
      if (this.aspectRatio) {
        if (type === 'n' || type === 's') {
          w = h * this.aspectRatio;
          if (x + w > maxW) {
            w = maxW - x;
            h = w / this.aspectRatio;
          }
        } else {
          h = w / this.aspectRatio;
          if (y + h > maxH) {
            h = maxH - y;
            w = h * this.aspectRatio;
          }
        }
      }
    }

    this.cropBox = { x, y, w, h };
    this.updateCropUI();
  }

  adjustCropBoxToAspectRatio() {
    if (!this.aspectRatio) return;
    const maxW = parseFloat(this.mainCanvas.style.width);
    const maxH = parseFloat(this.mainCanvas.style.height);

    let { x, y, w, h } = this.cropBox;
    h = w / this.aspectRatio;
    if (y + h > maxH) {
      h = maxH - y;
      w = h * this.aspectRatio;
    }
    if (x + w > maxW) {
      w = maxW - x;
      h = w / this.aspectRatio;
    }
    this.cropBox = { x, y, w, h };
  }

  updateCropUI() {
    if (!this.cropSelection) return;
    const { x, y, w, h } = this.cropBox;

    this.cropSelection.style.left = `${Math.round(x)}px`;
    this.cropSelection.style.top = `${Math.round(y)}px`;
    this.cropSelection.style.width = `${Math.round(w)}px`;
    this.cropSelection.style.height = `${Math.round(h)}px`;

    // Calculate actual pixel dimensions on unscaled canvas
    const actualW = Math.round(w / this.scale);
    const actualH = Math.round(h / this.scale);

    if (this.cropSizeBadge) {
      this.cropSizeBadge.textContent = `${actualW} × ${actualH} px`;
    }
  }

  applyCrop() {
    if (!this.isCropping) return;

    // Convert display crop box to actual canvas pixel coords
    const cropX = Math.round(this.cropBox.x / this.scale);
    const cropY = Math.round(this.cropBox.y / this.scale);
    const cropW = Math.round(this.cropBox.w / this.scale);
    const cropH = Math.round(this.cropBox.h / this.scale);

    if (cropW <= 0 || cropH <= 0) return;

    // Create temp cropped canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(
      this.mainCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH
    );

    // Create new image from cropped canvas
    const croppedImg = new Image();
    croppedImg.onload = () => {
      this.currentImage = croppedImg;
      this.rotationAngle = 0;
      this.flipH = false;
      this.flipV = false;
      this.cancelCrop();
      this.render();
      this.fitToScreen();
      this.saveState('Cắt ảnh');
      window.app.showToast(`Đã cắt ảnh: ${cropW} × ${cropH} px`, 'success');
    };
    croppedImg.src = tempCanvas.toDataURL('image/png');
  }

  cancelCrop() {
    this.isCropping = false;
    this.cropOverlay.style.display = 'none';
    document.getElementById('cropActiveBar').style.display = 'none';
  }

  // ------------------------------------------------------------------------
  // Rotation & Flipping
  // ------------------------------------------------------------------------
  rotateFixed(degrees) {
    if (!this.currentImage) return;

    const rad = (degrees * Math.PI) / 180;
    const oldW = this.mainCanvas.width;
    const oldH = this.mainCanvas.height;

    const newW = degrees % 180 === 0 ? oldW : oldH;
    const newH = degrees % 180 === 0 ? oldH : oldW;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newW;
    tempCanvas.height = newH;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.translate(newW / 2, newH / 2);
    tempCtx.rotate(rad);
    tempCtx.drawImage(this.mainCanvas, -oldW / 2, -oldH / 2);

    const rotatedImg = new Image();
    rotatedImg.onload = () => {
      this.currentImage = rotatedImg;
      this.render();
      this.saveState(`Xoay ${degrees}°`);
      window.app.showToast(`Đã xoay ${degrees}°`, 'info');
    };
    rotatedImg.src = tempCanvas.toDataURL('image/png');
  }

  setFreeRotation(deg) {
    this.rotationAngle = deg;
    this.render();
  }

  toggleFlip(horizontal, vertical) {
    if (horizontal) this.flipH = !this.flipH;
    if (vertical) this.flipV = !this.flipV;

    // Bake flip into current image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.mainCanvas.width;
    tempCanvas.height = this.mainCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.translate(
      horizontal ? this.mainCanvas.width : 0,
      vertical ? this.mainCanvas.height : 0
    );
    tempCtx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
    tempCtx.drawImage(this.mainCanvas, 0, 0);

    const flippedImg = new Image();
    flippedImg.onload = () => {
      this.currentImage = flippedImg;
      this.flipH = false;
      this.flipV = false;
      this.render();
      this.saveState(horizontal ? 'Lật ngang' : 'Lật dọc');
      window.app.showToast(horizontal ? 'Đã lật ảnh ngang' : 'Đã lật ảnh dọc', 'info');
    };
    flippedImg.src = tempCanvas.toDataURL('image/png');
  }

  // ------------------------------------------------------------------------
  // Resize Tool
  // ------------------------------------------------------------------------
  applyResize() {
    if (!this.currentImage) return;

    const wInput = document.getElementById('resizeWidthInput');
    const hInput = document.getElementById('resizeHeightInput');
    const w = parseInt(wInput?.value, 10);
    const h = parseInt(hInput?.value, 10);

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      window.app.showToast('Vui lòng nhập kích thước hợp lệ!', 'error');
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(this.mainCanvas, 0, 0, w, h);

    const resizedImg = new Image();
    resizedImg.onload = () => {
      this.currentImage = resizedImg;
      this.render();
      this.fitToScreen();
      this.saveState(`Đổi kích thước ${w}x${h}`);
      window.app.showToast(`Đã đổi kích thước thành ${w} × ${h} px`, 'success');
    };
    resizedImg.src = tempCanvas.toDataURL('image/png');
  }

  updateDimensionInputs() {
    if (!this.mainCanvas) return;
    const wInput = document.getElementById('resizeWidthInput');
    const hInput = document.getElementById('resizeHeightInput');
    const statusDim = document.getElementById('statusDimensions');

    if (wInput) wInput.value = this.mainCanvas.width;
    if (hInput) hInput.value = this.mainCanvas.height;
    if (statusDim) statusDim.textContent = `${this.mainCanvas.width} × ${this.mainCanvas.height} px`;
  }

  // ------------------------------------------------------------------------
  // Effects & Filters
  // ------------------------------------------------------------------------
  toggleEffect(name) {
    if (name === 'grayscale') this.filters.grayscale = !this.filters.grayscale;
    if (name === 'sepia') this.filters.sepia = !this.filters.sepia;
    if (name === 'invert') this.filters.invert = !this.filters.invert;

    const btn = document.getElementById(`btnFilter${name.charAt(0).toUpperCase() + name.slice(1)}`);
    if (btn) {
      btn.classList.toggle('active', this.filters[name]);
    }

    this.render();
    this.saveState(`Hiệu ứng ${name}`);
  }

  resetFilters(reRender = true) {
    this.filters = {
      brightness: 0,
      contrast: 0,
      blur: 0,
      opacity: 100,
      grayscale: false,
      sepia: false,
      invert: false,
      pixelate: 1,
      threshold: 0
    };

    // Reset UI controls
    const setSlider = (id, val, unit) => {
      const s = document.getElementById(id);
      if (s) s.value = val;
      const v = document.getElementById(id.replace('slider', 'val'));
      if (v) v.textContent = `${val}${unit}`;
    };

    setSlider('sliderBrightness', 0, '%');
    setSlider('sliderContrast', 0, '%');
    setSlider('sliderBlur', 0, 'px');
    setSlider('sliderOpacity', 100, '%');
    setSlider('sliderPixelate', 1, '');
    setSlider('sliderThreshold', 0, '');

    ['Grayscale', 'Sepia', 'Invert'].forEach((name) => {
      document.getElementById(`btnFilter${name}`)?.classList.remove('active');
    });

    if (reRender) {
      this.render();
      this.saveState('Đặt lại bộ lọc');
    }
  }

  // ------------------------------------------------------------------------
  // Zoom Controls
  // ------------------------------------------------------------------------
  zoom(delta) {
    this.scale = Math.max(0.1, Math.min(4.0, this.scale + delta));
    this.updateCanvasDisplayScale();
  }

  setZoom(val) {
    this.scale = val;
    this.updateCanvasDisplayScale();
  }

  fitToScreen() {
    if (!this.mainCanvas || !this.currentImage) return;
    const area = document.querySelector('.crop-canvas-area');
    if (!area) return;

    const pad = 60;
    const availW = area.clientWidth - pad;
    const availH = area.clientHeight - pad;

    const scaleW = availW / this.mainCanvas.width;
    const scaleH = availH / this.mainCanvas.height;

    this.scale = Math.min(1.0, Math.min(scaleW, scaleH));
    this.updateCanvasDisplayScale();
  }

  // ------------------------------------------------------------------------
  // Undo / Redo History Stack
  // ------------------------------------------------------------------------
  saveState(actionName = 'Thao tác') {
    if (!this.mainCanvas) return;

    // Prune forward states if we undid previously
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }

    const state = {
      action: actionName,
      dataUrl: this.mainCanvas.toDataURL('image/png'),
      filters: { ...this.filters },
      rotationAngle: this.rotationAngle
    };

    this.historyStack.push(state);
    this.historyIndex++;
    this.updateHistoryButtons();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistoryState(this.historyStack[this.historyIndex]);
      window.app.showToast(`Hoàn tác: ${this.historyStack[this.historyIndex + 1].action}`, 'info');
    }
  }

  redo() {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyIndex++;
      this.restoreHistoryState(this.historyStack[this.historyIndex]);
      window.app.showToast(`Làm lại: ${this.historyStack[this.historyIndex].action}`, 'info');
    }
  }

  restoreHistoryState(state) {
    if (!state) return;
    const img = new Image();
    img.onload = () => {
      this.currentImage = img;
      this.filters = { ...state.filters };
      this.rotationAngle = state.rotationAngle || 0;
      this.render();
      this.updateHistoryButtons();
    };
    img.src = state.dataUrl;
  }

  resetToOriginal() {
    if (!this.originalImage) return;
    this.currentImage = this.originalImage;
    this.rotationAngle = 0;
    this.flipH = false;
    this.flipV = false;
    this.resetFilters(false);
    this.render();
    this.fitToScreen();
    this.saveState('Khôi phục ảnh gốc');
    window.app.showToast('Đã khôi phục ảnh về trạng thái ban đầu', 'info');
  }

  updateHistoryButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) btnUndo.disabled = this.historyIndex <= 0;
    if (btnRedo) btnRedo.disabled = this.historyIndex >= this.historyStack.length - 1;
  }

  // ------------------------------------------------------------------------
  // Export & Download
  // ------------------------------------------------------------------------
  exportImage() {
    if (!this.mainCanvas) return;
    const fmtSelect = document.getElementById('exportFormatSelect');
    const fmt = fmtSelect ? fmtSelect.value : 'png';
    const mime = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
    const quality = fmt === 'jpeg' || fmt === 'webp' ? 0.92 : undefined;

    const dataUrl = this.mainCanvas.toDataURL(mime, quality);
    const link = document.createElement('a');
    link.download = `omnipixel_edit_${Date.now()}.${fmt}`;
    link.href = dataUrl;
    link.click();
    window.app.showToast(`Đã xuất ảnh thành công (.${fmt})!`, 'success');
  }
}

window.CropEditor = CropEditor;
