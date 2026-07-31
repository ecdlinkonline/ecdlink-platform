-- CreateEnum
CREATE TYPE "EcdlinkStaffDepartment" AS ENUM ('OPERATIONS', 'CENTRE_SUPPORT', 'COMPLIANCE', 'FAMILY_SUPPORT', 'PROCUREMENT', 'EVENTS', 'FUNDING', 'TRAINING', 'FINANCE', 'MONITORING_AND_EVALUATION', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "EcdlinkStaffEmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ECDLINK_STAFF';

-- CreateTable
CREATE TABLE "EcdlinkStaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" "EcdlinkStaffDepartment" NOT NULL,
    "employmentStatus" "EcdlinkStaffEmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "managerId" TEXT,
    "phoneNumber" TEXT,
    "workEmail" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "profilePhoto" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcdlinkStaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcdlinkStaffCentreAssignment" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "assignmentRole" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcdlinkStaffCentreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcdlinkStaffProfile_userId_key" ON "EcdlinkStaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EcdlinkStaffProfile_employeeNumber_key" ON "EcdlinkStaffProfile"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EcdlinkStaffProfile_workEmail_key" ON "EcdlinkStaffProfile"("workEmail");

-- CreateIndex
CREATE INDEX "EcdlinkStaffProfile_department_employmentStatus_idx" ON "EcdlinkStaffProfile"("department", "employmentStatus");

-- CreateIndex
CREATE INDEX "EcdlinkStaffProfile_managerId_idx" ON "EcdlinkStaffProfile"("managerId");

-- CreateIndex
CREATE INDEX "EcdlinkStaffCentreAssignment_centreId_isActive_idx" ON "EcdlinkStaffCentreAssignment"("centreId", "isActive");

-- CreateIndex
CREATE INDEX "EcdlinkStaffCentreAssignment_staffProfileId_isPrimary_idx" ON "EcdlinkStaffCentreAssignment"("staffProfileId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "EcdlinkStaffCentreAssignment_staffProfileId_centreId_assign_key" ON "EcdlinkStaffCentreAssignment"("staffProfileId", "centreId", "assignmentRole");

-- AddForeignKey
ALTER TABLE "EcdlinkStaffProfile" ADD CONSTRAINT "EcdlinkStaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcdlinkStaffProfile" ADD CONSTRAINT "EcdlinkStaffProfile_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "EcdlinkStaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcdlinkStaffCentreAssignment" ADD CONSTRAINT "EcdlinkStaffCentreAssignment_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "EcdlinkStaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcdlinkStaffCentreAssignment" ADD CONSTRAINT "EcdlinkStaffCentreAssignment_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcdlinkStaffCentreAssignment" ADD CONSTRAINT "EcdlinkStaffCentreAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
