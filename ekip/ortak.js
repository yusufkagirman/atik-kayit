// ETS ortak yardımcılar (lider + yönetim): kaçış, WhatsApp tarzı biçim, fotoğraf küçültme, ilerlemeli yükleme, video küçültme.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Biçim: *kalın*  _eğik_  ~çizili~  `kod`  "- " ile liste  ve bağlantılar. Önce kaçış, sonra işaretler: ham HTML hiçbir zaman girmez.
const URL_RE = /(https?:\/\/[^\s<]*[^\s<.,;:!?)])/;
const SOL = '(^|[\\s(>])', SAG = '(?=$|[\\s).,!?:;<])';
const BICIMLER = [['*', 'b'], ['_', 'i'], ['~', 's']].map(([c, e]) => [new RegExp(SOL + '\\' + c + '(?=\\S)([^\\' + c + '\\n]*?\\S)\\' + c + SAG, 'g'), `$1<${e}>$2</${e}>`]);
function bicimMetin(h) {
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/^(?:- |• )/gm, '• ');
  for (let i = 0; i < 2; i++) for (const [re, yer] of BICIMLER) h = h.replace(re, yer);   // iç içe (*_x_*) için iki tur
  return h;
}
const bicim = s => esc(s).split(URL_RE).map((p, i) => i % 2 ? `<a href="${p}" target="_blank" rel="noopener noreferrer">${p}</a>` : bicimMetin(p)).join('');
// Bildirim ve önizleme için işaretsiz düz metin
const duzMetin = s => String(s ?? '').replace(/(^|[\s(])[*_~]+(?=\S)/g, '$1').replace(/([^\s*_~])[*_~]+(?=$|[\s).,!?:;])/g, '$1').replace(/`/g, '');

// Fotoğraf: tarayıcıda 1600 px'e küçült (JPEG)
function kucultFoto(f, maks = 1600) {
  return new Promise((ok, red) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maks / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
      c.toBlob(b => b ? ok(b) : red(new Error('Fotoğraf okunamadı')), 'image/jpeg', .82);
    };
    img.onerror = () => red(new Error('Fotoğraf okunamadı')); img.src = URL.createObjectURL(f);
  });
}

// İlerlemeli yükleme (fetch yükleme ilerlemesi vermez). Dönen sözün .iptal() yöntemi vardır.
function xhrYukle(url, basliklar, govde, ilerle) {
  const x = new XMLHttpRequest();
  const p = new Promise((ok, red) => {
    x.open('POST', url);
    for (const [k, v] of Object.entries(basliklar)) x.setRequestHeader(k, v);
    x.upload.onprogress = e => e.lengthComputable && ilerle?.(e.loaded / e.total);
    x.onload = () => x.status < 300 ? ok() : red(new Error(x.status === 413 ? 'Dosya çok büyük.' : x.status === 400 || x.status === 403 ? 'Yükleme izni alınamadı, sayfayı yenileyip tekrar deneyiniz.' : 'Yükleme başarısız (' + x.status + ').'));
    x.onerror = () => red(new Error('Bağlantı koptu, tekrar deneyiniz.'));
    x.onabort = () => red(new Error('iptal'));
    x.send(govde);
  });
  p.iptal = () => x.abort();
  return p;
}

// Video küçültme (yalnız büyük dosyada): tarayıcıda 720p'ye çevirip yeniden kodlar. Gerçek zamanlı çalışır (1 dk video ≈ 1 dk).
async function videoKucult(f, ilerle, hedefBayt) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Bu tarayıcı videoyu küçültemiyor; daha kısa çekmeyi deneyiniz.');
  const url = URL.createObjectURL(f), v = document.createElement('video');
  v.playsInline = true; v.preload = 'auto'; v.src = url;
  let ac;
  try {
    await new Promise((ok, red) => { v.onloadedmetadata = ok; v.onerror = () => red(new Error('Video okunamadı.')); });
    if (!isFinite(v.duration)) {   // süre bilgisi olmayan (webm) dosyalarda sona sarıp gerçek süreyi öğren
      v.currentTime = 1e9; await new Promise(ok => { v.ontimeupdate = () => { v.ontimeupdate = null; ok(); }; setTimeout(ok, 3000); });
      v.currentTime = 0; await new Promise(ok => { v.onseeked = ok; setTimeout(ok, 1500); });
    }
    const sure = v.duration;
    if (!isFinite(sure) || sure <= 0) throw new Error('Video süresi okunamadı.');
    const olcek = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * olcek / 2) * 2, h = Math.round(v.videoHeight * olcek / 2) * 2;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), akim = cv.captureStream(30);
    try {   // ses: video öğesinden kayda yönlendirilir (hoparlöre gitmez)
      ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
      const hedef = ac.createMediaStreamDestination(); ac.createMediaElementSource(v).connect(hedef);
      hedef.stream.getAudioTracks().forEach(t => akim.addTrack(t));
    } catch {}
    const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('Bu tarayıcı videoyu küçültemiyor.');
    const bit = Math.max(3e5, Math.min(2.5e6, hedefBayt * 8 / sure * .85 - 96e3));
    const mr = new MediaRecorder(akim, {mimeType: mime, videoBitsPerSecond: bit, audioBitsPerSecond: 96e3}), parca = [];
    mr.ondataavailable = e => e.data.size && parca.push(e.data);
    const durdu = new Promise(ok => mr.onstop = ok), bitti = new Promise(ok => v.onended = ok);
    mr.start(1000);
    try { await v.play(); } catch { v.muted = true; await v.play(); }
    const ciz = () => { g.drawImage(v, 0, 0, w, h); ilerle?.(Math.min(1, v.currentTime / sure)); if (!v.ended) (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(ciz) : requestAnimationFrame(ciz)); };
    ciz(); await bitti; mr.stop(); await durdu;
    const blob = new Blob(parca, {type: mime.split(';')[0]});
    if (blob.size > hedefBayt * 1.15) throw new Error('Video küçültüldükten sonra da çok büyük; daha kısa bir video seçiniz.');
    return blob;
  } finally { URL.revokeObjectURL(url); ac?.close().catch(() => {}); }
}
