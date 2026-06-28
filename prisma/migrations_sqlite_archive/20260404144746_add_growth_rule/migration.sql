-- CreateTable
CREATE TABLE "AutoOptimizeSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'suggest',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GrowthAutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "optimizeBelowScore" INTEGER NOT NULL DEFAULT 70,
    "optimizeShortTitle" BOOLEAN NOT NULL DEFAULT true,
    "optimizeWeakDescription" BOOLEAN NOT NULL DEFAULT true,
    "optimizeNewProductsOnly" BOOLEAN NOT NULL DEFAULT false,
    "prioritizeLowScore" BOOLEAN NOT NULL DEFAULT true,
    "prioritizeNewProducts" BOOLEAN NOT NULL DEFAULT true,
    "prioritizeWeakDescription" BOOLEAN NOT NULL DEFAULT true,
    "maxProductsPerRun" INTEGER NOT NULL DEFAULT 10,
    "runMode" TEXT NOT NULL DEFAULT 'suggest',
    "runFrequencyDays" INTEGER NOT NULL DEFAULT 7,
    "focusMode" TEXT NOT NULL DEFAULT 'balanced',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoOptimizeSettings_shopDomain_key" ON "AutoOptimizeSettings"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthAutomationRule_shopDomain_key" ON "GrowthAutomationRule"("shopDomain");
