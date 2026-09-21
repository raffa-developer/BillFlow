-- BillFlow — PostgreSQL schema
-- Run once to create all tables: npm run db:setup

-- Enums
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');
CREATE TYPE "DiscountType"  AS ENUM ('NONE', 'PERCENT', 'FIXED');

-- Users
CREATE TABLE "User" (
  "id"             SERIAL      PRIMARY KEY,
  "email"          TEXT        NOT NULL UNIQUE,
  "passwordHash"   TEXT        NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "companyName"    TEXT,
  "companyAddress" TEXT,
  "companyVat"     TEXT,
  "companyEmail"   TEXT,
  "companyPhone"   TEXT,
  "companyLogoUrl" TEXT,
  "invoiceCounter"      INTEGER      NOT NULL DEFAULT 0,
  "currency"            TEXT         NOT NULL DEFAULT 'EUR',
  "baseCurrency"        TEXT         NOT NULL DEFAULT 'EUR',
  "currencyRate"        DECIMAL(18,8) NOT NULL DEFAULT 1,
  "tokenVersion"        INTEGER      NOT NULL DEFAULT 0,
  "defaultTaxRate"      DECIMAL(5,2) NOT NULL DEFAULT 0,
  "defaultPaymentDays"  INTEGER      NOT NULL DEFAULT 30,
  "invoicePrefix"       TEXT         NOT NULL DEFAULT 'INV'
);

-- Clients
CREATE TABLE "Client" (
  "id"      SERIAL  PRIMARY KEY,
  "userId"  INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"    TEXT    NOT NULL,
  "email"   TEXT,
  "phone"   TEXT,
  "address" TEXT
);
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- Products
CREATE TABLE "Product" (
  "id"          SERIAL         PRIMARY KEY,
  "userId"      INTEGER        NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"        TEXT           NOT NULL,
  "price"       DECIMAL(12, 2) NOT NULL,
  "description" TEXT
);
CREATE INDEX "Product_userId_idx" ON "Product"("userId");

-- Invoices
CREATE TABLE "Invoice" (
  "id"            SERIAL          PRIMARY KEY,
  "userId"        INTEGER         NOT NULL REFERENCES "User"("id")   ON DELETE CASCADE,
  "clientId"      INTEGER         NOT NULL REFERENCES "Client"("id") ON DELETE RESTRICT,
  "number"        TEXT            NOT NULL,
  "subtotal"      DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  "discountType"  "DiscountType"  NOT NULL DEFAULT 'NONE',
  "discountValue" DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  "taxRate"       DECIMAL(5, 2)   NOT NULL DEFAULT 0,
  "taxAmount"     DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  "total"         DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  "status"        "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "dateIssued"    TIMESTAMPTZ     NOT NULL,
  "dueDate"       TIMESTAMPTZ     NOT NULL,
  "notes"         TEXT,
  "publicToken"   TEXT            UNIQUE,
  "sentAt"        TIMESTAMPTZ,
  UNIQUE ("userId", "number")
);
CREATE INDEX "Invoice_userId_idx"   ON "Invoice"("userId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- Invoice line items
CREATE TABLE "InvoiceItem" (
  "id"          SERIAL         PRIMARY KEY,
  "invoiceId"   INTEGER        NOT NULL REFERENCES "Invoice"("id") ON DELETE CASCADE,
  "productId"   INTEGER        REFERENCES "Product"("id") ON DELETE SET NULL,
  "description" TEXT           NOT NULL,
  "quantity"    INTEGER        NOT NULL,
  "price"       DECIMAL(12, 2) NOT NULL
);
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");

-- Payments
CREATE TABLE "Payment" (
  "id"        SERIAL          PRIMARY KEY,
  "invoiceId" INTEGER         NOT NULL REFERENCES "Invoice"("id") ON DELETE CASCADE,
  "amount"    DECIMAL(12, 2)  NOT NULL,
  "baseAmount" DECIMAL(15,6)  NOT NULL,
  "paidAt"    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "method"    TEXT            NOT NULL DEFAULT 'other',
  "reference" TEXT
);
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- Password reset tokens
CREATE TABLE "PasswordResetToken" (
  "id"        SERIAL      PRIMARY KEY,
  "userId"    INTEGER     NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "token"     TEXT        NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
