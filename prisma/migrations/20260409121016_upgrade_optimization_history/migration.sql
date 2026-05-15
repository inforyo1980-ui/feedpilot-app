/*
  Warnings:

  - You are about to drop the column `optimizedTitle` on the `OptimizationHistory` table. All the data in the column will be lost.
  - You are about to drop the column `originalTitle` on the `OptimizationHistory` table. All the data in the column will be lost.
  - You are about to drop the column `scoreAfter` on the `OptimizationHistory` table. All the data in the column will be lost.
  - You are about to drop the column `scoreBefore` on the `OptimizationHistory` table. All the data in the column will be lost.
  - Added the required column `productTitleAfter` to the `OptimizationHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productTitleBefore` to the `OptimizationHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopDomain` to the `OptimizationHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `OptimizationHistory` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OptimizationHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitleBefore" TEXT NOT NULL,
    "productTitleAfter" TEXT NOT NULL,
    "seoScoreBefore" INTEGER,
    "seoScoreAfter" INTEGER,
    "impactDelta" INTEGER,
    "issueCountBefore" INTEGER,
    "issueCountAfter" INTEGER,
    "changeType" TEXT NOT NULL DEFAULT 'title',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "decisionMode" TEXT NOT NULL DEFAULT 'suggest',
    "status" TEXT NOT NULL DEFAULT 'applied',
    "whyText" TEXT,
    "outcomeText" TEXT,
    "actionText" TEXT,
    "rawIssuesJson" TEXT,
    "rawDecisionJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OptimizationHistory" ("createdAt", "id", "productId", "source") SELECT "createdAt", "id", "productId", "source" FROM "OptimizationHistory";
DROP TABLE "OptimizationHistory";
ALTER TABLE "new_OptimizationHistory" RENAME TO "OptimizationHistory";
CREATE INDEX "OptimizationHistory_shopDomain_createdAt_idx" ON "OptimizationHistory"("shopDomain", "createdAt" DESC);
CREATE INDEX "OptimizationHistory_shopDomain_productId_createdAt_idx" ON "OptimizationHistory"("shopDomain", "productId", "createdAt" DESC);
CREATE INDEX "OptimizationHistory_shopDomain_source_createdAt_idx" ON "OptimizationHistory"("shopDomain", "source", "createdAt" DESC);
CREATE INDEX "OptimizationHistory_shopDomain_status_createdAt_idx" ON "OptimizationHistory"("shopDomain", "status", "createdAt" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
