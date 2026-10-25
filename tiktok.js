const { mkdtemp, rm, open } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

const MAX_VIDEO_BYTES = 49 * 1024 * 1024;
const busy = new Set();

async function resolveTikWM(url, fetchImpl = fetch) {
  const response = await fetchImpl('https://www.tikwm.com/api/', {
    method: 'POST',
    body: new URLSearchParams({ url, hd: '1' }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`TikWM HTTP ${response.status}`);
  const result = await response.json();
  if (result.code !== 0 || !result.data) throw new Error(`TikWM: ${String(result.msg || 'không có dữ liệu').slice(0, 200)}`);
  const data = result.data;
  if (data.images?.length) throw new Error('Bài ảnh chưa được hỗ trợ. Cậu gửi link video nhé.');
  // TikWM separates no-watermark play/hdplay from wmplay. Never use wmplay.
  const media = data.hdplay || data.play;
  if (!media) throw new Error('TikWM không trả về bản video không logo.');
  const mediaUrl = new URL(media, 'https://www.tikwm.com');
  if (mediaUrl.protocol !== 'https:') throw new Error('Địa chỉ video không hợp lệ.');
  return { video: { url: mediaUrl.href }, title: data.title };
}

let lazyUnavailableUntil = 0;
async function resolveVideo(url, directory) {
  try {
    return await resolveTikWM(url);
  } catch (error) {
    if (/Bài ảnh/.test(error.message)) throw error;
    console.error('TikWM lookup failed:', error.message);
    if (Date.now() < lazyUnavailableUntil) throw error;
    try {
      const { DownloadWorker } = await import('lazy-downloader');
      const worker = new DownloadWorker({ onlyUrl: true, allMedias: true, printJson: false,
        timeoutSec: 30, maxRetries: 1 });
      const result = await worker.download(url, directory);
      const video = selectVideo(result.medias);
      if (!video) throw new Error('J2Download không trả về bản video không logo được xác nhận.');
      return { video, title: result.json?.title };
    } catch (fallbackError) {
      if (/404|bootstrap/i.test(fallbackError.message)) lazyUnavailableUntil = Date.now() + 10 * 60_000;
      console.error('J2Download fallback failed:', fallbackError.message.slice(0, 250));
      throw new Error('Dịch vụ lấy video đang lỗi hoặc không xử lý được link này. Cậu thử lại sau nhé.');
    }
  }
}

function extractTikTokUrl(text) {
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    try {
      const url = new URL(match[0].replace(/[)\],.!?]+$/, ''));
      if (url.protocol === 'https:' && !url.username && !url.password &&
          !url.port && (url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com'))) {
        return url.href;
      }
    } catch {}
  }
  return null;
}

function selectVideo(medias = []) {
  return medias.find((media) => {
    const label = String(media.quality || '').toLowerCase().replace(/[_-]/g, ' ');
    return (media.type === 'video' || media.extension === 'mp4') &&
      /no\s*watermark|without\s*watermark|không\s*logo|khong\s*logo/.test(label) &&
      !/with\s+watermark/.test(label);
  });
}

async function saveVideo(url, destination, fetchImpl = fetch) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok || !response.body) throw new Error('Không tải được video từ máy chủ.');
  const reader = response.body.getReader();
  let file;
  try {
    if (Number(response.headers.get('content-length')) > MAX_VIDEO_BYTES) {
      throw new Error('Video quá lớn để gửi qua Telegram (tối đa 49 MB).');
    }
    const contentType = response.headers.get('content-type') || '';
    if (/text\/|application\/json/i.test(contentType)) throw new Error('Máy chủ không trả về video.');
    file = await open(destination, 'w');
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_VIDEO_BYTES) throw new Error('Video quá lớn để gửi qua Telegram (tối đa 49 MB).');
      await file.writeFile(value);
    }
    if (!size) throw new Error('Video tải về bị trống.');
  } finally {
    await reader.cancel().catch(() => {});
    if (file) await file.close();
  }
}

async function sendTikTok(ctx, url) {
  const key = ctx.from.id;
  if (busy.has(key)) return ctx.reply('Cậu chờ video trước tải xong rồi gửi tiếp nhé.');
  if (busy.size >= 2) return ctx.reply('Bot đang bận tải video. Cậu thử lại sau một chút nhé.');
  busy.add(key);
  let directory;
  try {
    await ctx.reply('⏳ Đang tìm video TikTok không logo, cậu chờ một chút nhé…');
    directory = await mkdtemp(path.join(tmpdir(), 'shiina-tiktok-'));
    const { video, title } = await resolveVideo(url, directory);
    const destination = path.join(directory, 'tiktok.mp4');
    await saveVideo(video.url, destination);
    await ctx.replyWithVideo({ source: destination }, {
      caption: String(title || 'Video TikTok không logo').slice(0, 900),
      supports_streaming: true,
    });
  } catch (error) {
    console.error('TikTok download failed:', error.message);
    const message = error.message || '';
    if (error.on?.method === 'sendVideo') {
      await ctx.reply('Video đã tải về nhưng gửi qua Telegram thất bại. Cậu thử lại sau nhé.');
    } else {
      await ctx.reply(/quá lớn|Bài ảnh|Dịch vụ lấy video/.test(message) ? message :
        'Không tải được video từ dịch vụ tải. Cậu thử lại sau hoặc thử link video khác nhé.');
    }
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      busy.delete(key);
    }
  }
}

module.exports = { extractTikTokUrl, selectVideo, saveVideo, sendTikTok, resolveTikWM, MAX_VIDEO_BYTES };
