-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AutoOptimizeSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'suggest',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "optimizeBelowScore" INTEGER NOT NULL DEFAULT 70,
    "optimizeShortTitle" BOOLEAN NOT NULL DEFAULT true,
    "optimizeWeakDescription" BOOLEAN NOT NULL DEFAULT true,
    "prioritizeLowScore" BOOLEAN NOT NULL DEFAULT true,
    "prioritizeWeakDescription" BOOLEAN NOT NULL DEFAULT true,
    "maxProductsPerRun" INTEGER NOT NULL DEFAULT 5,
    "runFrequencyDays" INTEGER NOT NULL DEFAULT 7
);
INSERT INTO "new_AutoOptimizeSettings" ("createdAt", "enabled", "id", "lastRunAt", "mode", "shopDomain", "updatedAt") SELECT "createdAt", "enabled", "id", "lastRunAt", "mode", "shopDomain", "updatedAt" FROM "AutoOptimizeSettings";
DROP TABLE "AutoOptimizeSettings";
ALTER TABLE "new_AutoOptimizeSettings" RENAME TO "AutoOptimizeSettings";
CREATE UNIQUE INDEX "AutoOptimizeSettings_shopDomain_key" ON "AutoOptimizeSettings"("shopDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
