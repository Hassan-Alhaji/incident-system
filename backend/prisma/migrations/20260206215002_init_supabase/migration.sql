-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEDICAL_MARSHAL', 'MEDICAL_VENDOR', 'MEDICAL_EVACUATION', 'MEDICAL_OP_TEAM', 'DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER', 'SAFETY_MARSHAL', 'SAFETY_OP_TEAM', 'DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF', 'SPORT_MARSHAL', 'CONTROL_OP_TEAM', 'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_OF_CONTROL', 'SCRUTINEERS', 'JUDGEMENT', 'OPERATIONS', 'VIEWER');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('MEDICAL', 'SAFETY', 'SPORT', 'TECHNICAL', 'JUDGEMENT', 'ACCIDENT', 'INJURY', 'VIOLATION', 'MISSING_ITEM');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'OPEN', 'UNDER_REVIEW', 'ESCALATED', 'AWAITING_MEDICAL', 'AWAITING_DECISION', 'RETURNED_TO_CONTROL', 'RETURNED_TO_MARSHAL', 'RESOLVED', 'CLOSED', 'CLOSED_REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SPORT_MARSHAL',
    "isIntakeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "marshalId" TEXT,
    "mobile" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isMedical" BOOLEAN NOT NULL DEFAULT false,
    "otpCode" TEXT,
    "otpExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "escalatedToRole" TEXT,
    "eventId" TEXT,
    "eventName" TEXT,
    "venue" TEXT,
    "marshalId" TEXT,
    "marshalMobile" TEXT,
    "reporterName" TEXT,
    "reporterSignature" TEXT,
    "postNumber" TEXT,
    "incidentDate" TIMESTAMP(3),
    "incidentTime" TEXT,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "drivers" TEXT,
    "witnesses" TEXT,
    "createdById" TEXT,
    "assignedToId" TEXT,
    "closureReason" TEXT,
    "closedBy" TEXT,
    "closedByRole" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalReport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "patientName" TEXT,
    "patientSurname" TEXT,
    "patientGivenName" TEXT,
    "patientDob" TIMESTAMP(3),
    "patientGender" TEXT,
    "patientAddress" TEXT,
    "patientSuburb" TEXT,
    "patientState" TEXT,
    "patientPostcode" TEXT,
    "patientEmail" TEXT,
    "patientMobile" TEXT,
    "patientPhone" TEXT,
    "patientOccupation" TEXT,
    "motorsportId" TEXT,
    "carNumber" TEXT,
    "patientRole" TEXT,
    "permitNumber" TEXT,
    "licenseAction" TEXT,
    "injuryType" TEXT,
    "treatmentLocation" TEXT,
    "treatmentLocationDetail" TEXT,
    "arrivalMethod" TEXT,
    "incidentDescription" TEXT,
    "whereSeen" TEXT,
    "initialCondition" TEXT,
    "treatmentGiven" TEXT,
    "subsequentTreatment" TEXT,
    "subsequentDetail" TEXT,
    "summary" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlReport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "competitorNumber" TEXT,
    "lapNumber" INTEGER,
    "sector" INTEGER,
    "violationType" TEXT,
    "competitors" TEXT,
    "actionTaken" TEXT,
    "penaltyValue" TEXT,
    "reasoning" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitGridReport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "sessionCategory" TEXT,
    "teamName" TEXT,
    "carNumber" TEXT,
    "driverName" TEXT,
    "pitNumber" TEXT,
    "lapNumber" INTEGER,
    "speedLimit" TEXT,
    "speedRecorded" TEXT,
    "radarOperatorName" TEXT,
    "radarOperatorPhone" TEXT,
    "drivingOnWhiteLine" BOOLEAN NOT NULL DEFAULT false,
    "refueling" BOOLEAN NOT NULL DEFAULT false,
    "driverChange" BOOLEAN NOT NULL DEFAULT false,
    "excessMechanics" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitGridReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyReport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "hazardType" TEXT,
    "locationDetail" TEXT,
    "interventionRequired" BOOLEAN NOT NULL DEFAULT false,
    "resourcesDeployed" TEXT,
    "trackStatus" TEXT,
    "damageDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationReport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "responsibleParty" TEXT,
    "summary" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestigationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketExport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "snapshotJson" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_marshalId_key" ON "User"("marshalId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNo_key" ON "Ticket"("ticketNo");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalReport_ticketId_key" ON "MedicalReport"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlReport_ticketId_key" ON "ControlReport"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "PitGridReport_ticketId_key" ON "PitGridReport"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyReport_ticketId_key" ON "SafetyReport"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationReport_ticketId_key" ON "InvestigationReport"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketExport_verifyToken_key" ON "TicketExport"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "Event_name_key" ON "Event"("name");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalReport" ADD CONSTRAINT "MedicalReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalReport" ADD CONSTRAINT "MedicalReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlReport" ADD CONSTRAINT "ControlReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitGridReport" ADD CONSTRAINT "PitGridReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationReport" ADD CONSTRAINT "InvestigationReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationReport" ADD CONSTRAINT "InvestigationReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketExport" ADD CONSTRAINT "TicketExport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
