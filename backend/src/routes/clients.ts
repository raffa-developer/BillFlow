import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { parseIdParam } from "../utils/params";

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().min(3).max(50).optional(),
  address: z.string().min(1).max(500).optional()
});

const updateClientSchema = createClientSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "No fields to update" }
);

clientsRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { id: "desc" }
    });

    return res.json({ clients });
  } catch (err) {
    return next(err);
  }
});

clientsRouter.post("/", validateBody(createClientSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const client = await prisma.client.create({
      data: {
        ...req.body,
        userId
      }
    });

    return res.status(201).json({ client });
  } catch (err) {
    return next(err);
  }
});

clientsRouter.put("/:id", validateBody(updateClientSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const id = parseIdParam(req.params.id);

    const existing = await prisma.client.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      throw new AppError("Client not found", 404);
    }

    const client = await prisma.client.update({
      where: { id },
      data: req.body
    });

    return res.json({ client });
  } catch (err) {
    return next(err);
  }
});

clientsRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const id = parseIdParam(req.params.id);

    const existing = await prisma.client.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      throw new AppError("Client not found", 404);
    }

    await prisma.client.delete({ where: { id } });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
