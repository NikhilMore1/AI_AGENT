// index.js (replace existing)
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
import mongoose from "mongoose";
import dbCOnnect from "./Connections/dbConnection.js"; // your existing DB connection
dotenv.config();
import registerUsers from './Routes/auth/Registration.routes.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer
const upload = multer({ dest: "uploads/" });

// -------------------
// Mongo Models (inline for simplicity)
// -------------------
const helpRequestSchema = new mongoose.Schema({
  question: String,
  answer: { type: String, default: null },
  status: { type: String, default: "pending" }, // pending | resolved | unresolved
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
});

const kbSchema = new mongoose.Schema({
  question: { type: String, unique: true },
  answer: String,
  createdAt: { type: Date, default: Date.now },
});

const HelpRequest = mongoose.models.HelpRequest || mongoose.model("HelpRequest", helpRequestSchema);
const Knowledge = mongoose.models.Knowledge || mongoose.model("Knowledge", kbSchema);

// -------------------
// Helper: broadcast to all WS clients
// -------------------
let wsClients = new Set();
function broadcastJSON(obj) {
  const str = JSON.stringify(obj);
  for (const ws of wsClients) {
    if (ws.readyState === ws.OPEN) ws.send(str);
  }
}

// -------------------
// Chat endpoint: check KB first, then fallback to Gemini
// -------------------
app.post("/api/chat", upload.single("file"), async (req, res) => {
  try {
    const message = (req.body.message || "").trim();
    const file = req.file;

    if (!message && !file) return res.status(400).json({ reply: "Empty request" });

    // Check KB (case-insensitive match on a normalized question)
    const normalized = message.toLowerCase();
    const kbEntry = await Knowledge.findOne({ question: normalized });
    if (kbEntry) {
      return res.json({ reply: kbEntry.answer });
    }

    // If file present, you may add analysis here (kept simple)
    // Not found in KB -> create help request and reply with escalation message
    const newReq = await HelpRequest.create({ question: message });
    console.log("Created help request:", newReq._id, message);

    // Simulate notifying supervisor (console + broadcast)
    console.log(`Notify supervisor: Hey, I need help answering: "${message}"`);
    broadcastJSON({ type: "new_help_request", id: newReq._id, question: newReq.question, createdAt: newReq.createdAt });

    return res.json({ reply: "Let me check with my supervisor and get back to you." });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ reply: "Internal server error" });
  }
});

// -------------------
// Supervisor endpoints
// -------------------

// List requests (optionally ?status=pending)
app.get("/api/helprequests", async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const list = await HelpRequest.find(filter).sort({ createdAt: -1 }).lean();
  res.json(list);
});

// Resolve a request -> set answer, update KB, broadcast to clients
app.put("/api/helprequests/:id/resolve", async (req, res) => {
  const { id } = req.params;
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ error: "Answer required" });

  const reqDoc = await HelpRequest.findById(id);
  if (!reqDoc) return res.status(404).json({ error: "Request not found" });

  reqDoc.answer = answer;
  reqDoc.status = "resolved";
  reqDoc.resolvedAt = new Date();
  await reqDoc.save();

  // Upsert into KB (normalized)
  const normalized = reqDoc.question.toLowerCase();
  await Knowledge.findOneAndUpdate({ question: normalized }, { question: normalized, answer }, { upsert: true });

  // Broadcast to all connected websocket clients that help is resolved
  broadcastJSON({
    type: "help_resolved",
    id: reqDoc._id,
    question: reqDoc.question,
    answer,
    resolvedAt: reqDoc.resolvedAt,
  });

  res.json({ ok: true, req: reqDoc });
});

// Optional: mark unresolved (timeout) endpoint (not required for demo)
app.put("/api/helprequests/:id/unresolved", async (req, res) => {
  const { id } = req.params;
  const reqDoc = await HelpRequest.findById(id);
  if (!reqDoc) return res.status(404).json({ error: "Request not found" });
  reqDoc.status = "unresolved";
  await reqDoc.save();
  res.json({ ok: true });
});

// -------------------
// Your existing / screen-share + Gemini analysis code unchanged (with minor integration)
// -------------------

// Gemini helper for screen text analysis (unchanged)
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

// HTTP + WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket handling for screen share + help request broadcasts
wss.on("connection", (ws) => {
  console.log("WS client connected.");
  wsClients.add(ws);

  ws.on("message", async (msg) => {
    let obj;
    try {
      obj = JSON.parse(msg.toString());
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (obj.type === "frame" && obj.image_b64) {
      // existing frame processing unchanged
      try {
        const imageData = Buffer.from(obj.image_b64, "base64");
        const tmpPath = path.join("uploads", `frame-${Date.now()}.jpg`);
        await fs.promises.writeFile(tmpPath, imageData);

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

  ws.on("close", () => {
    console.log("WS client disconnected.");
    wsClients.delete(ws);
  });
});

// Start server
dbCOnnect()
  .then(() => {
    console.log("Database connection established ");
    const port = process.env.PORT || 5000;
    server.listen(port, () => console.log(`✅ Server running on http://localhost:${port}`));
  })
  .catch((error) => {
    console.log("Database connection error", error);
  });

app.use('/api', registerUsers);
