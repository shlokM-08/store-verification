-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" BIGINT NOT NULL,
    "title" TEXT,
    "vendor" TEXT,
    "tags" TEXT,
    "status" TEXT,
    "price" TEXT,
    "totalInventory" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_shopId_idx" ON "products"("shopId");

-- CreateIndex
CREATE INDEX "products_shopifyProductId_idx" ON "products"("shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "products_shopId_shopifyProductId_key" ON "products"("shopId", "shopifyProductId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
