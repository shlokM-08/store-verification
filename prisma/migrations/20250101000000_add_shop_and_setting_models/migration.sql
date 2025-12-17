-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_shopDomain_key" ON "shops"("shopDomain");

-- CreateIndex
CREATE INDEX "shops_shopDomain_idx" ON "shops"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "settings_shopId_key_key" ON "settings"("shopId", "key");

-- CreateIndex
CREATE INDEX "settings_shopId_idx" ON "settings"("shopId");

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

