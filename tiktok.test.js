const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractTikTokUrl, selectVideo, saveVideo, MAX_VIDEO_BYTES } = require('./tiktok');
const { resolveTikWM } = require('./tiktok');

test('TikWM selects no-watermark media instead of wmplay', async () => {
  const result = await resolveTikWM('https://vt.tiktok.com/test', async () => new Response(JSON.stringify({
    code: 0, data: { title: 'test', play: '/video.mp4', wmplay: '/watermark.mp4' },
  })));
  assert.equal(result.video.url, 'https://www.tikwm.com/video.mp4');
  await assert.rejects(resolveTikWM('unused', async () => new Response(JSON.stringify({
    code: 0, data: { wmplay: '/watermark.mp4' },
  }))), /không trả về/);
});

test('TikWM reports API errors and photo posts', async () => {
  await assert.rejects(resolveTikWM('unused', async () => new Response('error', {status: 503})), /HTTP 503/);
  await assert.rejects(resolveTikWM('unused', async () => new Response(JSON.stringify({code: -1, msg: 'busy'}))), /busy/);
  await assert.rejects(resolveTikWM('unused', async () => new Response(JSON.stringify({code: 0, data: {images: ['image']}}))), /Bài ảnh/);
});

test('accepts shared TikTok links and rejects lookalike hosts', () => {
  assert.equal(extractTikTokUrl('Xem https://vt.tiktok.com/abc/ nhé'), 'https://vt.tiktok.com/abc/');
  for (const url of ['https://tiktok.com.evil.test/x', 'https://eviltiktok.com/x',
    'https://tiktok.com@evil.test/x', 'http://tiktok.com/x']) assert.equal(extractTikTokUrl(url), null);
});

test('requires an explicit no-watermark video label', () => {
  const good = { type: 'video', quality: 'HD No Watermark' };
  assert.equal(selectVideo([{ type: 'video', quality: 'with watermark' }, good]), good);
  assert.equal(selectVideo([{ type: 'video', quality: 'HD' }]), undefined);
  assert.equal(selectVideo([{ type: 'image', quality: 'no watermark' }]), undefined);
});

test('rejects oversized responses and server error pages', async () => {
  await assert.rejects(saveVideo('unused', 'unused', async () => new Response('', {
    headers: { 'content-length': String(MAX_VIDEO_BYTES + 1) },
  })), /quá lớn/);
  await assert.rejects(saveVideo('unused', 'unused', async () => new Response('error', {
    headers: { 'content-type': 'text/html' },
  })), /không trả về video/);
});
