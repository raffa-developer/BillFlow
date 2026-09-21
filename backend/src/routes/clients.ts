import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { parseIdParam } from "../utils/params";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(3).max(50).nullable().optional(),
  address: z.string().min(1).max(500).nullable().optional(),
});

const updateClientSchema = createClientSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "No fields to update" }
);

const CLIENT_COLS = ["name", "email", "phone", "address"] as const;

clientsRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, "userId", name, email, phone, address
       FROM "Client" WHERE "userId" = $1 ORDER BY id DESC`,
      [req.user!.id]
    );
    return res.json({ clients: rows });
  } catch (err) {
    return next(err);
  }
});

clientsRouter.post("/", validateBody(createClientSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createClientSchema>;
    const { rows: [client] } = await pool.query(
      `INSERT INTO "Client" ("userId", name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user!.id, body.name, body.email ?? null, body.phone ?? null, body.address ?? null]
    );
    return res.status(201).json({ client });
  } catch (err) {
    return next(err);
  }
});

clientsRouter.put("/:id", validateBody(updateClientSchema), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const userId = req.user!.id;
    const body = req.body as z.infer<typeof updateClientSchema>;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const col of CLIENT_COLS) {
      if (col in body) { fields.push(col); values.push(body[col]); }
    }
    if (fields.length === 0) throw new AppError("No fields to update", 400);

    const set = fields.map((f, i) => `"${f}" = $${i + 1}`).join(", ");
    values.push(id, userId);
    const { rows: [client] } = await pool.query(
      `UPDATE "Client" SET ${set}
       WHERE id = $${fields.length + 1} AND "userId" = $${fields.length + 2}
       RETURNING *`,
      values
    );
    if (!client) throw new AppError("Client not found", 404);

    return res.json({ client });
  } catch (err) {
    return next(err);
  }
});

clientsRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);

    const { rows: [client] } = await pool.query(
      `SELECT id FROM "Client" WHERE id = $1 AND "userId" = $2`,
      [id, req.user!.id]
    );
    if (!client) throw new AppError("Client not found", 404);

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM "Invoice" WHERE "clientId" = $1`,
      [id]
    );
    if (count > 0) {
      throw new AppError(
        `Cannot delete this client: they have ${count} invoice(s). Delete the invoices first.`,
        409
      );
    }

    await pool.query(`DELETE FROM "Client" WHERE id = $1`, [id]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
