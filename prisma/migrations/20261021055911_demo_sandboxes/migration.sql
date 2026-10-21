-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "demoExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Organization_demoExpiresAt_idx" ON "Organization"("demoExpiresAt");
