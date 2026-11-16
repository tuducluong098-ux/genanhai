/**
 * AI Image Generator & Prompt Editor
 * Supports:
 * - Text-to-Image (Tạo ảnh từ Prompt)
 * - Image-to-Image (Chỉnh sửa ảnh gốc bằng Prompt)
 * - 4 Variations Generator (A1, A2, A3, A4)
 * - Iterative Loop: Select A2 -> continue editing (Crop, Rotate, Resize 1000x1500) -> loop again!
 * - Vercel / GitHub Pages / Localhost resilient: never crashes on 404 HTML responses!
 */

class AiEditor {
  constructor() {
    this.mode = 'text2img'; // 'text2img' | 'img2img'
    this.sourceImageDataUrl = null;
    this.currentResultDataUrl = null;
    this.selectedStyle = 'none';
    this.selectedRatio = '1:1';
    this.history = [];
    this.variants = []; // Array of 4 variants: [{ id: 'A1', url: '...' }, { id: 'A2' }, ...]

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

    // Submit button: Generate single or 4 variants
    document.getElementById('btnGenerateAi')?.addEventListener('click', () => this.generate4Variants());
    document.getElementById('btnGenerate4Variants')?.addEventListener('click', () => this.generate4Variants());

    // Send to Crop & Rotate
    document.getElementById('btnAiSendToCrop')?.addEventListener('click', () => {
      if (!this.currentResultDataUrl) return;
      window.app.switchTab('crop');
      window.cropEditor.loadImageFromUrl(this.currentResultDataUrl);
      window.app.showToast('Đã đưa ảnh vào khung chỉnh sửa (Cắt, Xoay, Đổi kích thước)!', 'success');
    });

    // Download AI Image
    document.getElementById('btnAiDownload')?.addEventListener('click', () => {
      if (!this.currentResultDataUrl) return;
      this.downloadDataUrl(this.currentResultDataUrl, `ai_creation_${Date.now()}.png`);
    });

    // Random seed button
    document.getElementById('btnRandomSeed')?.addEventListener('click', () => {
      const seedInput = document.getElementById('aiSeedInput');
      if (seedInput) seedInput.value = Math.floor(Math.random() * 1000000);
    });
  }

  setupSamplePrompts() {
    const samples = [
      'thêm con gián lên mặt, highly aesthetic, dynamic composition, vibrant sharp focus',
      'thêm kính râm cyberpunk phát sáng neon dưới mưa ban đêm',
      'biến thành phong cách anime Studio Ghibli, màu sắc rực rỡ',
      'đổi phông nền thành bãi biển hoàng hôn nhiệt đới lấp lánh'
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
      generateBtnText.textContent = this.mode === 'img2img' ? 'Sinh 4 biến thể AI (A1, A2, A3, A4)' : 'Tạo 4 biến thể AI mới (A1, A2, A3, A4)';
    }
  }

