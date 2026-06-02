/*
  Warnings:

  - The values [HEALTH_STRUCTURE] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[bloodRequestId]` on the table `alerts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `structureType` to the `health_structures` table without a default value. This is not possible if the table is not empty.
  - Made the column `region` on table `health_structures` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('CNTS', 'HOSPITAL', 'HEALTH_CENTER');

-- CreateEnum
CREATE TYPE "AlertOrigin" AS ENUM ('CNTS_DIRECT', 'CNTS_ESCALATION', 'HOSPITAL_DIRECT');

-- CreateEnum
CREATE TYPE "BloodRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'ESCALATED_TO_ALERT', 'REJECTED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('DONOR', 'CNTS_AGENT', 'CNTS_ADMIN', 'HOSPITAL_AGENT', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'DONOR';
COMMIT;

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "bloodRequestId" UUID,
ADD COLUMN     "origin" "AlertOrigin" NOT NULL DEFAULT 'CNTS_DIRECT';

-- AlterTable
ALTER TABLE "blood_stocks" ADD COLUMN     "lastSuppliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "health_structures" ADD COLUMN     "affiliatedCntsId" UUID,
ADD COLUMN     "structureType" "StructureType" NOT NULL,
ALTER COLUMN "region" SET NOT NULL;

-- CreateTable
CREATE TABLE "blood_requests" (
    "id" UUID NOT NULL,
    "requestingHospitalId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "handledByCntsId" UUID NOT NULL,
    "handledByUserId" UUID,
    "bloodType" "BloodType" NOT NULL,
    "quantityNeeded" INTEGER NOT NULL,
    "urgencyLevel" "UrgencyLevel" NOT NULL,
    "serviceUnit" "ServiceUnit" NOT NULL,
    "clinicalContext" TEXT,
    "quantityProvided" INTEGER NOT NULL DEFAULT 0,
    "status" "BloodRequestStatus" NOT NULL DEFAULT 'PENDING',
    "cntsNotes" TEXT,
    "escalatedAlertId" UUID,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blood_requests_escalatedAlertId_key" ON "blood_requests"("escalatedAlertId");

-- CreateIndex
CREATE INDEX "blood_requests_status_createdAt_idx" ON "blood_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "blood_requests_requestingHospitalId_createdAt_idx" ON "blood_requests"("requestingHospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "blood_requests_handledByCntsId_status_idx" ON "blood_requests"("handledByCntsId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_bloodRequestId_key" ON "alerts"("bloodRequestId");

-- AddForeignKey
ALTER TABLE "health_structures" ADD CONSTRAINT "health_structures_affiliatedCntsId_fkey" FOREIGN KEY ("affiliatedCntsId") REFERENCES "health_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_requestingHospitalId_fkey" FOREIGN KEY ("requestingHospitalId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_handledByCntsId_fkey" FOREIGN KEY ("handledByCntsId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_escalatedAlertId_fkey" FOREIGN KEY ("escalatedAlertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
