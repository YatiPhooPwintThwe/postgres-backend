import arcjet, { tokenBucket, shield, detectBot } from "@arcjet/node";
import "dotenv/config";

export const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    // Shield protects our app from common attacks e.g. SQL injection, XSS, CRF attacks
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      // block all bots except search engines

      allow: ["CATEGORY:SEARCH_ENGINE"],
    }),

  ],
});


// rate limiting

export const ajRate = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    // Global per-IP rate limit (tune as needed)
    tokenBucket({
      mode: "LIVE",
      characteristics: ["ip.src"],
      capacity: 20,   
      refillRate: 10, // tokens per interval
      interval: 10,   // seconds
    }),
  ],
});
