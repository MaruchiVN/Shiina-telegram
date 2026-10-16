require("dotenv").config();
const { distance } = require("fastest-levenshtein");
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

const weatherUsers = new Set();
const pokedexUsers = new Set();

bot.start(async (ctx) => {
  
  weatherUsers.delete(ctx.from.id);
  pokedexUsers.delete(ctx.from.id);

  await ctx.reply("Chào cậu, tớ là Shiina! Cậu muốn dùng chức năng nào?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌤 Thời tiết", callback_data: "weather" }],
        [{ text: "📖 Pokédex", callback_data: "pokedex" }],
      ],
    },
  });
});

bot.action("weather", async (ctx) => {
  pokedexUsers.delete(ctx.from.id);
  weatherUsers.add(ctx.from.id);

  await ctx.answerCbQuery();
  await ctx.reply("🌤 Đã chọn Thời tiết. Cậu gửi tên thành phố nhé.");
});

bot.action("pokedex", async (ctx) => {
  weatherUsers.delete(ctx.from.id);
  pokedexUsers.add(ctx.from.id);

  await ctx.answerCbQuery();
  await ctx.reply("📖 Đã chọn Pokédex. Cậu gửi tên Pokémon nhé.");
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

  
  if (pokedexUsers.has(userId)) {
  const name = text.toLowerCase();

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

  // sai tên
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
  return ctx.reply("Không tìm thấy tên gần giống. Anh nhập lại tên nhé.");
}

return ctx.reply("Ý anh là Pokémon nào ạ?", {
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

  if (weatherUsers.has(userId)) {
    if (!process.env.OPENWEATHER_API_KEY) {
      return ctx.reply("Chưa cài OPENWEATHER_API_KEY trong file .env.");
    }

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(text)}` +
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

  return ctx.reply("Cậu hãy gửi /start rồi chọn Thời tiết hoặc Pokédex nhé.");
});

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