import axios from "axios";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const API_KEY= YOUR_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

function extractReply(resp) {
  try {
    return (
      resp.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      resp.data?.candidates?.[0]?.content?.[0]?.text ||
      resp.data?.output?.[0]?.content?.[0]?.text ||
      null
    );
  } catch (error) {
    console.error("Error extracting reply:", error);
    return null;
  }
}

export class GeminiAiService {
  constructor() {
    this.axios = axios.create({ timeout: 30000 });
  }
async chatWithGemini(message, history = []) {
  const promptText = `You are an AI coding assistant in a collaborative coding room. Keep responses concise (max 4 lines). User message: ${message}`;

  // 🔥 Convert history into Gemini's format
  const formattedHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const payload = {
    contents: [
      ...formattedHistory,
      { role: "user", parts: [{ text: promptText }] }
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  };

  try {
    const resp = await this.axios.post(
      `${GEMINI_API_URL}?key=${API_KEY}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    const reply = extractReply(resp);
    const tokensUsed = resp.data?.usageMetadata?.totalTokenCount ?? null;

    return { data: { reply: reply || "No reply from Gemini.", tokensUsed } };
  } catch (err) {
    console.error("Gemini API Error:", err.response?.status, err.response?.data || err.message);
    throw new Error(err.response?.data?.error?.message || err.message || "Gemini request failed");
  }
}
}