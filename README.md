# ✨ OmniPixel Studio

Ứng dụng web toàn diện tích hợp 3 tính năng mạnh mẽ:
1. **Chỉnh sửa & Tạo ảnh bằng AI Prompt** (Text-to-Image & Image-to-Image với hỗ trợ dịch tiếng Việt thông minh).
2. **Cắt, Xoay & Chỉnh màu đa năng theo chuẩn PdfSimpli** (`pdfsimpli.com/app/vi/image-editor/edit`) với khung cắt 8 góc trực quan, xoay 90°/-90°/180°/tự do, lật ngang/dọc, bộ lọc ánh sáng & màu sắc.
3. **Bộ quét & Tải ảnh hàng loạt theo chuẩn tiện ích Chrome Image Downloader** (`cnpniohnfphhjihaiiggeabnkjhpaldj`) với thanh lọc độ phân giải, định dạng, từ khóa, chọn tất cả và tải về dạng file nén ZIP.

---

## 🚀 Cách khởi động nhanh

### Cách 1: Double-click file `start.bat`
Chạy file `start.bat` trong thư mục `ai-image-studio`. Hệ thống sẽ tự động mở trình duyệt tại:
👉 `http://localhost:3001`

### Cách 2: Chạy qua Terminal / PowerShell
```bash
cd ai-image-studio
npm start
# hoặc: node server.js
```

---

## 🌟 Chi tiết các tính năng chính

### 1. ✂️ Cắt & Xoay ảnh (PdfSimpli Style)
- **Vùng chọn cắt 8 điểm neo (8 Resize Handles)**: Kéo thả các góc `nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w` tương tự PdfSimpli với thước lưới 1/3 (rule of thirds).
- **Tỉ lệ khung hình cố định**: Tự do (Free), 1:1 (Vuông), 4:3, 16:9, 9:16 (Story/TikTok/Reels), 3:2, 2:3.
- **Xoay & Lật ảnh**:
  - Xoay nhanh 90° cùng chiều kim đồng hồ, -90° ngược chiều, 180°.
  - Thanh trượt xoay góc tự do từ -180° đến +180° với nút reset 0°.
  - Lật ngang (Flip Horizontal), lật dọc (Flip Vertical).
- **Đổi kích thước (Resize)**: Nhập chiều rộng & chiều cao pixel tùy ý.
- **Ánh sáng & Tông màu (Light & Tone)**:
  - Độ sáng (Brightness: -100% đến +100%)
  - Độ tương phản (Contrast: -100% đến +100%)
  - Độ mờ (Blur: 0px đến 20px)
  - Độ trong suốt (Opacity: 10% đến 100%)
- **Màu sắc & Hiệu ứng (Colors & Effects)**:
  - Đen trắng (Grayscale), Hoài cổ (Sepia), Đảo màu (Invert).
  - Điểm ảnh (Pixelate: 1 - 20), Ngưỡng nhị phân (Threshold: 0 - 255).
- **Lịch sử & Phím tắt**:
  - Hoàn tác (`Ctrl+Z`), Làm lại (`Ctrl+Y`), Khôi phục ảnh gốc.
  - Phóng to, thu nhỏ, vừa màn hình, 100% kích thước thực.
  - Xuất ảnh ra định dạng PNG, JPG (chất lượng cao), WEBP.
  - Nút **"Chuyển sang AI Prompt ➡️"** chuyển thẳng ảnh đang sửa sang tab AI mà không cần tải về máy.

### 2. 🎨 Chỉnh ảnh bằng AI Prompt
- **2 Chế độ linh hoạt**:
  - **Tạo ảnh mới từ Prompt (Text-to-Image)**: Nhập văn bản mô tả để AI vẽ ảnh mới.
  - **Chỉnh sửa ảnh gốc với Prompt (Image-to-Image)**: Tải ảnh lên hoặc nhận ảnh từ tab Cắt/Tải ảnh, sau đó nhập prompt để biến đổi phong cách.
