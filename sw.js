/* Service worker: giúp app mở được khi không có mạng.
   - File của app (cùng nguồn): ưu tiên mạng để luôn có bản mới nhất, mất mạng thì dùng bản đã lưu.
   - Thư viện và phông chữ từ CDN (KaTeX, SheetJS, pdf.js, mammoth, Google Fonts): dùng bản đã lưu và cập nhật nền.
   Đổi PHIEN_BAN khi thêm/bớt file trong DANH_SACH để người dùng nhận bộ nhớ đệm mới. */
const PHIEN_BAN = 'luyenthi-v3';
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
    await Promise.all(TAI_SAN.map(u => kho.add(new Request(u, { mode: 'no-cors' })).catch(() => { /* không có mạng thì thôi */ })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(k => k !== PHIEN_BAN).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const luuNeuDuoc = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) { const ban = res.clone(); caches.open(PHIEN_BAN).then(k => k.put(req, ban)).catch(() => {}); }
  return res;
};

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    ev.respondWith(fetch(req).then(res => luuNeuDuoc(req, res)).catch(async () =>
      (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await caches.match('./index.html') : Response.error())));
  } else if (MAY_CHU_NGOAI.includes(url.hostname)) {
    ev.respondWith(caches.match(req).then(daLuu => {
      const moi = fetch(req).then(res => luuNeuDuoc(req, res)).catch(() => daLuu || Response.error());
      ev.waitUntil(moi);
      return daLuu || moi;
    }));
  }
});
