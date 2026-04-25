console.log("Zalo AI injected");

function getChatText() {
  const pageWidth = window.innerWidth;

  const elements = Array.from(document.querySelectorAll("div, span"));

  const messages = elements
    .map((el) => {
      const text = el.innerText?.trim();
      if (!text) return null;

      const rect = el.getBoundingClientRect();

      // chỉ lấy vùng chat chính, bỏ sidebar trái và popup extension
      if (rect.left < pageWidth * 0.28) return null;
      if (rect.right > pageWidth * 0.93) return null;

      if (rect.top < 180) return null;
      if (rect.height < 15) return null;
      if (text.length < 2 || text.length > 800) return null;

      // loại bỏ text hệ thống / menu
      const blacklist = [
        "Tìm kiếm",
        "Ưu tiên",
        "Phân loại",
        "Zalo",
        "Phân tích hội thoại",
        "Zalo AI Sales",
        "Đã nhận"
      ];

      if (blacklist.some((x) => text.includes(x))) return null;

      const role = rect.left > pageWidth * 0.58 ? "SALE" : "KHACH";

      return {
        role,
        text,
        top: rect.top,
        left: rect.left
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.top - b.top);

  const unique = [];
  const seen = new Set();

  for (const msg of messages) {
    const key = msg.role + ":" + msg.text;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(msg);
    }
  }

  return unique
    .slice(-20)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_CHAT") {
    const chatText = getChatText();
    sendResponse({ chatText });
  }
});