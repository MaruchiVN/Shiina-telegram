# Shiina Telegram Bot

Bot Telegram hỗ trợ tra cứu thời tiết, tìm thông tin Pokémon và tải video TikTok không logo.

## Yêu cầu

- Node.js 20 trở lên
- Token bot Telegram từ [@BotFather](https://t.me/BotFather)
- API key OpenWeatherMap nếu muốn dùng chức năng thời tiết

## Cài đặt và chạy

```powershell
npm install
npx playwright install chromium
```

Tạo file `.env` từ `.env.example`, sau đó điền cấu hình:

```env
BOT_TOKEN=token bot tele
OPENWEATHER_API_KEY=api openweather
```

`OPENWEATHER_API_KEY` là tùy chọn nếu không dùng chức năng thời tiết. Không leak hoặc commit file `.env`.

Khởi động bot:

```powershell
npm start
```

## Pokedex

Gửi `/start` và chọn **Pokedex**, rồi gửi tên Pokémon. Có thể tìm trực tiếp bằng lệnh:

```text
/pokedex pikachu
```

Nếu không tìm thấy tên, bot sẽ gợi ý tối đa ba Pokémon có tên gần giống.

## Weather

Gửi `/start` và chọn **Thời tiết**, rồi gửi tên thành phố. Hoặc tra cứu trực tiếp:

```text
/weather Hà Nội
```

Chức năng này yêu cầu `OPENWEATHER_API_KEY` trong file `.env`.

## TikTok

Gửi `/start` và chọn **TikTok không logo**, sau đó gửi link video công khai. Cũng có thể dùng lệnh:

```text
/tiktok https://www.tiktok.com/...
```

Hỗ trợ link TikTok trực tiếp và link rút gọn `vm.tiktok.com`, `vt.tiktok.com`. Bot chỉ hỗ trợ video (không hỗ trợ bài ảnh) có dung lượng tối đa **49 MB**; mỗi người chỉ tải một video cùng lúc và toàn bot xử lý tối đa hai lượt đồng thời. File tạm được xóa sau khi gửi hoặc khi xảy ra lỗi.

Nguồn tải chính là [TikWM](https://www.tikwm.com/api/). Nguồn dự phòng là [Lazy-downloader](https://github.com/tranhaonguyendev/Lazy-downloader), cần Chromium và phụ thuộc J2Download. Nếu API dự phòng trả lỗi 404, bot tạm ngừng sử dụng nguồn đó trong 10 phút. Không cần API key TikTok.

Bot chỉ gửi video khi dịch vụ xác nhận bản không watermark; nếu không xác định được, bot sẽ báo lỗi thay vì gửi bản có watermark.

## Lệnh và chế độ sử dụng

| Lệnh | Chức năng |
| --- | --- |
| `/start` | Hiện menu chọn chức năng và xóa chế độ hiện tại |
| `/pokedex <tên>` | Tìm Pokemon |
| `/weather <thành phố>` | Tra cứu thời tiết |
| `/tiktok <link>` | Tải video TikTok |

Sau khi chọn Pokédex, Thời tiết hoặc TikTok từ menu, có thể gửi nội dung cần tìm mà không cần nhập lại lệnh. Chọn một chức năng sẽ tắt chế độ của chức năng trước đó. Sau khi bot khởi động lại, gửi `/start` hoặc `/pokedex` để chọn lại chế độ.

Trong chat riêng, bot nhắc gửi `/start` tối đa một lần mỗi phút. Bot không gửi lời nhắc này trong nhóm và bỏ qua tin nhắn cũ hơn 30 giây khi khởi động để tránh phản hồi hàng loạt.

## Kiểm thử

```powershell
npm test
```

Các bài kiểm thử không gọi Telegram hoặc dịch vụ tải video thực tế.
