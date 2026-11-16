/**
 * API Tester & Documentation interactive runner
 */

class ApiTester {
  constructor() {
    this.init();
  }

  init() {
    // Test Scrape Button
    document.getElementById('btnTestScrape')?.addEventListener('click', async () => {
      const url = document.getElementById('apiTestScrapeUrl')?.value || 'https://en.wikipedia.org/wiki/Cat';
      const output = document.getElementById('apiTestScrapeOutput');
      if (output) output.textContent = 'Đang gọi POST /api/scrape-images...';

      try {
        const res = await fetch('/api/scrape-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (output) output.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        if (output) output.textContent = `Lỗi: ${e.message}`;
      }
    });

    // Test AI Generate Button
    document.getElementById('btnTestAiGen')?.addEventListener('click', async () => {
      const prompt = document.getElementById('apiTestAiPrompt')?.value || 'cute cat in sunglasses';
      const output = document.getElementById('apiTestAiOutput');
      const imgPreview = document.getElementById('apiTestAiPreview');
      if (output) output.textContent = 'Đang gọi POST /api/ai/generate...';

      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, width: 512, height: 512 })
        });
        const data = await res.json();
        if (output) output.textContent = JSON.stringify({ ...data, dataUrl: data.dataUrl ? data.dataUrl.substring(0, 50) + '...' : null }, null, 2);
        if (imgPreview && data.dataUrl) {
          imgPreview.src = data.dataUrl;
          imgPreview.style.display = 'block';
        }
      } catch (e) {
        if (output) output.textContent = `Lỗi: ${e.message}`;
      }
    });

    // Test Rotate/Crop endpoint
    document.getElementById('btnTestRotateApi')?.addEventListener('click', async () => {
      const degrees = document.getElementById('apiTestRotateDeg')?.value || 90;
      const output = document.getElementById('apiTestRotateOutput');
      const imgPreview = document.getElementById('apiTestRotatePreview');
      if (output) output.textContent = 'Đang gọi POST /api/transform/rotate?format=json...';

      try {
        // Create a small 100x100 canvas with red square
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(0, 0, 120, 80);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.fillText('Test API', 20, 45);

        const res = await fetch('/api/transform/rotate?format=json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: canvas.toDataURL('image/png'),
            degrees: parseFloat(degrees)
          })
        });
        const data = await res.json();
        if (output) output.textContent = JSON.stringify({ ...data, dataUrl: data.dataUrl.substring(0, 50) + '...' }, null, 2);
        if (imgPreview && data.dataUrl) {
          imgPreview.src = data.dataUrl;
          imgPreview.style.display = 'block';
        }
      } catch (e) {
        if (output) output.textContent = `Lỗi: ${e.message}`;
      }
    });
  }
}

window.ApiTester = ApiTester;
