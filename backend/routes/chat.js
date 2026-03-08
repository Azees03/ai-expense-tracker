const express        = require("express");
const authMiddleware = require("../middleware/auth");
const { runAIChat }  = require("../services/aiService");

const router = express.Router();
router.use(authMiddleware);

// POST /api/chat
router.post("/", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ message: "messages array is required" });

  const valid = messages.every(m =>
    m.role && m.content && ["user","assistant"].includes(m.role)
  );
  if (!valid)
    return res.status(400).json({ message: "Each message must have role (user|assistant) and content." });

  if (!process.env.GEMINI_API_KEY)
    return res.status(500).json({ message: "GEMINI_API_KEY is not configured. Add it to your .env file." });

  try {
    const result = await runAIChat(messages, req.user.id);
    return res.json(result);  // { message: string, mutated: boolean }
  } catch (err) {
    console.error("[Chat Error]", err?.message || err);

    const msg = err?.message || "";

    if (msg.includes("API_KEY_INVALID") || err?.status === 401)
      return res.status(500).json({ message: "Invalid Gemini API key. Check GEMINI_API_KEY in .env." });

    if (err?.status === 429 || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED"))
      return res.status(429).json({ message: "Gemini rate limit hit. Wait a moment and try again." });

    if (msg.includes("SAFETY"))
      return res.status(400).json({ message: "The message was blocked by Gemini safety filters." });

    return res.status(500).json({ message: "AI service error. Please try again." });
  }
});

module.exports = router;
