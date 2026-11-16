/**
 * AI Image Generator & Prompt Editor
 * Supports:
 * - Text-to-Image (Tạo ảnh từ Prompt)
 * - Image-to-Image (Chỉnh sửa ảnh gốc bằng Prompt)
 * - Preset visual style tags
 * - Vietnamese-to-English intelligent enhancement
 * - Aspect ratios (1:1, 16:9, 9:16, 4:3, 3:2)
 * - 1-Click handover to Crop & Rotate Studio
 */

class AiEditor {
  constructor() {
    this.mode = 'text2img'; // 'text2img' | 'img2img'
    this.sourceImageDataUrl = null;
    this.currentResultDataUrl = null;
    this.selectedStyle = 'none';
    this.selectedRatio = '1:1';
    this.history = [];

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupSamplePrompts();
  }

  bindEvents() {
    // Mode toggling
    document.querySelectorAll('.ai-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ai-mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.mode = btn.getAttribute('data-mode');
        this.updateModeUI();
      });
    });

    // Style tag clicks
    document.querySelectorAll('.style-tag').forEach((tag) => {
      tag.addEventListener('click', () => {
        if (tag.classList.contains('active')) {
          tag.classList.remove('active');
          this.selectedStyle = 'none';
        } else {
          document.querySelectorAll('.style-tag').forEach((t) => t.classList.remove('active'));
          tag.classList.add('active');
          this.selectedStyle = tag.getAttribute('data-style');
        }
      });
    });

    // Ratio selectors
    document.querySelectorAll('.ai-ratio-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ai-ratio-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedRatio = btn.getAttribute('data-ratio');
      });
    });

    // Source image upload for img2img
    const sourceFileInput = document.getElementById('aiSourceFileInput');
    if (sourceFileInput) {
      sourceFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.loadSourceImage(ev.target.result);
          };
          reader.readAsDataURL(e.target.files[0]);
        }
      });
    }

    // Enhance prompt button
    document.getElementById('btnEnhancePrompt')?.addEventListener('click', () => this.enhancePrompt());

    // Submit button
    document.getElementById('btnGenerateAi')?.addEventListener('click', () => this.generate());

    // Send to Crop & Rotate
    document.getElementById('btnAiSendToCrop')?.addEventListener('click', () => {
      if (!this.currentResultDataUrl) return;
      window.app.switchTab('crop');
      window.cropEditor.loadImageFromUrl(this.currentResultDataUrl);
      window.app.showToast('Đã chuyển ảnh sang Studio Cắt & Xoay!', 'success');
    });

    // Download AI Image
    document.getElementById('btnAiDownload')?.addEventListener('click', () => {
      if (!this.currentResultDataUrl) return;
      const link = document.createElement('a');
      link.download = `ai_creation_${Date.now()}.png`;
      link.href = this.currentResultDataUrl;
      link.click();
      window.app.showToast('Đã tải ảnh AI về máy!', 'success');
    });

    // Random seed button
    document.getElementById('btnRandomSeed')?.addEventListener('click', () => {
      const seedInput = document.getElementById('aiSeedInput');
      if (seedInput) seedInput.value = Math.floor(Math.random() * 1000000);
    });
  }

  setupSamplePrompts() {
    const samples = [
      'Chân dung cô gái cyberpunk ban đêm dưới mưa, ánh đèn neon tím xanh phản chiếu',
      'Chú mèo phi hành gia trôi nổi trong dải ngân hà lấp lánh sao, phong cách 3D hoạt hình',
      'Lâu đài kỳ bí trên đỉnh núi mây mù, ánh sáng hoàng hôn vàng rực rỡ, tranh sơn dầu',
      'Xe thể thao cổ điển thập niên 80 chạy trên cung đường biển, phong cách phim vintage'
    ];

    const container = document.getElementById('aiSamplePrompts');
    if (!container) return;

    samples.forEach((txt) => {
      const chip = document.createElement('span');
      chip.className = 'sample-chip';
      chip.textContent = txt.length > 35 ? txt.substring(0, 35) + '...' : txt;
      chip.title = txt;
      chip.addEventListener('click', () => {
        const textarea = document.getElementById('aiPromptInput');
        if (textarea) textarea.value = txt;
      });
      container.appendChild(chip);
    });
  }

  loadSourceImage(dataUrl) {
    this.sourceImageDataUrl = dataUrl;
    const preview = document.getElementById('aiSourceThumb');
    if (preview) {
      preview.src = dataUrl;
      preview.style.display = 'block';
    }
    document.getElementById('aiSourceEmpty')?.style.setProperty('display', 'none');
    // Switch mode to img2img automatically
    const btn = document.querySelector('.ai-mode-btn[data-mode="img2img"]');
    if (btn) btn.click();
  }

  updateModeUI() {
    const sourceCard = document.getElementById('aiSourceImageCard');
    if (sourceCard) {
      sourceCard.style.display = this.mode === 'img2img' ? 'block' : 'none';
    }
    const generateBtnText = document.getElementById('aiGenerateBtnText');
    if (generateBtnText) {
      generateBtnText.textContent = this.mode === 'img2img' ? 'Chỉnh sửa ảnh với AI' : 'Tạo ảnh mới với AI';
    }
  }

  enhancePrompt() {
    const textarea = document.getElementById('aiPromptInput');
    if (!textarea) return;

    let p = textarea.value.trim();
    if (!p) {
      window.app.showToast('Vui lòng nhập vài từ mô tả trước khi cải thiện prompt!', 'info');
      return;
    }

    const enhancements = [
      '8k resolution, masterpiece, intricate details',
      'cinematic lighting, volumetric atmosphere, unreal engine 5 render',
      'highly aesthetic, dynamic composition, vibrant sharp focus'
    ];
    const pick = enhancements[Math.floor(Math.random() * enhancements.length)];

    textarea.value = `${p}, ${pick}`;
    window.app.showToast('Đã tối ưu hóa prompt chuyên nghiệp!', 'success');
  }

  getDimensionsForRatio() {
    switch (this.selectedRatio) {
      case '16:9': return { width: 1024, height: 576 };
      case '9:16': return { width: 576, height: 1024 };
      case '4:3':  return { width: 800, height: 600 };
      case '3:2':  return { width: 900, height: 600 };
      case '1:1':
      default:     return { width: 768, height: 768 };
    }
  }

  async generate() {
    const textarea = document.getElementById('aiPromptInput');
    const prompt = textarea ? textarea.value.trim() : '';

    if (!prompt) {
      window.app.showToast('Vui lòng nhập prompt mô tả hình ảnh muốn tạo!', 'error');
      return;
    }

    const modelSelect = document.getElementById('aiModelSelect');
    const model = modelSelect ? modelSelect.value : 'flux';
    const seedInput = document.getElementById('aiSeedInput');
    const seed = seedInput && seedInput.value ? parseInt(seedInput.value, 10) : Math.floor(Math.random() * 1000000);

    const { width, height } = this.getDimensionsForRatio();

    const generateBtn = document.getElementById('btnGenerateAi');
    const spinner = document.getElementById('aiSpinner');
    const btnText = document.getElementById('aiGenerateBtnText');
    const placeholder = document.getElementById('aiEmptyPreview');
    const previewImg = document.getElementById('aiMainPreviewImg');
    const previewContainer = document.getElementById('aiPreviewContainer');
    const actionToolbar = document.getElementById('aiActionToolbar');

    // Show loading state
    if (generateBtn) generateBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Đang xử lý hình ảnh với AI...';

    window.app.showToast('Đang kết nối AI và tạo hình ảnh chất lượng cao...', 'info');

    try {
      let endpoint = '/api/ai/generate';
      let payload = {
        prompt,
        style: this.selectedStyle,
        width,
        height,
        model,
        seed
      };

      if (this.mode === 'img2img' && this.sourceImageDataUrl) {
        endpoint = '/api/ai/edit';
        payload.image = this.sourceImageDataUrl;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi tạo ảnh với AI.');
      }

      this.currentResultDataUrl = data.dataUrl;

      // Update preview UI
      if (placeholder) placeholder.style.display = 'none';
      if (previewImg) {
        previewImg.src = data.dataUrl;
        previewImg.style.display = 'block';
      }
      if (previewContainer) previewContainer.style.display = 'flex';
      if (actionToolbar) actionToolbar.style.display = 'flex';

      // Record to history strip
      this.addToHistory(data.dataUrl, prompt);

      window.app.showToast('Tạo ảnh AI thành công!', 'success');
    } catch (err) {
      console.error('AI Generation Error:', err);
      window.app.showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      if (generateBtn) generateBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (btnText) btnText.textContent = this.mode === 'img2img' ? 'Chỉnh sửa ảnh với AI' : 'Tạo ảnh mới với AI';
    }
  }

  addToHistory(url, prompt) {
    this.history.unshift({ url, prompt, timestamp: Date.now() });
    if (this.history.length > 15) this.history.pop();

    const strip = document.getElementById('aiHistoryStrip');
    if (!strip) return;

    strip.innerHTML = '';
    this.history.forEach((item, index) => {
      const thumb = document.createElement('img');
      thumb.className = `history-thumb ${index === 0 ? 'active' : ''}`;
      thumb.src = item.url;
      thumb.title = item.prompt;
      thumb.addEventListener('click', () => {
        document.querySelectorAll('.history-thumb').forEach((t) => t.classList.remove('active'));
        thumb.classList.add('active');
        this.currentResultDataUrl = item.url;
        const previewImg = document.getElementById('aiMainPreviewImg');
        if (previewImg) previewImg.src = item.url;
      });
      strip.appendChild(thumb);
    });
  }
}

window.AiEditor = AiEditor;
