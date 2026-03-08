const express        = require("express");
const multer         = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const supabase       = require("../db/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// ── Multer — memory storage, 10 MB limit ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP, GIF, and PDF files are accepted."));
  },
});

// ── Gemini client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Category keywords for auto-detection ─────────────────────────────────────
const CATEGORIES = [
  "food", "groceries", "transport", "shopping",
  "bills", "healthcare", "entertainment", "education", "travel", "other",
];

// ── POST /api/receipts/scan — OCR a receipt image or PDF ─────────────────────
router.post("/scan", upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded." });
  if (!process.env.GEMINI_API_KEY)
    return res.status(500).json({ message: "GEMINI_API_KEY is not configured." });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const fileData = {
      inlineData: {
        mimeType: req.file.mimetype,
        data:     req.file.buffer.toString("base64"),
      },
    };

    const prompt = `You are an expert receipt OCR system. Carefully analyse this receipt image or PDF and extract the following details.

Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON.

Required JSON structure:
{
  "merchant": "store/restaurant/merchant name",
  "amount": 123.45,
  "date": "YYYY-MM-DD",
  "category": "one of: food, groceries, transport, shopping, bills, healthcare, entertainment, education, travel, other",
  "description": "brief description of purchase",
  "payment_method": "Cash or Credit Card or Debit Card or UPI or Net Banking or Wallet",
  "items": ["item1", "item2"],
  "tax": 0.00,
  "subtotal": 0.00,
  "confidence": 0.95
}

Rules:
- amount: the TOTAL amount paid (including tax). Must be a number, not a string.
- date: convert any date format to YYYY-MM-DD. If only month/year visible, use the 1st. If no date, use today: ${new Date().toISOString().split("T")[0]}
- merchant: extract the store/restaurant name from the header of the receipt
- category: choose the best match from the allowed list based on merchant and items
- payment_method: look for payment type at the bottom of the receipt, default "Cash"
- items: list up to 5 main items purchased, empty array if not visible
- tax: GST/tax amount if shown, else 0
- subtotal: subtotal before tax if shown, else same as amount
- confidence: your confidence in the extraction from 0 to 1
- If a field is not visible or cannot be determined, use null for strings and 0 for numbers`;

    const result = await model.generateContent([prompt, fileData]);
    const text   = result.response.text().trim();

    // Strip markdown fences if present
    const clean  = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let extracted;
    try {
      extracted = JSON.parse(clean);
    } catch {
      // Attempt to pull JSON from within the response
      const match = clean.match(/\{[\s\S]+\}/);
      if (!match) throw new Error("Could not parse Gemini response as JSON.");
      extracted = JSON.parse(match[0]);
    }

    // Validate and sanitise
    const today = new Date().toISOString().split("T")[0];
    const safe  = {
      merchant:       extracted.merchant       || null,
      amount:         parseFloat(extracted.amount) || 0,
      date:           extracted.date           || today,
      category:       CATEGORIES.includes(extracted.category) ? extracted.category : "other",
      description:    extracted.description    || "",
      payment_method: extracted.payment_method || "Cash",
      items:          Array.isArray(extracted.items) ? extracted.items.slice(0, 10) : [],
      tax:            parseFloat(extracted.tax)      || 0,
      subtotal:       parseFloat(extracted.subtotal) || parseFloat(extracted.amount) || 0,
      confidence:     parseFloat(extracted.confidence) || 0.5,
    };

    return res.json({ success: true, extracted: safe });
  } catch (err) {
    console.error("[Receipt Scan Error]", err?.message || err);
    const msg = err?.message || "";
    if (msg.includes("API_KEY"))     return res.status(500).json({ message: "Invalid Gemini API key." });
    if (msg.includes("SAFETY"))      return res.status(400).json({ message: "Receipt was blocked by safety filters." });
    if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED"))
      return res.status(429).json({ message: "Gemini rate limit reached. Try again in a moment." });
    return res.status(500).json({ message: "OCR failed. Please try a clearer image." });
  }
});

// ── POST /api/receipts/save — persist the confirmed expense from a receipt ────
router.post("/save", async (req, res) => {
  const { amount, category, description, date, payment_method, merchant } = req.body;

  if (!amount || !category || !date)
    return res.status(400).json({ message: "amount, category, and date are required." });

  try {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id:        req.user.id,
        amount:         parseFloat(amount),
        category:       category || "other",
        description:    description || "",
        date,
        payment_method: payment_method || "Cash",
        merchant:       merchant || "",
      })
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, expense: data });
  } catch (err) {
    console.error("[Receipt Save Error]", err?.message || err);
    return res.status(500).json({ message: "Failed to save expense." });
  }
});

module.exports = router;
