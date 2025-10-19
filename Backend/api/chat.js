import fetch from "node-fetch";
import multer from "multer";
import { promisify } from "util";
import { parseForm } from "multiparty";

// Use multiparty to handle file uploads in serverless
const parseFormAsync = promisify(parseForm);

export const config = {
  api: {
    bodyParser: false, // disable default parsing to handle files
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = new parseForm();
    const { fields, files } = await parseFormAsync(req);

    const message = fields.message?.[0] || "";
    const file = files?.file?.[0]; // file uploaded

    let prompt = message;
    if (file) prompt += `\nUser uploaded a file: ${file.originalFilename}`;

    // Call Gemini API
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
                  text: `${prompt}\n\nPlease format your response using Markdown (headings, bold, bullet points, code blocks only when relevant). Respond concisely and clearly.`,
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

    res.status(200).json({ reply });
  } catch (err) {   
    console.error("Serverless function error:", err);
    res.status(500).json({ reply: "Internal server error" });
  }
}