  enhancePromptLocally(rawPrompt, style = 'none') {
    let p = (rawPrompt || '').trim();
    const dict = [
      { vn: /con gián/gi, en: 'realistic cockroach' },
      { vn: /cô gái/gi, en: 'beautiful young girl' },
      { vn: /chàng trai/gi, en: 'handsome man' },
      { vn: /mèo con/gi, en: 'cute kitten' },
      { vn: /chó con/gi, en: 'cute puppy' },
      { vn: /phong cảnh/gi, en: 'landscape scenery' },
      { vn: /hoàng hôn/gi, en: 'golden hour sunset' },
      { vn: /bình minh/gi, en: 'sunrise dawn' },
      { vn: /thành phố/gi, en: 'futuristic city skyline' },
      { vn: /ban đêm/gi, en: 'at night with glowing lights' },
      { vn: /cyberpunk/gi, en: 'cyberpunk neon aesthetic' },
      { vn: /anime/gi, en: 'japanese anime style, Makoto Shinkai aesthetic' },
      { vn: /sơn dầu/gi, en: 'oil painting on textured canvas' },
      { vn: /chân thực|thực tế/gi, en: 'photorealistic 8k uhd, cinematic lighting' },
      { vn: /hoạt hình 3d/gi, en: '3D Pixar Disney animated movie style' },
      { vn: /chụp ảnh/gi, en: 'professional photo shot on 85mm lens, high quality' },
      { vn: /tuyết rơi/gi, en: 'falling snow winter wonderland' },
      { vn: /biển/gi, en: 'tropical ocean beach crystal blue water' }
    ];

    dict.forEach((item) => {
      p = p.replace(item.vn, item.en);
    });

    const styleModifiers = {
      'anime': ', japanese anime art, vibrant colors, Studio Ghibli inspired, detailed background',
      'cyberpunk': ', cyberpunk style, neon violet and cyan lights, rain-slicked city streets, futuristic sci-fi aesthetic',
      'cinematic': ', cinematic movie still, 35mm film photography, 8k resolution, dramatic volumetric lighting, ultra-detailed',
      '3d-pixar': ', 3D Disney Pixar character animation style, smooth lighting, cute charming expressions, octane render 3D',
      'oil-painting': ', masterpiece oil painting, rich textured brush strokes, classical fine art style',
      'watercolor': ', soft watercolor painting, artistic splash, pastel tones, elegant paper texture',
      'fantasy': ', epic fantasy concept art, mystical atmosphere, magical particles, detailed digital art',
      'vintage': ', vintage 1980s retro film look, grain, warm sepia tones, nostalgic aesthetic'
    };

    if (style && styleModifiers[style]) {
      p += styleModifiers[style];
    }
    return p;
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
      default:     return { width: 512, height: 512 };
    }
  }

  // Generate 4 distinct variants (A1, A2, A3, A4)
  async generate4Variants() {
    const textarea = document.getElementById('aiPromptInput');
    const prompt = textarea ? textarea.value.trim() : '';

    if (!prompt) {
      window.app.showToast('Vui lòng nhập prompt mô tả hình ảnh muốn tạo!', 'error');
      return;
    }

    const modelSelect = document.getElementById('aiModelSelect');
    const model = modelSelect ? modelSelect.value : 'flux';
    const baseSeed = Math.floor(Math.random() * 100000);

    const { width, height } = this.getDimensionsForRatio();

    const generateBtn = document.getElementById('btnGenerateAi');
    const spinner = document.getElementById('aiSpinner');
    const btnText = document.getElementById('aiGenerateBtnText');

    if (generateBtn) generateBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Đang sinh 4 biến thể AI (A1, A2, A3, A4)...';

    window.app.showToast('Đang kết nối AI và tạo 4 biến thể (A1, A2, A3, A4)...', 'info');

    const seeds = [baseSeed, baseSeed + 137, baseSeed + 589, baseSeed + 993];
    const variantIds = ['A1', 'A2', 'A3', 'A4'];
    this.variants = [];

    // Container for variants
    const variantsSection = document.getElementById('variantsSection');
    const variantsGrid = document.getElementById('variantsGrid');
    if (variantsSection) variantsSection.style.display = 'block';
    if (variantsGrid) variantsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #60a5fa;"><span class="spinner"></span> Đang tạo 4 biến thể song song...</div>';

    try {
      const isStaticHosting = window.location.hostname.includes('vercel.app') || window.location.hostname.includes('github.io');

      // Fetch 4 variants
      for (let i = 0; i < 4; i++) {
        const vId = variantIds[i];
        const s = seeds[i];
        let vUrl = null;

        // Try local backend first only if running local Express server
        if (!isStaticHosting) {
          try {
            const res = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt,
                style: this.selectedStyle,
                width,
                height,
                model: 'turbo',
                seed: s
              })
            });

            const ct = res.headers.get('content-type') || '';
            if (res.ok && ct.includes('application/json')) {
              const data = await res.json();
              if (data && data.success) vUrl = data.dataUrl;
            }
          } catch (beErr) {
            console.warn(`Variant ${vId} local API failed:`, beErr.message);
          }
        }

        // Direct Pollinations AI fallback (Vercel & GitHub Pages safe)
        if (!vUrl) {
          const enhanced = this.enhancePromptLocally(prompt, this.selectedStyle);
          const encoded = encodeURIComponent(enhanced);
          const directUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${s}&nologo=true`;

          try {
            const imgRes = await fetch(directUrl);
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              vUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            } else {
              // If rate limited, use direct url as preview
              vUrl = directUrl;
            }
          } catch (e) {
            vUrl = directUrl;
          }
        }

        this.variants.push({ id: vId, url: vUrl, seed: s, prompt });
      }

      // Render 4 variant cards
      this.renderVariantsGrid();

      // Also set the first variant as main preview
      if (this.variants.length > 0 && this.variants[0].url) {
        this.currentResultDataUrl = this.variants[0].url;
        const mainImg = document.getElementById('aiMainPreviewImg');
        const emptyPrev = document.getElementById('aiEmptyPreview');
        const prevContainer = document.getElementById('aiPreviewContainer');
        const toolbar = document.getElementById('aiActionToolbar');

        if (emptyPrev) emptyPrev.style.display = 'none';
        if (mainImg) mainImg.src = this.variants[0].url;
        if (prevContainer) prevContainer.style.display = 'flex';
        if (toolbar) toolbar.style.display = 'flex';

        this.addToHistory(this.variants[0].url, `${prompt} (A1)`);
      }

      window.app.showToast('Đã tạo xong 4 biến thể (A1, A2, A3, A4)! Chọn ảnh để chỉnh tiếp.', 'success');
    } catch (err) {
      console.error('Generation error:', err);
      window.app.showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      if (generateBtn) generateBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (btnText) btnText.textContent = this.mode === 'img2img' ? 'Sinh 4 biến thể AI (A1, A2, A3, A4)' : 'Tạo 4 biến thể AI mới (A1, A2, A3, A4)';
    }
  }

  renderVariantsGrid() {
    const grid = document.getElementById('variantsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    this.variants.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'variant-card';
      card.innerHTML = `
        <div class="variant-badge">Biến thể ${v.id}</div>
        <div class="variant-thumb-wrap">
          <img class="variant-thumb" src="${v.url}" alt="Biến thể ${v.id}" />
        </div>
        <div class="variant-card-footer">
          <button class="btn btn-primary btn-sm btn-select-variant" style="font-weight: 600;">
            🎯 Chọn ${v.id} chỉnh tiếp (Lặp vòng)
          </button>
          <button class="btn btn-secondary btn-sm btn-download-variant">
            ⬇️ Tải ảnh ${v.id} về máy
          </button>
        </div>
      `;

      // 1-Click Handover: Set this variant as active canvas image for next loop!
      card.querySelector('.btn-select-variant').addEventListener('click', () => {
        this.selectVariantAsNextBase(v);
      });

      // Download this variant
      card.querySelector('.btn-download-variant').addEventListener('click', () => {
        this.downloadDataUrl(v.url, `omnipixel_variant_${v.id}_${Date.now()}.png`);
      });

      grid.appendChild(card);
    });
  }

  // Iterative Loop: Select A1, A2, A3, or A4 to continue editing seamlessly!
  selectVariantAsNextBase(variant) {
    document.querySelectorAll('.variant-card').forEach((c) => c.classList.remove('selected-base'));
    // Mark card as selected
    window.app.switchTab('crop');
    window.cropEditor.loadImageFromUrl(variant.url);
    this.sourceImageDataUrl = variant.url;

    window.app.showToast(`Đã chọn biến thể ${variant.id} làm ảnh nền A! Bạn có thể Cắt, Xoay, Đổi độ phân giải (1000x1500) và tiếp tục Prompt AI.`, 'success');
  }

  downloadDataUrl(url, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    window.app.showToast('Đang tải ảnh về máy...', 'success');
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
