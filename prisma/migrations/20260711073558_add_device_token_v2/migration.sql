-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "deviceTokenV2" TEXT,
ALTER COLUMN "endingDate" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year');

-- CreateIndex
CREATE INDEX "Service_deviceTokenV2_idx" ON "Service"("deviceTokenV2");