- **Bộ nhận diện & Tối ưu Prompt tiếng Việt**: Tự động nhận dạng các từ khóa tiếng Việt (cô gái, cyberpunk, anime, sơn dầu, hoàng hôn, tuyết rơi...) và chuyển hóa thành câu lệnh AI chuẩn 8K, cinematic lighting.
- **Gợi ý Style Tags**: 🎌 Anime Nhật Bản, 🏙️ Cyberpunk Neon, 📸 Chụp ảnh chân thực 8K, 🧸 3D Pixar, 🎨 Tranh sơn dầu, 🖌️ Màu nước, 🏰 Fantasy, 📻 Vintage 80s.
- **Các tỉ lệ hỗ trợ**: 1:1, 16:9, 9:16, 4:3.
- **Model**: Flux (chất lượng cao) & Turbo (siêu tốc).
- **Nút "Mở trong Cắt & Xoay"**: Chuyển ngay kết quả AI sang tab Cắt để tiếp tục tinh chỉnh.

### 3. 📥 Tải ảnh web (Image Downloader Extension Style)
- Nhập bất kỳ URL trang web nào (ví dụ: Wikipedia, Unsplash, VnExpress, trang tin tức, shop...).
- **Cơ chế quét toàn diện**: Trích xuất tất cả `<img>`, `<picture>`, `<source srcset>`, CSS `background-image`, `<a>` link ảnh và thẻ `og:image`.
- **Thanh lọc nâng cao**:
  - Thanh trượt Chiều rộng tối thiểu (Min Width: 0 - 2000px).
  - Thanh trượt Chiều cao tối thiểu (Min Height: 0 - 2000px) giúp loại bỏ ngay các icon nhỏ, pixel theo dõi.
  - Lọc định dạng: Tất cả, JPG, PNG, WEBP, SVG, GIF.
  - Lọc theo từ khóa URL hoặc tên thẻ alt.
  - Lọc theo hướng ảnh: Tất cả, Ngang (Landscape), Dọc (Portrait), Vuông (Square).
- **Thao tác hàng loạt**:
  - Chọn tất cả, Bỏ chọn, Đảo chọn.
  - Bộ đếm thời gian thực: `Đã chọn: X / Y ảnh`.
  - **Nút "Tải xuống các ảnh đã chọn (.ZIP)"**: Tự động nén toàn bộ ảnh đã chọn thành 1 file ZIP duy nhất tải về máy.
  - **Nút "Tải lần lượt từng ảnh"**.
- **Tích hợp trên từng thẻ ảnh**:
  - ✂️ **Cắt/Xoay**: Mở trực tiếp ảnh này vào Studio Cắt & Xoay.
  - 🎨 **Chỉnh AI**: Mở trực tiếp ảnh này vào Studio AI Prompt.
  - ⬇️ **Tải ảnh đơn lẻ**.
  - 🔗 **Sao chép URL**.

### 4. ⚡ Hệ thống REST API tích hợp
Các API có thể gọi trực tiếp từ backend hoặc công cụ bên ngoài:
- `POST /api/transform/crop`: Cắt ảnh theo `x, y, width, height`.
- `POST /api/transform/rotate`: Xoay ảnh theo số độ `degrees`.
- `POST /api/transform/flip`: Lật ngang/dọc `horizontal`, `vertical`.
- `POST /api/transform/resize`: Đổi kích thước `width`, `height`.
- `POST /api/transform/filter`: Áp dụng bộ lọc ánh sáng, màu sắc.
- `POST /api/scrape-images`: Quét và trích xuất danh sách ảnh từ URL.
- `GET /api/proxy-image?url=...`: Proxy ảnh vượt rào cản CORS & Hotlink protection.
- `POST /api/download-zip`: Đóng gói danh sách URL thành file nén ZIP.
- `POST /api/ai/generate`: Tạo ảnh AI từ prompt.
- `POST /api/ai/edit`: Chỉnh sửa ảnh AI với prompt.
