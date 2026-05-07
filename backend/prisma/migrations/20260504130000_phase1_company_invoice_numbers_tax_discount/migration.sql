-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'PERCENT', 'FIXED');

-- AlterTable: User — company profile fields + invoice counter
ALTER TABLE "User"
  ADD COLUMN "companyName"    TEXT,
  ADD COLUMN "companyAddress" TEXT,
  ADD COLUMN "companyVat"     TEXT,
  ADD COLUMN "companyEmail"   TEXT,
  ADD COLUMN "companyPhone"   TEXT,
  ADD COLUMN "companyLogoUrl" TEXT,
  ADD COLUMN "invoiceCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Invoice — number / tax / discount / notes (nullable for backfill)
ALTER TABLE "Invoice"
  ADD COLUMN "number"        TEXT,
  ADD COLUMN "subtotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountType"  "DiscountType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate"       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "notes"         TEXT;

-- Backfill: number = INV-XXXX per user, ordered by id
WITH numbered AS (
  SELECT
    id,
    "userId",
    'INV-' || LPAD(ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY id)::text, 4, '0') AS num,
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY id) AS rn
  FROM "Invoice"
)
UPDATE "Invoice" i
   SET "number"   = n.num,
       "subtotal" = i.total
  FROM numbered n
 WHERE n.id = i.id;

-- Sync each user's invoiceCounter to MAX issued so next number doesn't collide
UPDATE "User" u
   SET "invoiceCounter" = COALESCE(sub.cnt, 0)
  FROM (
    SELECT "userId", COUNT(*) AS cnt
      FROM "Invoice"
     GROUP BY "userId"
  ) sub
 WHERE sub."userId" = u.id;

-- Now make number NOT NULL
ALTER TABLE "Invoice" ALTER COLUMN "number" SET NOT NULL;

-- Unique per (userId, number)
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");

-- CreateTable: PasswordResetToken
CREATE TABLE "PasswordResetToken" (
    "id"        SERIAL NOT NULL,
    "userId"    INTEGER NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
