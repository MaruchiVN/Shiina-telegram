const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(env = {}) {
  const handlers = { commands: {}, actions: {} };
  const downloads = [];
  class Bot {
    use(fn) { handlers.middleware = fn; }
    start(fn) { handlers.start = fn; }
    action(name, fn) { handlers.actions[name] = fn; } catch() {} stop() {}
    command(name, fn) { handlers.commands[name] = fn; }
    on(_, fn) { handlers.text = fn; }
    launch() { return Promise.resolve(); }
  }
  vm.runInNewContext(fs.readFileSync(require.resolve('./index'), 'utf8'), {
    require: (name) => name === 'telegraf' ? { Telegraf: Bot } :
      name === 'dotenv' ? { config() {} } : name === './tiktok' ? {
        extractTikTokUrl: require('./tiktok').extractTikTokUrl,
        sendTikTok: async (_, url) => downloads.push(url),
      } : require(name),
    process: { env, once() {}, exit() {} }, console: { log() {}, error() {} },
    fetch: async () => ({ok: true, json: async () => ({name: 'pikachu', id: 25, main: {temp: 28}, weather: [{description: 'trời quang'}],
      types: [{type: {name: 'electric'}}], sprites: {}})}),
  });
  const replies = [];
  const ctx = {from: {id: 1}, chat: {id: 1, type: 'private'},
    message: {text: 'hello', date: Math.floor(Date.now() / 1000)},
    answerCbQuery: async () => {},
    reply: async (text) => replies.push(text)};
  return {handlers, ctx, replies, downloads};
}

test('weather command switches from TikTok, searches and keeps weather mode active', async () => {
  const {handlers, ctx, replies, downloads} = setup({OPENWEATHER_API_KEY: 'test-key'});
  await handlers.actions.tiktok(ctx);
  ctx.message.text = '/weather@ShiinaBot Hà Nội';
  await handlers.commands.weather(ctx);
  assert.match(replies.at(-1), /28°C/);
  ctx.message.text = 'Đà Nẵng';
  await handlers.text(ctx);
  assert.match(replies.at(-1), /28°C/);
  ctx.message.text = 'https://vt.tiktok.com/test/';
  await handlers.text(ctx);
  assert.equal(downloads.length, 0);
  ctx.message.text = '/weather';
  await handlers.commands.weather(ctx);
  assert.match(replies.at(-1), /Đã chọn Thời tiết/);
});

test('TikTok links only download in TikTok mode after switching modes', async () => {
  const {handlers, ctx, downloads} = setup();
  const link = 'https://vt.tiktok.com/test/';
  ctx.message.text = link;
  await handlers.text(ctx);
  assert.equal(downloads.length, 0);
  await handlers.actions.tiktok(ctx);
  await handlers.text(ctx);
  assert.equal(downloads.length, 1);
  ctx.message.text = '/pokedex';
  await handlers.commands.pokedex(ctx);
  ctx.message.text = link;
  await handlers.text(ctx);
  assert.equal(downloads.length, 1);
  await handlers.actions.tiktok(ctx);
  await handlers.actions.pokedex(ctx);
  await handlers.text(ctx);
  assert.equal(downloads.length, 1);
  await handlers.actions.tiktok(ctx);
  await handlers.actions.weather(ctx);
  await handlers.text(ctx);
  assert.equal(downloads.length, 1);
  ctx.message.text = '/tiktok ' + link;
  await handlers.commands.tiktok(ctx);
  assert.equal(downloads.length, 2);
  await handlers.start(ctx);
  ctx.message.text = link;
  await handlers.text(ctx);
  assert.equal(downloads.length, 2);
});

test('does not spam menu reminders or reply to group chatter', async () => {
  const {handlers, ctx, replies} = setup();
  for (let i = 0; i < 10; i++) await handlers.text(ctx);
  assert.equal(replies.length, 1);
  ctx.chat = {id: 2, type: 'group'};
  await handlers.text(ctx);
  assert.equal(replies.length, 1);
});

test('start suppresses reminders and ignores old updates and bots', async () => {
  const {handlers, ctx, replies} = setup();
  await handlers.start(ctx);
  await handlers.text(ctx);
  assert.equal(replies.length, 1);
  let processed = 0;
  ctx.message.date -= 3600;
  await handlers.middleware(ctx, () => processed++);
  assert.equal(processed, 0);
  ctx.message.date = Math.floor(Date.now() / 1000);
  ctx.from.is_bot = true;
  await handlers.middleware(ctx, () => processed++);
  assert.equal(processed, 0);
  ctx.from.is_bot = false;
  await handlers.middleware(ctx, () => processed++);
  assert.equal(processed, 1);
});

test('pokedex command still searches and keeps the mode active', async () => {
  const {handlers, ctx, replies} = setup();
  ctx.message.text = '/pokedex@ShiinaBot pikachu';
  await handlers.commands.pokedex(ctx);
  ctx.message.text = 'pikachu';
  await handlers.text(ctx);
  assert.equal(replies.length, 2);
  for (const reply of replies) assert.match(reply, /Tên: pikachu/);
});
