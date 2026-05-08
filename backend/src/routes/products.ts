import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { parseIdParam } from "../utils/params";

export const productsRouter = Router();
productsRouter.use(requireAuth);

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.coerce.number().positive(),
  description: z.string().min(1).max(500).optional(),
});

const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "No fields to update" }
);

const PRODUCT_COLS = ["name", "price", "description"] as const;

productsRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, "userId", name, price, description
       FROM "Product" WHERE "userId" = $1 ORDER BY id DESC`,
      [req.user!.id]
    );
    return res.json({ products: rows });
  } catch (err) {
    return next(err);
  }
});

productsRouter.post("/", validateBody(createProductSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createProductSchema>;
    const { rows: [product] } = await pool.query(
      `INSERT INTO "Product" ("userId", name, price, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user!.id, body.name, body.price, body.description ?? null]
    );
    return res.status(201).json({ product });
  } catch (err) {
    return next(err);
  }
});

productsRouter.put("/:id", validateBody(updateProductSchema), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const userId = req.user!.id;
    const body = req.body as z.infer<typeof updateProductSchema>;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const col of PRODUCT_COLS) {
      if (col in body) { fields.push(col); values.push(body[col]); }
    }
    if (fields.length === 0) throw new AppError("No fields to update", 400);

    const set = fields.map((f, i) => `"${f}" = $${i + 1}`).join(", ");
    values.push(id, userId);
    const { rows: [product] } = await pool.query(
      `UPDATE "Product" SET ${set}
       WHERE id = $${fields.length + 1} AND "userId" = $${fields.length + 2}
       RETURNING *`,
      values
    );
    if (!product) throw new AppError("Product not found", 404);

    return res.json({ product });
  } catch (err) {
    return next(err);
  }
});

productsRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const { rowCount } = await pool.query(
      `DELETE FROM "Product" WHERE id = $1 AND "userId" = $2`,
      [id, req.user!.id]
    );
    if (!rowCount) throw new AppError("Product not found", 404);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
