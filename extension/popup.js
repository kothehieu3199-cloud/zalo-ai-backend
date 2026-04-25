function renderResult(text) {
  const resultBox = document.getElementById("result");

  const clean = text
    .replaceAll("##", "")
    .replaceAll("**", "")
    .trim();

  const sections = clean.split(/\n(?=\d\.|Phương án|###)/g);

  let html = "";

  sections.forEach((section) => {
    const lines = section.trim().split("\n");
    const title = lines[0] || "";
    const body = lines.slice(1).join("\n");

    if (!title.trim()) return;

    const isSuggestion = title.toLowerCase().includes("phương án");

    html += `
      <div class="${isSuggestion ? "suggestion" : "box"}">
        <div class="section-title">${title}</div>
        <div class="content">${body || ""}</div>
      </div>
    `;
  });

  resultBox.innerHTML = html || `<div class="content">${clean}</div>`;
}

document.getElementById("btn").onclick = async () => {
  const resultBox = document.getElementById("result");
  resultBox.innerHTML = `<div class="loading">Đang phân tích...</div>`;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });

  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, { type: "GET_CHAT" }, async (res) => {
      if (!res || !res.chatText) {
        resultBox.innerHTML = `<div class="content">Không đọc được nội dung chat.</div>`;
        return;
      }

      const api = await fetch("https://zalo-ai-backend.onrender.com/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatText: res.chatText,
        }),
      });

      const data = await api.json();

      if (data.result) {
        renderResult(data.result);
      } else {
        resultBox.innerHTML = `<div class="content">${data.error || "Không có kết quả."}</div>`;
      }
    });
  }, 500);
};