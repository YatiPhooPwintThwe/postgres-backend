import { sql } from "../config/db.js";

const asInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
const isValidInput = (name, price, image) => {
  const p = Number(price);
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    typeof image === "string" &&
    image.trim().length > 0 &&
    Number.isFinite(p) &&
    p >= 0
  );
};

// GET /api/products
export const getProducts = async (_req, res) => {
  try {
    const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
    return res.status(200).json({ success: true, data: rows });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// GET /api/products/:id
export const getProduct = async (req, res) => {
  const id = asInt(req.params.id);
  if (id === null)
    return res
      .status(400)
      .json({ success: false, message: "Invalid product id" });

  try {
    const [product] = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    return res.status(200).json({ success: true, data: product });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// POST /api/products
export const createProduct = async (req, res) => {
  const { name, price, image } = req.body;
  if (!isValidInput(name, price, image)) {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }
  try {
    const [created] = await sql`
      INSERT INTO products (name, price, image)
      VALUES (${name.trim()}, ${Number(price)}, ${image.trim()})
      RETURNING *
    `;
    return res.status(201).json({ success: true, data: created });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// PUT /api/products/:id
export const updateProduct = async (req, res) => {
  const id = asInt(req.params.id);
  if (id === null)
    return res
      .status(400)
      .json({ success: false, message: "Invalid product id" });

  const { name, price, image } = req.body;
  if (!isValidInput(name, price, image)) {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }

  try {
    const [updated] = await sql`
      UPDATE products
      SET name = ${name.trim()}, price = ${Number(price)}, image = ${image.trim()}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    return res.status(200).json({ success: true, data: updated });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
  const id = asInt(req.params.id);
  if (id === null)
    return res
      .status(400)
      .json({ success: false, message: "Invalid product id" });

  try {
    const [deleted] = await sql`
      DELETE FROM products WHERE id = ${id} RETURNING *
    `;
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    return res.status(200).json({ success: true, data: deleted }); 
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
