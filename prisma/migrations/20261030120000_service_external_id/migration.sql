-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Service_externalId_key" ON "Service"("externalId");

