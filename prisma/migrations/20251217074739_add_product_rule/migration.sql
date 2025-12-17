-- CreateTable
CREATE TABLE "product_rules" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_rules_shopId_idx" ON "product_rules"("shopId");

-- AddForeignKey
ALTER TABLE "product_rules" ADD CONSTRAINT "product_rules_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
