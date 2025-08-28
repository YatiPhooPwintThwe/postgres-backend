import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import productRoutes from "./routes/productRoutes.js";
import { sql } from "./config/db.js";
import { aj as ajDetect, ajRate } from "../lib/arcjet.js"; // shield+detectBot, rate limit

const app = express();
const PORT = process.env.PORT || 3002;
const TEST_TOKEN = process.env.INTERNAL_TEST_TOKEN || "";

const __dirname = path.resolve();
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

// 1) Bot detection for public;  Postman bypasses with X-Test-Token
app.use(async (req, res, next) => {
  try {
    const isTester = req.get("X-Test-Token") === TEST_TOKEN;
    if (!isTester) {
      const d = await ajDetect.protect(req, { requested: 1 });
      if (d.isDenied()) {
        const code = d.statusCode ?? 403;
        return res.status(code).json({
          error: d.reason?.isBot?.() ? "Bot access denied" : "Forbidden",
        });
      }
    }
    next();
  } catch (err) {
    console.error("Arcjet detect error:", err);
    next();
  }
});

// 2) Rate limit for everyone (including me)
app.use(async (req, res, next) => {
  try {
    const r = await ajRate.protect(req, { requested: 1 });
    if (r.isDenied()) {
      return res
        .status(r.statusCode ?? 429)
        .json({ error: "Too Many Requests" });
    }
    next();
  } catch (err) {
    console.error("Arcjet rate error:", err);
    next();
  }
});

// 3) Write guard: only tester header can write (until we add auth)
app.use((req, res, next) => {
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isWrite) return next();
  if (req.get("X-Test-Token") === TEST_TOKEN) return next();
  return res.status(401).json({ error: "Authentication required" });
});

// Routes
app.use("/api/products", productRoutes);

if(process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

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
