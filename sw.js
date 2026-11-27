/* Service worker: giúp app mở được khi không có mạng.
   - File của app (cùng nguồn): ưu tiên mạng để luôn có bản mới nhất, mất mạng thì dùng bản đã lưu.
   - Thư viện và phông chữ từ CDN (KaTeX, SheetJS, pdf.js, mammoth, Google Fonts): dùng bản đã lưu và cập nhật nền.
   Đổi PHIEN_BAN khi thêm/bớt file trong DANH_SACH để người dùng nhận bộ nhớ đệm mới. */
const TIEN_TO = 'luyenthi-';          // chỉ bộ nhớ đệm có tiền tố này là của app: các web khác cùng địa chỉ dùng chung CacheStorage
const PHIEN_BAN = TIEN_TO + 'v4';
const DANH_SACH = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const TAI_SAN = [          // tải sẵn lúc cài để công thức toán vẫn hiện khi offline
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css',
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap'
];
const MAY_CHU_NGOAI = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const kho = await caches.open(PHIEN_BAN);
    await kho.addAll(DANH_SACH);
    // phải tải kiểu CORS (mặc định): cache.add() luôn từ chối phản hồi "opaque" của kiểu no-cors
    await Promise.all(TAI_SAN.map(u => kho.add(u).catch(() => { /* không có mạng thì thôi */ })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(k => k.startsWith(TIEN_TO) && k !== PHIEN_BAN).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Trả phản hồi cho trang ngay, còn việc ghi vào bộ nhớ đệm được giữ bằng waitUntil để trình duyệt không tắt service worker giữa chừng
const luuNeuDuoc = (ev, req, res) => {
  if (res && res.ok) { const ban = res.clone(); ev.waitUntil(caches.open(PHIEN_BAN).then(k => k.put(req, ban)).catch(() => {})); }
  return res;
};

// Thẻ <script>/<link> gọi CDN kiểu no-cors cho phản hồi "opaque", không đọc được mã trạng thái nên bản lỗi (404, 503) có thể ghi đè bản tốt.
// Vì vậy service worker tự tải kiểu CORS (các máy chủ trong MAY_CHU_NGOAI đều cho phép) rồi chỉ lưu khi tải thành công.
const taiTuCdn = req => fetch(req.url, { mode: 'cors', credentials: 'omit' });

// chỉ tìm trong bộ nhớ đệm của app, không lấy nhầm bản của web khác cùng địa chỉ
const timDaLuu = (req, tuyChon) => caches.match(req, { ...tuyChon, cacheName: PHIEN_BAN });

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    ev.respondWith(fetch(req).then(res => luuNeuDuoc(ev, req, res)).catch(async () =>
      (await timDaLuu(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await timDaLuu('./index.html') : Response.error())));
  } else if (MAY_CHU_NGOAI.includes(url.hostname)) {
    ev.respondWith(timDaLuu(req).then(daLuu => {
      const moi = taiTuCdn(req).then(res => luuNeuDuoc(ev, req, res)).catch(() => daLuu || Response.error());
      ev.waitUntil(moi);
      return daLuu || moi;
    }));
  }
});
