import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const API_KEYS = (process.env.GEMINI_API_KEYS || "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);

const TARGET_MODELS = [
  "gemini-2.5-flash"
  // Nếu key của bạn dùng được Gemini 3 thì đổi thành:
  // "gemini-3-flash-preview"
];

app.get("/", (req, res) => {
  res.send("Backend OK");
});

app.post("/analyze", async (req, res) => {
  try {
    if (API_KEYS.length === 0) {
      return res.status(500).json({
        error: "Chưa cấu hình GEMINI_API_KEYS trên server."
      });
    }

    const { chatText } = req.body;

    if (!chatText || chatText.trim().length < 5) {
      return res.status(400).json({
        error: "Không có nội dung hội thoại để phân tích."
      });
    }

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
${chatText}

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
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
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

          const data = await response.json();

          if (!response.ok) {
            lastError = `${model} HTTP ${response.status}: ${JSON.stringify(data)}`;
            continue;
          }

          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (text) {
            return res.json({ result: text });
          }

          lastError = `${model}: Không có text trả về`;
        } catch (err) {
          lastError = err.message;
        }
      }
    }

    return res.status(500).json({
      error: "Tất cả model/API key đều lỗi: " + lastError
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Lỗi server backend."
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server chạy port ${PORT}`);
});