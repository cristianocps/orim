-- AlterTable
ALTER TABLE "elements" ADD COLUMN     "parentId" UUID;

-- CreateIndex
CREATE INDEX "elements_parentId_idx" ON "elements"("parentId");

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
