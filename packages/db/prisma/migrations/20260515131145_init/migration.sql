-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('FORM_4', 'FORM_13F', 'SCHEDULE_13DG');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NTFY', 'EMAIL');

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "cik" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "description" TEXT,
    "tracked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filing" (
    "id" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "formType" "FormType" NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "periodOfReport" TIMESTAMP(3),
    "entityId" TEXT NOT NULL,
    "issuerName" TEXT,
    "issuerCik" TEXT,
    "issuerTicker" TEXT,
    "rawUrl" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Filing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "securityTitle" TEXT NOT NULL,
    "transactionCode" TEXT NOT NULL,
    "shares" DECIMAL(20,6) NOT NULL,
    "pricePerShare" DECIMAL(20,6),
    "totalValue" DECIMAL(20,2),
    "sharesOwnedAfter" DECIMAL(20,6),
    "ownershipForm" TEXT NOT NULL,
    "footnote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "entityId" TEXT,
    "formTypes" "FormType"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollerState" (
    "id" TEXT NOT NULL,
    "formType" "FormType" NOT NULL,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "PollerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entity_cik_key" ON "Entity"("cik");

-- CreateIndex
CREATE INDEX "Entity_tracked_idx" ON "Entity"("tracked");

-- CreateIndex
CREATE UNIQUE INDEX "Filing_accessionNumber_key" ON "Filing"("accessionNumber");

-- CreateIndex
CREATE INDEX "Filing_entityId_idx" ON "Filing"("entityId");

-- CreateIndex
CREATE INDEX "Filing_formType_idx" ON "Filing"("formType");

-- CreateIndex
CREATE INDEX "Filing_filedAt_idx" ON "Filing"("filedAt" DESC);

-- CreateIndex
CREATE INDEX "Filing_processed_idx" ON "Filing"("processed");

-- CreateIndex
CREATE INDEX "Transaction_filingId_idx" ON "Transaction"("filingId");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PollerState_formType_key" ON "PollerState"("formType");

-- AddForeignKey
ALTER TABLE "Filing" ADD CONSTRAINT "Filing_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
