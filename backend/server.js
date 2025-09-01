import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import productRoutes from "./routes/productRoutes.js";
import { sql } from "./config/db.js";
import { aj, ajRate } from "../lib/arcjet.js";   // <-- import both

const app = express();
const PORT = process.env.PORT || 3002;
const TEST_TOKEN = process.env.INTERNAL_TEST_TOKEN || "";

// trust proxy so Arcjet sees client IP on Railway/Render/NGINX/etc
app.set("trust proxy", 1);

// Base middleware
app.disable("x-powered-by");
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// Root + health
app.get("/", (_req, res) => res.json({ name: "Postgres Products API", status: "ok" }));
app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// ---------- Arcjet gate ----------
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Optional: bypass list for your own testing (IP or token)
// - Header: X-Bypass-RateLimit: <TEST_TOKEN>
// - OR whitelist your IP(s) below (be careful in prod)
const BYPASS_IPS = new Set([
  "127.0.0.1", "::1",
]);

app.use(async (req, res, next) => {
  if (req.path === "/" || req.path === "/health" || req.method === "OPTIONS") {
    return next();
  }

  // ---- self/bypass (skip rate limit & bot/shield) ----
  const bypassByHeader = TEST_TOKEN && req.get("X-Bypass-RateLimit") === TEST_TOKEN;
  const bypassByIp = BYPASS_IPS.has(req.ip);
  if (bypassByHeader || bypassByIp) return next();

  // 1) Global rate limit
  try {
    const rl = await ajRate.protect(req, { requested: 1 });
    if (rl.isDenied()) {
      return res.status(rl.statusCode ?? 429).json({ error: "Too Many Requests" });
    }
  } catch (e) {
    console.warn("Rate limiter error:", e); // fail-open
  }

  // 2) Bot/shield only on writes
  if (!WRITE_METHODS.has(req.method)) return next();

  // Allow common API tools when *not* bypassing
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
    console.error("Arcjet error:", err); // fail-open
  }

  next();
});

// Temporary write guard (until real auth)
app.use((req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();
  if (req.get("X-Test-Token") === TEST_TOKEN) return next();
  return res.status(401).json({ error: "Authentication required" });
});

// Routes
app.use("/api/products", productRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// Error handler
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.statusCode || 500).json({ error: err.message || "Internal Server Error" });
});

// Ensure table exists + start
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

if (!process.env.ARCJET_KEY) {
  console.warn("⚠️ ARCJET_KEY is missing. Arcjet will fail-open or warn in dev.");
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
