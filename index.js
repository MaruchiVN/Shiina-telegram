require("dotenv").config();
const { distance } = require("fastest-levenshtein");
const { Telegraf } = require("telegraf");
const { extractTikTokUrl, sendTikTok } = require("./tiktok");

const bot = new Telegraf(process.env.BOT_TOKEN);
const startedAt = Math.floor(Date.now() / 1000);
const menuReminders = new Map();

bot.use(async (ctx, next) => {
  if (ctx.from?.is_bot) return;
  // Do not answer a backlog of messages sent before this process started.
  if (ctx.message?.date && ctx.message.date < startedAt - 30) return;
  return next();
});

const weatherUsers = new Set();
const pokedexUsers = new Set();
const tiktokUsers = new Set();

bot.start(async (ctx) => {
  menuReminders.set(`${ctx.chat.id}:${ctx.from.id}`, Date.now());
  
  weatherUsers.delete(ctx.from.id);
  pokedexUsers.delete(ctx.from.id);
  tiktokUsers.delete(ctx.from.id);

  await ctx.reply("Chào cậu, tớ là Shiina! Cậu muốn dùng chức năng nào?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌤 Thời tiết", callback_data: "weather" }],
        [{ text: "📖 Pokédex", callback_data: "pokedex" }],
        [{ text: "🎬 TikTok không logo", callback_data: "tiktok" }],
      ],
    },
  });
});

bot.action("weather", async (ctx) => {
  tiktokUsers.delete(ctx.from.id);
  pokedexUsers.delete(ctx.from.id);
  weatherUsers.add(ctx.from.id);

  await ctx.answerCbQuery();
  await ctx.reply("🌤 Đã chọn Thời tiết. Cậu gửi tên thành phố nhé.");
});

bot.command("weather", async (ctx) => {
  tiktokUsers.delete(ctx.from.id);
  pokedexUsers.delete(ctx.from.id);
  weatherUsers.add(ctx.from.id);

  const city = ctx.message.text.replace(/^\/weather(?:@\w+)?\b/i, "").trim();
  if (!city) {
    return ctx.reply("🌤 Đã chọn Thời tiết. Cậu gửi tên thành phố nhé, ví dụ: /weather Hà Nội.");
  }
  return lookupWeather(ctx, city);
});

bot.action("pokedex", async (ctx) => {
  tiktokUsers.delete(ctx.from.id);
  weatherUsers.delete(ctx.from.id);
  pokedexUsers.add(ctx.from.id);

  await ctx.answerCbQuery();
  await ctx.reply("📖 Đã chọn Pokédex. Cậu gửi tên Pokémon nhé.");
});

bot.command("pokedex", async (ctx) => {
  tiktokUsers.delete(ctx.from.id);
  weatherUsers.delete(ctx.from.id);
  pokedexUsers.add(ctx.from.id);

  const name = ctx.message.text.replace(/^\/pokedex(?:@\w+)?\b/i, "").trim();
  if (!name) {
    return ctx.reply("📖 Đã chọn Pokédex. Cậu gửi tên Pokémon nhé, ví dụ: /pokedex pikachu.");
  }
  return lookupPokemon(ctx, name);
});
  
bot.action("tiktok", async (ctx) => {
  weatherUsers.delete(ctx.from.id);
  pokedexUsers.delete(ctx.from.id);
  tiktokUsers.add(ctx.from.id);
  await ctx.answerCbQuery();
  await ctx.reply("🎬 Cậu gửi link video TikTok công khai nhé (hỗ trợ cả link rút gọn vm.tiktok.com và vt.tiktok.com).");
});

bot.command("tiktok", async (ctx) => {
  weatherUsers.delete(ctx.from.id);
  pokedexUsers.delete(ctx.from.id);
  tiktokUsers.add(ctx.from.id);
  const url = extractTikTokUrl(ctx.message.text);
  return url ? sendTikTok(ctx, url) : ctx.reply("Cậu gửi link video TikTok công khai nhé.");
});

