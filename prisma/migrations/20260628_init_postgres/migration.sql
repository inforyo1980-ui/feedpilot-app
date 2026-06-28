-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationHistory" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoOptimizeSettings" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'suggest',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "optimizeBelowScore" INTEGER NOT NULL DEFAULT 70,
    "optimizeShortTitle" BOOLEAN NOT NULL DEFAULT true,
    "optimizeWeakDescription" BOOLEAN NOT NULL DEFAULT true,
    "prioritizeLowScore" BOOLEAN NOT NULL DEFAULT true,
    "prioritizeWeakDescription" BOOLEAN NOT NULL DEFAULT true,
    "maxProductsPerRun" INTEGER NOT NULL DEFAULT 5,
    "runFrequencyDays" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "AutoOptimizeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthAutomationRule" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OptimizationHistory_shopDomain_createdAt_idx" ON "OptimizationHistory"("shopDomain", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OptimizationHistory_shopDomain_productId_createdAt_idx" ON "OptimizationHistory"("shopDomain", "productId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OptimizationHistory_shopDomain_source_createdAt_idx" ON "OptimizationHistory"("shopDomain", "source", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OptimizationHistory_shopDomain_status_createdAt_idx" ON "OptimizationHistory"("shopDomain", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AutoOptimizeSettings_shopDomain_key" ON "AutoOptimizeSettings"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthAutomationRule_shopDomain_key" ON "GrowthAutomationRule"("shopDomain");

