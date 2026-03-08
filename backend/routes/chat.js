const express = require("express");
const authMiddleware = require("../middleware/auth");
// aiService will be wired in when we implement Gemini
// const { runAIChat } = require("../services/aiService");

const router = express.Router();
router.use(authMiddleware);

// POST /api/chat
router.post("/", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: "Messages array is required" });
  }

  // Placeholder — Gemini integration coming soon
  return res.status(501).json({ message: "AI chat not yet implemented. Coming soon!" });
});

module.exports = router;
