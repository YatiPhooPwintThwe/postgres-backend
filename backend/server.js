import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import productRoutes from "./routes/productRoutes.js";
import { sql } from "./config/db.js";
import { aj } from "../lib/arcjet.js";  

const app = express();
const PORT = process.env.PORT || 3002;
const TEST_TOKEN = process.env.INTERNAL_TEST_TOKEN || "";

app.set("trust proxy", 1);

// Base middleware
app.disable("x-powered-by");
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));


// ---------- simple root + health ----------
app.get("/", (_req, res) => {
  res.json({ name: "Postgres Products API", status: "ok" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ---------- Arcjet: rate-limit ALL; bot/shield only on WRITES ----------
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);



app.get("/", (req, res) => {
  res.json({ name: "Postgres Products API", status: "ok" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Arcjet: shield + bot detect + rate limit

app.use(async (req, res, next) => {
  // Always allow health/root and preflight
  if (req.path === "/" || req.path === "/health" || req.method === "OPTIONS") {
    return next();
  }

  // 1) Global rate limit (applies to every request)
  try {
    const rl = await ajRate.protect(req, { requested: 1 });
    if (rl.isDenied()) {
      return res.status(rl.statusCode ?? 429).json({ error: "Too Many Requests" });
    }
  } catch (e) {
    // fail-open on limiter errors
    console.warn("Rate limiter error:", e);
  }

  // 2) Bot detection + shield only for write methods
  if (!WRITE_METHODS.has(req.method)) return next();

  // Optional: allow common API tools for your own testing
  const ua = (req.get("user-agent") || "").toLowerCase();
  if (/postman|curl|insomnia/.test(ua)) return next();

  try {
    const decision = await aj.protect(req, { requested: 1 });
    if (decision.isDenied()) {
      const code = decision.statusCode ?? 403;
      const msg =
        decision.reason?.isRateLimited?.() ? "Too Many Requests" :
        decision.reason?.isBot?.()         ? "Bot access denied" :
                                             "Forbidden";
      return res.status(code).json({ error: msg });
    }
  } catch (err) {
    console.error("Arcjet error:", err);
    // fail-open so API still works if Arcjet hiccups
  }

  next();
});

// ---------- temporary write guard (until real auth) ----------
app.use((req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();
  if (req.get("X-Test-Token") === TEST_TOKEN) return next();
  return res.status(401).json({ error: "Authentication required" });
});

// Routes
app.use("/api/products", productRoutes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ---------- centralized error handler ----------
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});


// Ensure table exists
async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image VARCHAR(1024) NOT NULL,
        price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  } catch (err) {
    console.error("Error initDB:", err);
  }
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
