-- CreateEnum
CREATE TYPE "DonationDayStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "donation_days" (
    "id" UUID NOT NULL,
    "healthStructureId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "targetDonors" INTEGER NOT NULL DEFAULT 50,
    "bloodTypesNeeded" TEXT[],
    "status" "DonationDayStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_day_registrations" (
    "id" UUID NOT NULL,
    "donationDayId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "timeSlot" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "donation_day_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donation_days_scheduledDate_status_idx" ON "donation_days"("scheduledDate", "status");

-- CreateIndex
CREATE INDEX "donation_days_healthStructureId_scheduledDate_idx" ON "donation_days"("healthStructureId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "donation_day_registrations_donationDayId_donorId_key" ON "donation_day_registrations"("donationDayId", "donorId");

-- AddForeignKey
ALTER TABLE "donation_days" ADD CONSTRAINT "donation_days_healthStructureId_fkey" FOREIGN KEY ("healthStructureId") REFERENCES "health_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_days" ADD CONSTRAINT "donation_days_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_day_registrations" ADD CONSTRAINT "donation_day_registrations_donationDayId_fkey" FOREIGN KEY ("donationDayId") REFERENCES "donation_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_day_registrations" ADD CONSTRAINT "donation_day_registrations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
