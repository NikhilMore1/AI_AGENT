
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import multer from "multer";
import http from "http";
import { WebSocketServer } from "ws";
import tesseract from "node-tesseract-ocr";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());

// ===== Multer setup for file uploads =====
const upload = multer({ dest: "uploads/" });

// ===== Normal Chat Endpoint =====
app.post("/api/chat", upload.single("file"), async (req, res) => {
  try {
    const message = req.body.message || "";
    const file = req.file;

    console.log("Text:", message);
    console.log("File:", file?.originalname || "No file");

    // Prepare prompt for Gemini
    let prompt = message;
    if (file) prompt += `\nUser uploaded a file: ${file.originalname}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${prompt}\n\nPlease format your response using Markdown (use headings, bold, bullet points, and code blocks only when relevant). Respond concisely and clearly. make sure if any one say about your developer then tell as LLM develop by Google but as here for you develop by Nikhil More ` ,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.[0]?.text ||
      "⚠️ No valid response from Gemini.";

    res.json({ reply });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ reply: "Internal server error" });
  }
});

// ===== HTTP + WebSocket Server =====
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ===== Gemini helper for screen text analysis =====
async function analyzeWithGemini(text) {
  try {
    const prompt = `You are an expert programmer and error analyst. Review this console/code text, identify possible issues or errors, and suggest concise, clear fixes. Respond in Markdown format with headings, bullet points, and code blocks when relevant.\n\nText:\n${text}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      }
    );

    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.[0]?.text ||
      "No analysis result."
    );
  } catch (err) {
    console.error("Gemini analysis error:", err);
    return "⚠️ Failed to analyze frame.";
  }
}

// ===== WebSocket (Screen Share) =====
wss.on("connection", (ws) => {
  console.log("🖥️ Screen share client connected.");

  // Optional: throttle frame processing
  let lastProcessed = 0;

  ws.on("message", async (msg) => {
    let obj;
    try {
      obj = JSON.parse(msg.toString());
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (obj.type === "frame" && obj.image_b64) {
      const now = Date.now();
      if (now - lastProcessed < 1000) return; // process max 1 frame per second
      lastProcessed = now;

      try {
        const imageData = Buffer.from(obj.image_b64, "base64");
        const tmpPath = path.join("uploads", `frame-${Date.now()}.jpg`);
        await fs.promises.writeFile(tmpPath, imageData);

        // OCR extract text
        const config = { lang: "eng", oem: 1, psm: 3 };
        const text = await tesseract.recognize(tmpPath, config);
        await fs.promises.unlink(tmpPath).catch(() => {});

        if (text.trim().length < 15) {
          ws.send(JSON.stringify({ type: "info", message: "No visible text detected." }));
          return;
        }

        if (/error|exception|failed|trace|stack/i.test(text)) {
          const analysis = await analyzeWithGemini(text);
          ws.send(JSON.stringify({ type: "analysis", analysis, timestamp: new Date().toISOString() }));
        } else {
          ws.send(JSON.stringify({ type: "hint", message: "No obvious error words detected.", snippet: text.slice(0, 200) }));
        }
      } catch (e) {
        console.error("Frame processing error:", e);
        ws.send(JSON.stringify({ type: "error", message: e.message }));
      }
    }
  });

  ws.on("close", () => console.log("❌ Screen share disconnected"));
});

// ===== Start Server =====
const PORT = 5000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
    