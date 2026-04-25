import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const API_KEYS = process.env.GEMINI_API_KEYS.split(",");

const TARGET_MODELS = [
  "gemini-3-flash-preview"
];

app.post("/analyze", async (req, res) => {
  try {
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

NGUYÊN TẮC BẮT BUỘC:
1. Chỉ phân tích tâm lý, DISC, intent dựa trên dòng "KHACH:".
2. Dòng "SALE:" chỉ dùng để hiểu bối cảnh và học giọng văn sale.
3. Không được suy diễn quá mức. Nếu chưa đủ dữ kiện, ghi rõ [Chưa xác minh] hoặc [Suy đoán].
4. Không bịa thông tin sản phẩm, giá, ưu đãi, lịch học, cam kết kết quả.
5. Không trả lời kiểu CSKH chung chung. Mỗi gợi ý phải có mục tiêu sale rõ ràng.
6. Mục tiêu không phải chỉ "trả lời khách", mà là điều khiển hội thoại sang bước tiếp theo.
7. Tin nhắn phải giống giọng văn SALE khoảng 80%, nhưng sắc hơn, mượt hơn, có định hướng chốt hơn.
8. Không viết quá dài. Mỗi tin nhắn gợi ý tối đa 3 đoạn ngắn.
9. Không ép khách, không thao túng, không gây áp lực sai sự thật.

CÁCH PHÂN TÍCH:
- Xác định cảm xúc khách: vui vẻ / trung lập / bối rối / gấp / nghi ngờ / so sánh / khó chịu.
- Dự đoán DISC: D / I / S / C. Nếu chưa đủ dữ kiện, ghi [Chưa xác minh].
- Xác định intent chính: khách đang làm gì ngay trong hội thoại.
- Xác định intent ẩn: khách thật sự có thể muốn gì đằng sau câu chữ.
- Đánh giá nhiệt độ khách: lạnh / ấm nhẹ / ấm / nóng / gần chốt.
- Xác định rào cản lớn nhất đang cản bước tiếp theo.
- Xác định "next best action": nên hỏi thêm, xác nhận, mở nhu cầu, xử lý nghi ngại, xin thông tin, đề xuất tư vấn, hay chốt nhẹ.

CÁCH GỢI Ý TIN NHẮN:
Áp dụng mô hình:
Validation → Pain Point nhẹ → Câu hỏi mở nhu cầu / Next step

Mỗi phương án phải có:
- Mục tiêu rõ ràng
- Tin nhắn có thể copy gửi ngay
- Không văn mẫu
- Tự nhiên như người thật
- Có "Dạ", "ạ", "em" nếu phù hợp style sale
- Ưu tiên mở nhu cầu và dẫn dắt khách sang bước tiếp theo

ĐIỀU CẤM:
- Không chỉ nói "em nhận được rồi ạ" rồi kết thúc.
- Không hỏi lan man.
- Không phân tích DISC chắc chắn khi dữ kiện yếu.
- Không bịa rằng khách có con, có nhu cầu học, muốn giảm giá... nếu chưa có dữ kiện.
- Không dùng ngôn ngữ quá robot như "liều thuốc đặc trị" trong tin nhắn gửi khách.
- Không đưa thông tin sản phẩm Sworld nếu hội thoại chưa cung cấp.

Hội thoại:
${chatText}

Trả lời theo format ngắn gọn, dễ đọc:

## 1. Chẩn đoán nhanh
- Cảm xúc khách:
- DISC:
- Intent chính:
- Intent ẩn:
- Nhiệt độ khách:
- Rào cản chính:
- Next best action:

## 2. Insight sale cần chú ý
Viết 2-3 gạch đầu dòng, tập trung vào điều giúp sale không làm chết hội thoại.

## 3. Phong cách SALE đã học
- Cách xưng hô:
- Độ dài câu:
- Mức thân mật:
- Dấu hiệu phong cách:

## 4. Chiến thuật nên dùng
Nêu rõ sale nên làm gì trong 1-2 bước tiếp theo.

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

    let finalText = null;
    let lastError = "";

    for (const model of TARGET_MODELS) {
      for (const key of API_KEYS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key.trim()}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: prompt
                      }
                    ]
                  }
                ],
                generationConfig: {
                  temperature: 0.4
                }
              })
            }
          );

          if (!response.ok) {
            lastError = `${model} HTTP ${response.status}`;
            continue;
          }

          const data = await response.json();

          finalText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

          if (finalText) {
            return res.json({ result: finalText });
          }
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

app.get("/", (req, res) => {
  res.send("Backend OK");
});

app.listen(3001, () => {
  console.log("Server chạy http://localhost:3001");
});