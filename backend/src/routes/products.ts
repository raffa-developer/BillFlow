import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { parseIdParam } from "../utils/params";

export const productsRouter = Router();

productsRouter.use(requireAuth);

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.coerce.number().positive(),
  description: z.string().min(1).max(500).optional()
});

const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "No fields to update" }
);

productsRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const products = await prisma.product.findMany({
      where: { userId },
      orderBy: { id: "desc" }
    });

    return res.json({ products });
  } catch (err) {
    return next(err);
  }
});

productsRouter.post("/", validateBody(createProductSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const product = await prisma.product.create({
      data: {
        ...req.body,
        userId
      }
    });

    return res.status(201).json({ product });
  } catch (err) {
    return next(err);
  }
});

productsRouter.put("/:id", validateBody(updateProductSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const id = parseIdParam(req.params.id);

    const existing = await prisma.product.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      throw new AppError("Product not found", 404);
    }

    const product = await prisma.product.update({
      where: { id },
      data: req.body
    });

    return res.json({ product });
  } catch (err) {
    return next(err);
  }
});

productsRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const id = parseIdParam(req.params.id);

    const existing = await prisma.product.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      throw new AppError("Product not found", 404);
    }

    await prisma.product.delete({ where: { id } });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
