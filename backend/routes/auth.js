const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../db/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "Name, email and password are required" });
  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });

  // Check duplicate
  const { data: existing } = await supabase.from("users").select("id").eq("email", email).single();
  if (existing) return res.status(409).json({ message: "Email already in use" });

  const hashed = bcrypt.hashSync(password, 10);
  const { data, error } = await supabase
    .from("users")
    .insert({ name, email, password: hashed })
    .select("id, name, email")
    .single();

  if (error) return res.status(500).json({ message: error.message });

  res.status(201).json({ user: data, token: makeToken(data) });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  const { data: user } = await supabase.from("users").select("*").eq("email", email).single();
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ message: "Invalid email or password" });

  const payload = { id: user.id, name: user.name, email: user.email };
  res.json({ user: payload, token: makeToken(payload) });
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, created_at")
    .eq("id", req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ message: "User not found" });
  res.json(data);
});

module.exports = router;
