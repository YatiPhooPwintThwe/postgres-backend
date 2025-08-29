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


app.get("/", (req, res) => {
  res.json({ name: "Postgres Products API", status: "ok" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Arcjet: shield + bot detect + rate limit
app.use(async (req, res, next) => {
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
    next();
  } catch (err) {
    console.error("Arcjet error:", err);
    next();
  }
});

// Write guard (temporary, until real auth)
app.use((req, res, next) => {
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isWrite) return next();
  if (req.get("X-Test-Token") === TEST_TOKEN) return next();
  return res.status(401).json({ error: "Authentication required" });
});

// Routes
app.use("/api/products", productRoutes);


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
