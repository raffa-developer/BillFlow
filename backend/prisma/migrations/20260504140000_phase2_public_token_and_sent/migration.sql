ALTER TABLE "Invoice"
  ADD COLUMN "publicToken" TEXT,
  ADD COLUMN "sentAt"      TIMESTAMP(3);

CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");
