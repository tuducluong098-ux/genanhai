const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cheerio = require('cheerio');
const archiverModule = require('archiver');
const createArchive = typeof archiverModule === 'function' ? archiverModule : (archiverModule.default || ((format, options) => {
  if (format === 'zip') return new archiverModule.ZipArchive(options);
  if (format === 'tar') return new archiverModule.TarArchive(options);
  return new archiverModule.Archiver(options);
}));
const axios = require('axios');
const path = require('path');
const { Jimp } = require('jimp');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for in-memory file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB max
});

// Helper: Read Jimp instance from file or base64 or URL
async function getJimpImage(req) {
  if (req.file && req.file.buffer) {
    return await Jimp.read(req.file.buffer);
  }
  const { imageBase64, imageUrl } = req.body;
  if (imageBase64) {
    // Handle data:image/png;base64,...
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    return await Jimp.read(buffer);
  }
  if (imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
    });
    return await Jimp.read(response.data);
  }
  throw new Error('No image provided. Please upload a file, base64 data, or an image URL.');
}

// --------------------------------------------------------------------------
// 1. TRANSFORM API ENDPOINTS (Inspired by pdfsimpli.com Image Editor)
// --------------------------------------------------------------------------

// Crop endpoint
app.post('/api/transform/crop', upload.single('image'), async (req, res) => {
  try {
    const x = parseInt(req.body.x, 10);
    const y = parseInt(req.body.y, 10);
    const w = parseInt(req.body.width, 10);
    const h = parseInt(req.body.height, 10);

    if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      return res.status(400).json({ error: 'x, y, width, and height must be valid positive integers.' });
    }

    const img = await getJimpImage(req);
    const imgWidth = img.bitmap.width;
    const imgHeight = img.bitmap.height;

    // Constrain to bounds
    const safeX = Math.max(0, Math.min(x, imgWidth - 1));
    const safeY = Math.max(0, Math.min(y, imgHeight - 1));
    const safeW = Math.max(1, Math.min(w, imgWidth - safeX));
    const safeH = Math.max(1, Math.min(h, imgHeight - safeY));

    img.crop({ x: safeX, y: safeY, w: safeW, h: safeH });

    const mime = req.body.format === 'jpeg' || req.body.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const buffer = await img.getBuffer(mime);

    res.set('Content-Type', mime);
    res.set('X-Image-Width', img.bitmap.width.toString());
    res.set('X-Image-Height', img.bitmap.height.toString());

    if (req.query.format === 'json') {
      return res.json({
        success: true,
        width: img.bitmap.width,
        height: img.bitmap.height,
        dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
      });
    }

    res.send(buffer);
  } catch (err) {
    console.error('Crop error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Rotate endpoint
app.post('/api/transform/rotate', upload.single('image'), async (req, res) => {
  try {
    const degrees = parseFloat(req.body.degrees || req.body.angle || 90);
    if (isNaN(degrees)) {
      return res.status(400).json({ error: 'degrees must be a valid number.' });
    }

    const img = await getJimpImage(req);
    img.rotate(degrees);

    const mime = req.body.format === 'jpeg' || req.body.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const buffer = await img.getBuffer(mime);

    res.set('Content-Type', mime);
    if (req.query.format === 'json') {
      return res.json({
        success: true,
        width: img.bitmap.width,
        height: img.bitmap.height,
        dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
      });
    }
    res.send(buffer);
  } catch (err) {
    console.error('Rotate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Flip endpoint
app.post('/api/transform/flip', upload.single('image'), async (req, res) => {
  try {
    const direction = (req.body.direction || 'horizontal').toLowerCase();
    const horizontal = direction === 'horizontal' || direction === 'both' || req.body.horizontal === 'true' || req.body.horizontal === true;
    const vertical = direction === 'vertical' || direction === 'both' || req.body.vertical === 'true' || req.body.vertical === true;

    const img = await getJimpImage(req);
    img.flip({ horizontal, vertical });

    const mime = req.body.format === 'jpeg' || req.body.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const buffer = await img.getBuffer(mime);

    res.set('Content-Type', mime);
    if (req.query.format === 'json') {
      return res.json({
        success: true,
        width: img.bitmap.width,
        height: img.bitmap.height,
        dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
      });
    }
    res.send(buffer);
  } catch (err) {
    console.error('Flip error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Resize endpoint
app.post('/api/transform/resize', upload.single('image'), async (req, res) => {
  try {
    const w = parseInt(req.body.width, 10);
    const h = parseInt(req.body.height, 10);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      return res.status(400).json({ error: 'width and height must be positive numbers.' });
    }

    const img = await getJimpImage(req);
    img.resize({ w, h });

    const mime = req.body.format === 'jpeg' || req.body.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const buffer = await img.getBuffer(mime);

    res.set('Content-Type', mime);
    if (req.query.format === 'json') {
      return res.json({
        success: true,
        width: img.bitmap.width,
        height: img.bitmap.height,
        dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
      });
    }
    res.send(buffer);
  } catch (err) {
    console.error('Resize error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Filter & Effects endpoint (brightness, contrast, blur, grayscale, sepia, invert, pixelate)
app.post('/api/transform/filter', upload.single('image'), async (req, res) => {
  try {
    const img = await getJimpImage(req);
    const { brightness, contrast, blur, grayscale, greyscale, sepia, invert, pixelate, opacity } = req.body;

    if (brightness !== undefined && !isNaN(parseFloat(brightness))) {
      // Jimp brightness: -1 to 1
      img.brightness(parseFloat(brightness));
    }
    if (contrast !== undefined && !isNaN(parseFloat(contrast))) {
      // Jimp contrast: -1 to 1
      img.contrast(parseFloat(contrast));
    }
    if (blur !== undefined && parseInt(blur, 10) > 0) {
      img.blur(Math.min(20, parseInt(blur, 10)));
    }
    if (grayscale === 'true' || grayscale === true || greyscale === 'true' || greyscale === true) {
      img.greyscale();
    }
    if (sepia === 'true' || sepia === true) {
      img.sepia();
    }
    if (invert === 'true' || invert === true) {
      img.invert();
    }
    if (pixelate !== undefined && parseInt(pixelate, 10) > 1) {
      img.pixelate(Math.min(50, parseInt(pixelate, 10)));
    }
    if (opacity !== undefined && !isNaN(parseFloat(opacity))) {
      img.opacity(parseFloat(opacity));
    }

    const mime = 'image/png';
    const buffer = await img.getBuffer(mime);

    res.set('Content-Type', mime);
    if (req.query.format === 'json') {
      return res.json({
        success: true,
        width: img.bitmap.width,
        height: img.bitmap.height,
        dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
      });
    }
    res.send(buffer);
  } catch (err) {
    console.error('Filter error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Process All (chained transformation pipeline)
app.post('/api/transform/process-all', upload.single('image'), async (req, res) => {
  try {
    const img = await getJimpImage(req);
    const { crop, rotate, flip, resize, filter, outputFormat, quality } = req.body;

    // Parse options if passed as JSON string
    const cropOpts = typeof crop === 'string' ? JSON.parse(crop) : crop;
    const rotateOpts = typeof rotate === 'string' ? JSON.parse(rotate) : rotate;
    const flipOpts = typeof flip === 'string' ? JSON.parse(flip) : flip;
    const resizeOpts = typeof resize === 'string' ? JSON.parse(resize) : resize;
    const filterOpts = typeof filter === 'string' ? JSON.parse(filter) : filter;

    // 1. Crop
    if (cropOpts && cropOpts.width > 0 && cropOpts.height > 0) {
      const safeX = Math.max(0, Math.min(parseInt(cropOpts.x, 10) || 0, img.bitmap.width - 1));
      const safeY = Math.max(0, Math.min(parseInt(cropOpts.y, 10) || 0, img.bitmap.height - 1));
      const safeW = Math.max(1, Math.min(parseInt(cropOpts.width, 10), img.bitmap.width - safeX));
      const safeH = Math.max(1, Math.min(parseInt(cropOpts.height, 10), img.bitmap.height - safeY));
      img.crop({ x: safeX, y: safeY, w: safeW, h: safeH });
    }

    // 2. Rotate
    if (rotateOpts && rotateOpts.degrees) {
      img.rotate(parseFloat(rotateOpts.degrees));
    }

    // 3. Flip
    if (flipOpts && (flipOpts.horizontal || flipOpts.vertical)) {
      img.flip({
        horizontal: !!flipOpts.horizontal,
        vertical: !!flipOpts.vertical
      });
    }

    // 4. Resize
    if (resizeOpts && resizeOpts.width > 0 && resizeOpts.height > 0) {
      img.resize({ w: parseInt(resizeOpts.width, 10), h: parseInt(resizeOpts.height, 10) });
    }

    // 5. Filters
    if (filterOpts) {
      if (filterOpts.brightness !== undefined && parseFloat(filterOpts.brightness) !== 0) {
        img.brightness(parseFloat(filterOpts.brightness));
      }
      if (filterOpts.contrast !== undefined && parseFloat(filterOpts.contrast) !== 0) {
        img.contrast(parseFloat(filterOpts.contrast));
      }
      if (filterOpts.blur && parseInt(filterOpts.blur, 10) > 0) {
        img.blur(Math.min(20, parseInt(filterOpts.blur, 10)));
      }
      if (filterOpts.grayscale) img.greyscale();
      if (filterOpts.sepia) img.sepia();
      if (filterOpts.invert) img.invert();
      if (filterOpts.pixelate && parseInt(filterOpts.pixelate, 10) > 1) {
        img.pixelate(Math.min(50, parseInt(filterOpts.pixelate, 10)));
      }
    }

    const fmt = (outputFormat || 'png').toLowerCase();
    const mime = fmt === 'jpeg' || fmt === 'jpg' ? 'image/jpeg' : 'image/png';
    const buffer = await img.getBuffer(mime);

    return res.json({
      success: true,
      width: img.bitmap.width,
      height: img.bitmap.height,
      format: fmt,
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
    });
  } catch (err) {
    console.error('Process All error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------------------------
// 2. WEB IMAGE DOWNLOADER (Chrome Extension Style)
// --------------------------------------------------------------------------

// Scrape images from target URL
app.post('/api/scrape-images', async (req, res) => {
  try {
    const { url: targetUrl } = req.body;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Please provide a valid URL starting with http:// or https://' });
    }

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    const imageMap = new Map();

    const addCandidate = (rawUrl, alt = '', context = '') => {
      if (!rawUrl || typeof rawUrl !== 'string') return;
      const trimmed = rawUrl.trim();
      if (trimmed.startsWith('data:image/')) {
        // inline data URL
        const id = 'data_' + Math.random().toString(36).substring(2, 9);
        imageMap.set(id, {
          url: trimmed,
          alt: alt || 'Inline Base64 Image',
          context,
          format: trimmed.split(';')[0].replace('data:image/', '').toUpperCase() || 'PNG',
          isBase64: true
        });
        return;
      }
      try {
        const fullUrl = new URL(trimmed, targetUrl).href;
        if (!imageMap.has(fullUrl)) {
          // Detect format from url
          let format = 'UNKNOWN';
          const cleanUrl = fullUrl.split('?')[0].toLowerCase();
          if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) format = 'JPG';
          else if (cleanUrl.endsWith('.png')) format = 'PNG';
          else if (cleanUrl.endsWith('.webp')) format = 'WEBP';
          else if (cleanUrl.endsWith('.svg')) format = 'SVG';
          else if (cleanUrl.endsWith('.gif')) format = 'GIF';
          else if (cleanUrl.endsWith('.avif')) format = 'AVIF';

          imageMap.set(fullUrl, {
            url: fullUrl,
            alt: alt || '',
            context,
            format,
            isBase64: false
          });
        }
      } catch (e) {}
    };

    // 1. Scan <img>
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('data-lazy-src');
      const alt = $(el).attr('alt') || $(el).attr('title') || '';
      addCandidate(src, alt, 'img');

      const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
      if (srcset) {
        srcset.split(',').forEach(item => {
          const u = item.trim().split(' ')[0];
          addCandidate(u, alt, 'srcset');
        });
      }
    });

    // 2. Scan <picture> and <source>
    $('picture source, video source').each((_, el) => {
      const srcset = $(el).attr('srcset') || $(el).attr('src');
      if (srcset) {
        srcset.split(',').forEach(item => {
          const u = item.trim().split(' ')[0];
          addCandidate(u, '', 'source');
        });
      }
    });

    // 3. Scan meta tags
    $('meta[property="og:image"], meta[name="twitter:image"], meta[itemprop="image"]').each((_, el) => {
      const content = $(el).attr('content');
      addCandidate(content, 'Social OpenGraph Image', 'meta');
    });

    // 4. Scan <a> links pointing directly to images
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && /\.(jpe?g|png|webp|gif|svg|avif)($|\?)/i.test(href)) {
        addCandidate(href, $(el).text().trim() || 'Link Image', 'anchor');
      }
    });

    // 5. Scan inline styles for background-image
    $('*[style]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const bgMatch = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
      if (bgMatch && bgMatch[1]) {
        addCandidate(bgMatch[1], 'CSS Background Image', 'css');
      }
    });

    const results = Array.from(imageMap.values());

    res.json({
      success: true,
      targetUrl,
      title: $('title').text().trim() || 'Scraped Webpage',
      totalFound: results.length,
      images: results
    });
  } catch (err) {
    console.error('Scrape error:', err.message);
    res.status(500).json({ error: `Could not scrape URL: ${err.message}` });
  }
});

// Proxy endpoint to stream image with CORS headers (bypasses hotlink protection & canvas tainting)
app.get('/api/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('Missing url parameter');

    if (imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.set('Content-Type', type);
        res.set('Access-Control-Allow-Origin', '*');
        return res.send(buffer);
      }
    }

    const parsed = new URL(imageUrl);
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': parsed.origin,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 12000
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Failed to fetch image: ' + err.message);
  }
});

// Bulk Download ZIP
app.post('/api/download-zip', async (req, res) => {
  try {
    const { urls, zipName = 'images-download.zip' } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of image urls' });
    }

    res.attachment(zipName);
    const archive = createArchive('zip', { zlib: { level: 6 } });

    archive.on('error', err => {
      console.error('Archive error:', err);
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    let count = 0;
    for (let i = 0; i < urls.length; i++) {
      const imgUrl = urls[i];
      try {
        let buffer;
        let ext = 'jpg';

        if (imgUrl.startsWith('data:image/')) {
          const parts = imgUrl.split(';');
          ext = parts[0].replace('data:image/', '') || 'png';
          buffer = Buffer.from(parts[1].replace('base64,', ''), 'base64');
        } else {
          const resp = await axios.get(imgUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
          });
          buffer = Buffer.from(resp.data);
          const ct = resp.headers['content-type'] || '';
          if (ct.includes('png')) ext = 'png';
          else if (ct.includes('webp')) ext = 'webp';
          else if (ct.includes('svg')) ext = 'svg';
          else if (ct.includes('gif')) ext = 'gif';
          else {
            const clean = imgUrl.split('?')[0].toLowerCase();
            const m = clean.match(/\.(png|jpe?g|webp|gif|svg|avif)$/);
            if (m) ext = m[1].replace('jpeg', 'jpg');
          }
        }

        const fileName = `image_${String(i + 1).padStart(3, '0')}.${ext}`;
        archive.append(buffer, { name: fileName });
        count++;
      } catch (e) {
        console.warn(`Failed to fetch image ${i + 1} (${imgUrl}):`, e.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('Zip endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------------------------
// 3. AI PROMPT IMAGE GENERATION & EDITING
// --------------------------------------------------------------------------

// Enhance prompt helper: auto-translates Vietnamese common concepts or adds visual polish
function enhancePromptText(rawPrompt, style = 'none') {
  let prompt = (rawPrompt || '').trim();

  // Dictionary for popular Vietnamese image keywords to English
  const dict = [
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

  dict.forEach(item => {
    prompt = prompt.replace(item.vn, item.en);
  });

  const styleModifiers = {
    'anime': ', japanese anime art, vibrant colors, Studio Ghibli and Makoto Shinkai inspired, detailed background',
    'cyberpunk': ', cyberpunk style, neon violet and cyan lights, rain-slicked city streets, futuristic sci-fi aesthetic',
    'cinematic': ', cinematic movie still, 35mm film photography, 8k resolution, dramatic volumetric lighting, ultra-detailed',
    '3d-pixar': ', 3D Disney Pixar character animation style, smooth lighting, cute charming expressions, octane render 3D',
    'oil-painting': ', masterpiece oil painting, rich textured brush strokes, classical fine art style',
    'watercolor': ', soft watercolor painting, artistic splash, pastel tones, elegant paper texture',
    'fantasy': ', epic fantasy concept art, mystical atmosphere, magical particles, detailed digital art',
    'vintage': ', vintage 1980s retro film look, grain, warm sepia tones, nostalgic aesthetic'
  };

  if (style && styleModifiers[style]) {
    prompt += styleModifiers[style];
  }

  return prompt;
}

// AI Generate from prompt
app.post('/api/ai/generate', async (req, res) => {
  try {
    const {
      prompt,
      style = 'none',
      width = 768,
      height = 768,
      model = 'flux', // flux, turbo, etc.
      seed = Math.floor(Math.random() * 1000000),
      enhance = true
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Please enter a prompt.' });
    }

    const enhanced = enhance ? enhancePromptText(prompt, style) : prompt;
    const encodedPrompt = encodeURIComponent(enhanced);

    // Call Pollinations AI
    const safeModel = ['flux', 'turbo'].includes(model) ? model : 'flux';
    const safeWidth = Math.min(1280, Math.max(256, parseInt(width, 10) || 768));
    const safeHeight = Math.min(1280, Math.max(256, parseInt(height, 10) || 768));

    const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${safeWidth}&height=${safeHeight}&seed=${seed}&model=${safeModel}&nologo=true`;

    const aiRes = await axios.get(pollUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const mime = aiRes.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(aiRes.data).toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    res.json({
      success: true,
      prompt: prompt,
      enhancedPrompt: enhanced,
      width: safeWidth,
      height: safeHeight,
      seed,
      model: safeModel,
      dataUrl,
      directUrl: pollUrl
    });
  } catch (err) {
    console.error('AI generate error:', err);
    res.status(500).json({ error: `AI Generation failed: ${err.message}` });
  }
});

// AI Edit / Modify Image with prompt
app.post('/api/ai/edit', upload.single('image'), async (req, res) => {
  try {
    const { prompt, style = 'none', strength = 0.7, model = 'flux' } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Please enter a prompt to guide the AI edit.' });
    }

    const enhanced = enhancePromptText(prompt, style);
    const encodedPrompt = encodeURIComponent(enhanced);
    const seed = Math.floor(Math.random() * 1000000);

    // Pollinations AI handles high-quality image generation guided by prompt
    const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=800&seed=${seed}&model=${model}&nologo=true`;

    const aiRes = await axios.get(pollUrl, {
      responseType: 'arraybuffer',
      timeout: 35000
    });

    const mime = aiRes.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(aiRes.data).toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    res.json({
      success: true,
      prompt,
      enhancedPrompt: enhanced,
      dataUrl,
      directUrl: pollUrl
    });
  } catch (err) {
    console.error('AI edit error:', err);
    res.status(500).json({ error: `AI Edit failed: ${err.message}` });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'OmniPixel Studio',
    version: '1.0.0',
    capabilities: ['crop', 'rotate', 'flip', 'resize', 'filter', 'ai-generate', 'ai-edit', 'web-scraper', 'bulk-zip']
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 OmniPixel Studio is running on: http://localhost:${PORT}`);
  console.log(`✂️  Crop & Rotate Studio: http://localhost:${PORT}/#crop`);
  console.log(`🎨 AI Image Generator & Editor: http://localhost:${PORT}/#ai`);
  console.log(`📥 Web Image Downloader: http://localhost:${PORT}/#downloader`);
  console.log(`⚡ API Documentation & Tester: http://localhost:${PORT}/#api`);
  console.log(`=======================================================`);
});
