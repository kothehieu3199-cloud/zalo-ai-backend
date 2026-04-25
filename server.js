import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3001;

const API_KEYS = (process.env.GEMINI_API_KEYS || "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);

const TARGET_MODELS = [
  "gemini-2.5-flash"
];

const TIMEOUT_MS = 20000;

// chống spam đơn giản
const requestMap = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  const data = requestMap.get(ip) || { count: 0, start: now };

  if (now - data.start > windowMs) {
    data.count = 0;
    data.start = now;
  }

  data.count += 1;
  requestMap.set(ip, data);

  if (data.count > maxRequests) {
    return res.status(429).json({
      error: "Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau."
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.send("Backend OK");
});

app.post("/analyze", rateLimit, async (req, res) => {
  try {
    if (API_KEYS.length === 0) {
      return res.status(500).json({
        error: "Server chưa cấu hình GEMINI_API_KEYS."
      });
    }

    const { chatText } = req.body;

    if (!chatText || chatText.trim().length < 5) {
      return res.status(400).json({
        error: "Không có nội dung hội thoại để phân tích."
      });
    }

    const safeChatText = chatText.slice(-8000);

    const prompt = `
Bạn là "Sworld Sense" - AI Sales Closer Coach cho nhân viên tư vấn của Sworld.

Dữ liệu hội thoại:
- SALE: tin nhắn của nhân viên đang dùng extension
- KHACH: tin nhắn của khách hàng

QUY TẮC:
- Chỉ phân tích tâm lý, DISC, intent dựa trên KHACH.
- SALE chỉ dùng để hiểu bối cảnh và học giọng văn.
- Không bịa thông tin sản phẩm, giá, ưu đãi, lịch học.
- Nếu chưa đủ dữ kiện, ghi [Chưa xác minh] hoặc [Suy đoán].
- Mỗi gợi ý phải giúp sale điều khiển hội thoại sang bước tiếp theo.
- Tin nhắn gợi ý giống style SALE khoảng 80%, nhưng mượt và sắc hơn.
- Không viết dài. Mỗi tin nhắn tối đa 3 đoạn ngắn.

Hội thoại:
${safeChatText}

Trả lời đúng format:

## 1. Chẩn đoán nhanh
- Cảm xúc khách:
- DISC:
- Intent chính:
- Intent ẩn:
- Nhiệt độ khách:
- Rào cản chính:
- Next best action:

## 2. Insight sale cần chú ý
-

## 3. Phong cách SALE đã học
- Cách xưng hô:
- Độ dài câu:
- Mức thân mật:
- Dấu hiệu phong cách:

## 4. Chiến thuật nên dùng
-

## 5. Tin nhắn gợi ý

### Phương án 1 - Mở nhu cầu nhẹ:
Mục tiêu:
Tin nhắn:

### Phương án 2 - Dẫn dắt sang bước tiếp theo:
Mục tiêu:
Tin nhắn:

### Phương án 3 - Ngắn gọn giống style sale:
Mục tiêu:
Tin nhắn:

## 6. Điều cần tránh
-
`;

    let lastError = "";

    for (const model of TARGET_MODELS) {
      for (const key of API_KEYS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          console.log("Calling model:", model);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: prompt }]
                  }
                ],
                generationConfig: {
                  temperature: 0.4
                }
              })
            }
          );

          clearTimeout(timeout);

          const data = await response.json();

          if (!response.ok) {
            lastError = `${model} HTTP ${response.status}: ${JSON.stringify(data?.error || data)}`;
            console.log("Gemini error:", lastError);
            continue;
          }

          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (text) {
            return res.json({
              result: text,
              model
            });
          }

          lastError = `${model}: Không có text trả về`;
        } catch (err) {
          clearTimeout(timeout);

          if (err.name === "AbortError") {
            lastError = `${model}: Request timeout`;
          } else {
            lastError = err.message;
          }

          console.log("Request error:", lastError);
        }
      }
    }

    return res.status(500).json({
      error: "Tất cả model/API key đều lỗi: " + lastError
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({
      error: "Lỗi server backend."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server chạy port ${PORT}`);
});