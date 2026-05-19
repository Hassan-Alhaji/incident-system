-- AlterTable: Add uploadedById to Attachment
ALTER TABLE "Attachment" ADD COLUMN "uploadedById" TEXT;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- Backfill: Set uploadedById from the ticket's createdById for existing attachments
-- This is a best-effort backfill; new attachments will always have uploadedById set correctly.
UPDATE "Attachment" a
SET "uploadedById" = t."createdById"
FROM "Ticket" t
WHERE a."ticketId" = t."id"
  AND a."uploadedById" IS NULL
  AND t."createdById" IS NOT NULL;