bot.action(/^pokemon:(.+)$/, async (ctx) => {
  const name = ctx.match[1];

  console.log("Đã bấm nút Pokémon:", name);
  await ctx.answerCbQuery("Đang tìm Pokémon...");

  const url =
    `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`;

  const response = await fetch(url);
  console.log("PokéAPI status:", response.status);

  if (!response.ok) {
    return ctx.reply("Không lấy được thông tin Pokémon. Anh thử lại nhé.");
  }

  const pokemon = await response.json();
  const types = pokemon.types
    .map((entry) => entry.type.name)
    .join(", ");

  const caption =
    `Tên: ${pokemon.name}\n` +
    `Hệ: ${types}\n` +
    `Số thứ tự: #${pokemon.id}`;

  const imageUrl = pokemon.sprites.front_default;

  if (imageUrl) {
    return ctx.replyWithPhoto(imageUrl, { caption });
  }

  return ctx.reply(caption);
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  if (tiktokUsers.has(userId)) {
    const tiktokUrl = extractTikTokUrl(text);
    if (tiktokUrl) return sendTikTok(ctx, tiktokUrl);
    return ctx.reply("Cậu gửi link https://www.tiktok.com/… hoặc link rút gọn TikTok hợp lệ nhé.");
  }

  
  if (pokedexUsers.has(userId)) {
  return lookupPokemon(ctx, text);
}

  if (weatherUsers.has(userId)) {
    return lookupWeather(ctx, text);
  }

  if (ctx.chat.type !== "private" || text.startsWith("/")) return;
  const reminderKey = `${ctx.chat.id}:${userId}`;
  const now = Date.now();
  if (now - (menuReminders.get(reminderKey) || 0) < 60_000) return;
  if (menuReminders.size >= 5000) menuReminders.clear();
  menuReminders.set(reminderKey, now);
  return ctx.reply("Cậu hãy gửi /start rồi chọn Thời tiết, Pokédex hoặc TikTok nhé.");
});

async function lookupWeather(ctx, city) {
    if (!process.env.OPENWEATHER_API_KEY) {
      return ctx.reply("Chưa cài OPENWEATHER_API_KEY trong file .env.");
    }

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(city)}` +
      `&appid=${process.env.OPENWEATHER_API_KEY}` +
      `&units=metric` +
      `&lang=vi`;

    const response = await fetch(url);

    if (!response.ok) {
      return ctx.reply("Không tìm thấy thành phố đó. Cậu kiểm tra lại tên nhé.");
    }

    const data = await response.json();

    return ctx.reply(
      `Thời tiết ở ${data.name}: ${data.main.temp}°C, ` +
      `${data.weather[0].description}`
    );
}

async function lookupPokemon(ctx, query) {
  const name = query.trim().toLowerCase();

  // check tên
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`
  );

  if (response.ok) {
    const pokemon = await response.json();
    const types = pokemon.types
      .map((entry) => entry.type.name)
      .join(", ");

    const caption =
      `Tên: ${pokemon.name}\n` +
      `Hệ: ${types}\n` +
      `Số thứ tự: #${pokemon.id}`;

    const imageUrl = pokemon.sprites.front_default;

    if (imageUrl) {
      return ctx.replyWithPhoto(imageUrl, { caption });
    }

    return ctx.reply(caption);
  }

  const listResponse = await fetch(
    "https://pokeapi.co/api/v2/pokemon?limit=2000"
  );

  if (!listResponse.ok) {
    return ctx.reply("Chưa lấy được danh sách Pokémon. Cậu thử lại nhé.");
  }

  const listData = await listResponse.json();
  const suggestions = listData.results
    .map((pokemon) => ({
      name: pokemon.name,
      distance: distance(name, pokemon.name),
    }))
    .filter((pokemon) => pokemon.distance <= 2)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  if (suggestions.length === 0) {
  return ctx.reply("Không tìm thấy tên gần giống. Cậu nhập lại tên nhé.");
}

return ctx.reply("Ý cậu là Pokémon nào ạ?", {
  reply_markup: {
    inline_keyboard: suggestions.map((pokemon) => [
      {
        text: pokemon.name,
        callback_data: `pokemon:${pokemon.name}`,
      },
    ]),
  },
});
}

bot.catch((err, ctx) => {
  console.error(`Lỗi khi xử lý cập nhật ${ctx.update.update_id}:`, err);
});

bot.launch()
  .then(() => console.log("LeicaTestBot đang chạy. Nhấn Ctrl+C để dừng."))
  .catch((err) => {
    console.error("Không khởi động được bot:", err.message);
    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
