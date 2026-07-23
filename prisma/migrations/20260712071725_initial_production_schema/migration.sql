-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ECD_CENTRE', 'SUPPLIER', 'DONOR', 'FUNDING_ORGANISATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CentreUserRole" AS ENUM ('PRINCIPAL', 'OWNER', 'ADMINISTRATOR', 'PRACTITIONER', 'FINANCE', 'VOLUNTEER', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "OwnershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'IN_PROGRESS', 'NOT_REGISTERED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'PENDING', 'EXPIRED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'ATTENTION', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "ReadinessStatus" AS ENUM ('READY', 'IN_PROGRESS', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PROFILE', 'MEMBERSHIP', 'PROCUREMENT', 'COMPLIANCE', 'FUNDING', 'NOTE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'MISSING', 'EXPIRED', 'EXPIRING_SOON', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'REQUIRES_RESUBMISSION');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcurementCycleStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'PROCESSING', 'DELIVERED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'BACK_ORDER', 'DISCONTINUED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'NOT_PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FundingApplicationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY', 'SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "FundingChecklistStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'WAIVED');

-- CreateEnum
CREATE TYPE "SupplierUserRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'SALES', 'FINANCE', 'LOGISTICS', 'CATALOGUE_MANAGER', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "SupplierOwnershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "SupplierDocumentStatus" AS ENUM ('MISSING', 'UPLOADED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'EXPIRING_SOON');

-- CreateEnum
CREATE TYPE "SupplierQuotationStatus" AS ENUM ('DRAFT', 'REQUESTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PartnerUserRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'PROGRAMME_MANAGER', 'FINANCE', 'MONITORING_EVALUATION', 'VIEWER');

-- CreateEnum
CREATE TYPE "PartnerOwnershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MessageParticipantType" AS ENUM ('USER', 'CENTRE', 'SUPPLIER', 'DONOR', 'FUNDING_ORGANISATION', 'ECDLINK');

-- CreateEnum
CREATE TYPE "IntelligenceQueryStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntelligenceInsightSeverity" AS ENUM ('INFORMATION', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IntelligenceInsightStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IntelligenceRecommendationStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IntelligenceDraftStatus" AS ENUM ('DRAFT', 'REVIEWED', 'ACCEPTED', 'REJECTED', 'CONVERTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "roleId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcdCentre" (
    "id" TEXT NOT NULL,
    "centreName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "npoNumber" TEXT,
    "dbeRegistrationStatus" TEXT,
    "partialCareStatus" TEXT,
    "physicalAddress" TEXT,
    "suburb" TEXT,
    "area" TEXT,
    "region" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "principalName" TEXT,
    "numberOfChildren" INTEGER,
    "numberOfStaff" INTEGER,
    "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "procurementStatus" "ParticipationStatus" NOT NULL DEFAULT 'PENDING',
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'ATTENTION',
    "fundingReadinessStatus" "ReadinessStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "EcdCentre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentreUser" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CentreUserRole" NOT NULL DEFAULT 'READ_ONLY',
    "title" TEXT,
    "status" "OwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentreUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentrePhoto" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tone" TEXT,
    "fileId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentrePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentreNote" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentreNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentreActivity" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentreActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "membershipYear" INTEGER NOT NULL,
    "annualFee" DECIMAL(12,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "renewalReminderDate" TIMESTAMP(3) NOT NULL,
    "renewalDate" TIMESTAMP(3),
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_PAID',
    "amountDue" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipInvoice" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "fileId" TEXT,

    CONSTRAINT "MembershipInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPayment" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "receivedByUserId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "receiptReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipReceipt" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "paymentId" TEXT,
    "receiptNo" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" TEXT,

    CONSTRAINT "MembershipReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRequirement" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "code" TEXT,
    "description" TEXT,
    "category" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requiresExpiryDate" BOOLEAN NOT NULL DEFAULT false,
    "acceptedFileTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxFileSize" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "requirementId" TEXT,
    "fileId" TEXT,
    "documentNumber" TEXT,
    "documentType" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'MISSING',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "reminderDate" TIMESTAMP(3),
    "replacementDocumentId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingProfile" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "status" "FundingApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "readinessStatus" "ReadinessStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "proposalReady" BOOLEAN NOT NULL DEFAULT false,
    "budgetReady" BOOLEAN NOT NULL DEFAULT false,
    "beneficiaryListReady" BOOLEAN NOT NULL DEFAULT false,
    "supportingDocsReady" BOOLEAN NOT NULL DEFAULT false,
    "missingRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedActions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminNotes" TEXT,
    "lastAssessmentDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingProject" (
    "id" TEXT NOT NULL,
    "fundingProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "opportunityType" TEXT,
    "funderType" TEXT,
    "summary" TEXT,
    "objective" TEXT,
    "problemStatement" TEXT,
    "expectedOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requestedAmount" DECIMAL(12,2) NOT NULL,
    "amountSecured" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fundingGap" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "beneficiaries" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "FundingApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" TEXT NOT NULL DEFAULT 'Internal',
    "approvedForPartnerPortal" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingApplication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fundingCallId" TEXT,
    "fundingOrganisationId" TEXT,
    "applicationNumber" TEXT NOT NULL,
    "requestedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedAmount" DECIMAL(12,2),
    "readinessScoreAtSubmission" INTEGER,
    "submissionMethod" TEXT,
    "externalReference" TEXT,
    "status" "FundingApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiaryList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "beneficiaryType" TEXT,
    "reportingPeriod" TEXT,
    "boysCount" INTEGER,
    "girlsCount" INTEGER,
    "ageGroupSummary" JSONB,
    "disabilityCount" INTEGER,
    "notes" TEXT,
    "fileId" TEXT,
    "createdByUserId" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeneficiaryList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "total" DECIMAL(12,2) NOT NULL,
    "requestedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coFundingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "frequency" TEXT,
    "justification" TEXT,
    "supplierId" TEXT,
    "quotationFileAssetId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingProposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "problemStatement" TEXT,
    "projectPlan" TEXT,
    "impactStatement" TEXT,
    "status" "FundingApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedByAi" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingChecklistItem" (
    "id" TEXT NOT NULL,
    "fundingProfileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "FundingChecklistStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "note" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingSupportingDocument" (
    "id" TEXT NOT NULL,
    "fundingProfileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" "FundingChecklistStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "fileId" TEXT,
    "note" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingSupportingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingReminder" (
    "id" TEXT NOT NULL,
    "fundingProfileId" TEXT,
    "applicationId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "vatNumber" TEXT,
    "taxNumber" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "physicalAddress" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "areasServed" TEXT[],
    "deliveryCapability" TEXT,
    "bulkPricingCapability" BOOLEAN NOT NULL DEFAULT false,
    "minimumOrderValue" DECIMAL(12,2),
    "standardLeadTimeDays" INTEGER,
    "taxComplianceStatus" TEXT NOT NULL DEFAULT 'Unknown',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "onboardingChecklist" JSONB,
    "onboardingPercentage" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierUser" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SupplierUserRole" NOT NULL DEFAULT 'READ_ONLY',
    "status" "SupplierOwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "packSize" TEXT,
    "unit" TEXT,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "vatApplicable" BOOLEAN NOT NULL DEFAULT false,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierProductCode" TEXT,
    "supplierProductName" TEXT,
    "barcodePlaceholder" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "vatInclusive" BOOLEAN NOT NULL DEFAULT true,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "availability" TEXT,
    "availableQuantity" INTEGER,
    "minimumOrderQuantity" INTEGER,
    "maximumOrderQuantity" INTEGER,
    "leadTimeDays" INTEGER,
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceEffectiveFrom" TIMESTAMP(3),
    "priceEffectiveTo" TIMESTAMP(3),
    "lastPriceUpdateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fileId" TEXT,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "SupplierDocumentStatus" NOT NULL DEFAULT 'MISSING',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "replacementDocumentId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPriceHistory" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "oldPrice" DECIMAL(12,2) NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "procurementCycleId" TEXT,
    "requestedByUserId" TEXT,
    "submittedByUserId" TEXT,
    "status" "SupplierQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productNameSnapshot" TEXT NOT NULL,
    "packSizeSnapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "availability" TEXT,
    "leadTimeDays" INTEGER,
    "notes" TEXT,

    CONSTRAINT "SupplierQuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "procurementCycleId" TEXT,
    "orderReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Awaiting Confirmation',
    "totalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "packedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "packingNotes" TEXT,
    "deliverySchedule" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrderItem" (
    "id" TEXT NOT NULL,
    "supplierOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productNameSnapshot" TEXT NOT NULL,
    "packSizeSnapshot" TEXT,
    "unitPriceSnapshot" DECIMAL(12,2) NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "centreAllocations" JSONB NOT NULL,
    "packingInstructions" JSONB,

    CONSTRAINT "SupplierOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "procurementCycleId" TEXT,
    "supplierOrderId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(12,2) NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Not Paid',
    "externalInvoiceReference" TEXT,
    "fileAssetId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "recordedByUserId" TEXT,
    "proofOfPaymentFileAssetId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPerformance" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "orderConfirmationRate" INTEGER NOT NULL DEFAULT 0,
    "quotationResponseHours" INTEGER NOT NULL DEFAULT 0,
    "orderFulfilmentRate" INTEGER NOT NULL DEFAULT 0,
    "onTimeDeliveryRate" INTEGER NOT NULL DEFAULT 0,
    "productAvailabilityRate" INTEGER NOT NULL DEFAULT 0,
    "priceCompetitivenessScore" INTEGER NOT NULL DEFAULT 0,
    "invoiceAccuracyRate" INTEGER NOT NULL DEFAULT 0,
    "disputeRate" INTEGER NOT NULL DEFAULT 0,
    "averagePerformanceScore" INTEGER NOT NULL DEFAULT 0,
    "totalMonthlyOrderValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "performanceBand" TEXT NOT NULL DEFAULT 'Needs Improvement',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierNote" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementCycle" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2026,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "deliveryWindowStart" TIMESTAMP(3),
    "deliveryWindowEnd" TIMESTAMP(3),
    "status" "ProcurementCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "supplierId" TEXT,
    "selectedBudget" DECIMAL(12,2) NOT NULL,
    "currentSpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingBudget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "percentageUsed" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvalNotes" TEXT,
    "rejectionNotes" TEXT,
    "budgetOverride" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "packSizeSnapshot" TEXT,
    "brandSnapshot" TEXT,
    "supplierNameSnapshot" TEXT,

    CONSTRAINT "ProcurementOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "fileId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT,
    "procurementCycleId" TEXT,
    "supplierOrderId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "deliveryNote" TEXT,
    "driverPlaceholder" TEXT,
    "vehiclePlaceholder" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "vehicleRegistration" TEXT,
    "deliveryNoteNumber" TEXT,
    "deliveryNotes" TEXT,
    "receivedByName" TEXT,
    "receivedByUserId" TEXT,
    "failureReason" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "fileId" TEXT,
    "signedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorOrganisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisationName" TEXT,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organisationType" TEXT,
    "registrationNumber" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "physicalAddress" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "annualSupportBudget" DECIMAL(12,2),
    "partnershipInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "verificationStatus" TEXT NOT NULL DEFAULT 'Unverified',
    "onboardingChecklist" JSONB,
    "onboardingPercentage" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorOrganisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorUser" (
    "id" TEXT NOT NULL,
    "donorOrganisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PartnerUserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "PartnerOwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "DonorUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnershipRequest" (
    "id" TEXT NOT NULL,
    "donorOrganisationId" TEXT NOT NULL,
    "centreId" TEXT,
    "impactProjectId" TEXT,
    "type" TEXT NOT NULL,
    "requestType" TEXT,
    "message" TEXT,
    "proposedSupportType" TEXT,
    "proposedAmount" DECIMAL(12,2),
    "proposedItems" JSONB,
    "preferredMeetingDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "requestStatus" TEXT,
    "submittedByUserId" TEXT,
    "assignedToUserId" TEXT,
    "adminNotes" TEXT,
    "partnerNotes" TEXT,
    "centreNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactProject" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "fundingProjectId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "category" TEXT NOT NULL,
    "projectType" TEXT,
    "summary" TEXT,
    "fullDescription" TEXT,
    "problemStatement" TEXT,
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportNeeded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requestedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalBudget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountCommitted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingNeed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "numberOfBeneficiaries" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(12,2) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "projectStatus" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'Partner',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "approvedForPartnerPortal" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactReport" (
    "id" TEXT NOT NULL,
    "centreId" TEXT,
    "impactProjectId" TEXT,
    "donorOrganisationId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "reportingPeriodStart" TIMESTAMP(3),
    "reportingPeriodEnd" TIMESTAMP(3),
    "reportType" TEXT,
    "summary" TEXT,
    "beneficiariesReached" INTEGER,
    "childrenReached" INTEGER,
    "staffSupported" INTEGER,
    "activitiesCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "challenges" TEXT,
    "lessonsLearned" TEXT,
    "nextSteps" TEXT,
    "amountAllocated" DECIMAL(12,2),
    "amountUsed" DECIMAL(12,2),
    "remainingAmount" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "visibility" TEXT NOT NULL DEFAULT 'Private',
    "fileId" TEXT,
    "preparedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactProjectNeed" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "needType" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "estimatedUnitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedTotalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "supportType" TEXT NOT NULL DEFAULT 'Financial',
    "fulfilledQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactProjectNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorshipCommitment" (
    "id" TEXT NOT NULL,
    "partnershipRequestId" TEXT,
    "donorOrganisationId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "impactProjectId" TEXT,
    "commitmentType" TEXT NOT NULL,
    "committedAmount" DECIMAL(12,2),
    "committedItems" JSONB,
    "committedServices" JSONB,
    "commitmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedFulfilmentDate" TIMESTAMP(3),
    "fulfilledDate" TIMESTAMP(3),
    "commitmentStatus" TEXT NOT NULL DEFAULT 'Proposed',
    "referenceNumber" TEXT NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorshipCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "impactProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "updateDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "fullUpdate" TEXT,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "beneficiariesReached" INTEGER,
    "amountUsed" DECIMAL(12,2),
    "milestoneStatus" TEXT NOT NULL DEFAULT 'Planned',
    "visibility" TEXT NOT NULL DEFAULT 'Private',
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerBookmark" (
    "id" TEXT NOT NULL,
    "donorOrganisationId" TEXT NOT NULL,
    "userId" TEXT,
    "centreId" TEXT,
    "impactProjectId" TEXT,
    "impactReportId" TEXT,
    "bookmarkType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerEngagement" (
    "id" TEXT NOT NULL,
    "donorOrganisationId" TEXT NOT NULL,
    "userId" TEXT,
    "centreId" TEXT,
    "impactProjectId" TEXT,
    "impactReportId" TEXT,
    "action" TEXT NOT NULL,
    "engagementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "PartnerEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingOrganisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',

    CONSTRAINT "FundingOrganisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingOrganisationUser" (
    "id" TEXT NOT NULL,
    "fundingOrganisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FundingOrganisationUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingCall" (
    "id" TEXT NOT NULL,
    "fundingOrganisationId" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibleRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibleOrganisationTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimumAmount" DECIMAL(12,2),
    "maximumAmount" DECIMAL(12,2),
    "applicationMethod" TEXT,
    "contactEmail" TEXT,
    "externalUrl" TEXT,
    "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingAssessment" (
    "id" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "fundingApplicationId" TEXT,
    "assessorUserId" TEXT,
    "fundingOrganisationId" TEXT,
    "eligibilityScore" INTEGER,
    "complianceScore" INTEGER,
    "projectQualityScore" INTEGER,
    "budgetScore" INTEGER,
    "impactScore" INTEGER,
    "totalScore" INTEGER,
    "score" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Under Review',
    "recommendation" TEXT,
    "notes" TEXT,
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "centreId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "threadType" TEXT,
    "donorOrganisationId" TEXT,
    "centreId" TEXT,
    "partnershipRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderType" "MessageParticipantType" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT,
    "organisationType" TEXT,
    "organisationId" TEXT,
    "queryText" TEXT NOT NULL,
    "queryCategory" TEXT NOT NULL,
    "queryIntent" TEXT,
    "status" "IntelligenceQueryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "responseId" TEXT,

    CONSTRAINT "IntelligenceQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceResponse" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "answerText" TEXT NOT NULL,
    "structuredData" JSONB,
    "confidenceLevel" INTEGER NOT NULL DEFAULT 70,
    "dataFreshnessDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL DEFAULT 'Rules Engine',
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedActions" JSONB,
    "reportFileAssetId" TEXT,
    "proposalDraftId" TEXT,
    "budgetDraftId" TEXT,

    CONSTRAINT "IntelligenceResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceSourceReference" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceInsight" (
    "id" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" "IntelligenceInsightSeverity" NOT NULL DEFAULT 'INFORMATION',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "targetRole" "UserRole",
    "centreId" TEXT,
    "supplierId" TEXT,
    "donorOrganisationId" TEXT,
    "fundingOrganisationId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "status" "IntelligenceInsightStatus" NOT NULL DEFAULT 'NEW',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceRecommendation" (
    "id" TEXT NOT NULL,
    "insightId" TEXT,
    "userId" TEXT,
    "centreId" TEXT,
    "supplierId" TEXT,
    "donorOrganisationId" TEXT,
    "fundingOrganisationId" TEXT,
    "recommendationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "actionRoute" TEXT,
    "status" "IntelligenceRecommendationStatus" NOT NULL DEFAULT 'SUGGESTED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "IntelligenceRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligencePromptTemplate" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresPermission" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligencePromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceProposalDraft" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "projectId" TEXT,
    "fundingCallId" TEXT,
    "title" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "organisationBackground" TEXT,
    "problemStatement" TEXT,
    "projectDescription" TEXT,
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "implementationPlan" TEXT,
    "monitoringAndEvaluation" TEXT,
    "sustainability" TEXT,
    "risks" TEXT,
    "conclusion" TEXT,
    "status" "IntelligenceDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedFromData" JSONB,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceProposalDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceBudgetDraft" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "requestedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "IntelligenceDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceBudgetDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceBudgetDraftItem" (
    "id" TEXT NOT NULL,
    "budgetDraftId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "estimatedUnitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "justification" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,

    CONSTRAINT "IntelligenceBudgetDraftItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clerkSessionId" TEXT,
    "provider" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedRole" "UserRole" NOT NULL,
    "centreId" TEXT,
    "centreRole" "CentreUserRole",
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invitedByUserId" TEXT,
    "acceptedByUserId" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "EcdCentre_slug_key" ON "EcdCentre"("slug");

-- CreateIndex
CREATE INDEX "EcdCentre_slug_idx" ON "EcdCentre"("slug");

-- CreateIndex
CREATE INDEX "EcdCentre_area_region_province_idx" ON "EcdCentre"("area", "region", "province");

-- CreateIndex
CREATE INDEX "CentreUser_userId_status_idx" ON "CentreUser"("userId", "status");

-- CreateIndex
CREATE INDEX "CentreUser_centreId_role_idx" ON "CentreUser"("centreId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CentreUser_centreId_userId_key" ON "CentreUser"("centreId", "userId");

-- CreateIndex
CREATE INDEX "Membership_membershipYear_status_paymentStatus_idx" ON "Membership"("membershipYear", "status", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_centreId_membershipYear_key" ON "Membership"("centreId", "membershipYear");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipInvoice_invoiceNo_key" ON "MembershipInvoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipReceipt_receiptNo_key" ON "MembershipReceipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRequirement_type_key" ON "ComplianceRequirement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRequirement_code_key" ON "ComplianceRequirement"("code");

-- CreateIndex
CREATE INDEX "ComplianceDocument_centreId_status_verificationStatus_idx" ON "ComplianceDocument"("centreId", "status", "verificationStatus");

-- CreateIndex
CREATE INDEX "ComplianceDocument_requirementId_expiryDate_idx" ON "ComplianceDocument"("requirementId", "expiryDate");

-- CreateIndex
CREATE INDEX "FundingProfile_status_readinessScore_idx" ON "FundingProfile"("status", "readinessScore");

-- CreateIndex
CREATE UNIQUE INDEX "FundingProfile_centreId_key" ON "FundingProfile"("centreId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingProject_slug_key" ON "FundingProject"("slug");

-- CreateIndex
CREATE INDEX "FundingProject_status_opportunityType_idx" ON "FundingProject"("status", "opportunityType");

-- CreateIndex
CREATE UNIQUE INDEX "FundingApplication_applicationNumber_key" ON "FundingApplication"("applicationNumber");

-- CreateIndex
CREATE INDEX "FundingApplication_status_submittedAt_idx" ON "FundingApplication"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "FundingApplication_fundingCallId_idx" ON "FundingApplication"("fundingCallId");

-- CreateIndex
CREATE INDEX "FundingChecklistItem_fundingProfileId_category_idx" ON "FundingChecklistItem"("fundingProfileId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");

-- CreateIndex
CREATE INDEX "Supplier_status_taxComplianceStatus_idx" ON "Supplier"("status", "taxComplianceStatus");

-- CreateIndex
CREATE INDEX "Supplier_companyName_idx" ON "Supplier"("companyName");

-- CreateIndex
CREATE INDEX "SupplierUser_userId_status_idx" ON "SupplierUser"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierUser_supplierId_userId_key" ON "SupplierUser"("supplierId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_active_idx" ON "Product"("categoryId", "active");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "SupplierProduct_supplierId_active_idx" ON "SupplierProduct"("supplierId", "active");

-- CreateIndex
CREATE INDEX "SupplierProduct_productId_stockStatus_idx" ON "SupplierProduct"("productId", "stockStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_supplierId_productId_key" ON "SupplierProduct"("supplierId", "productId");

-- CreateIndex
CREATE INDEX "SupplierDocument_supplierId_status_verificationStatus_idx" ON "SupplierDocument"("supplierId", "status", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotation_quotationNumber_key" ON "SupplierQuotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "SupplierQuotation_supplierId_status_idx" ON "SupplierQuotation"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_orderReference_key" ON "SupplierOrder"("orderReference");

-- CreateIndex
CREATE INDEX "SupplierOrder_supplierId_status_idx" ON "SupplierOrder"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key" ON "SupplierInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_paymentStatus_idx" ON "SupplierInvoice"("supplierId", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPerformance_supplierId_period_key" ON "SupplierPerformance"("supplierId", "period");

-- CreateIndex
CREATE INDEX "ProcurementCycle_year_month_idx" ON "ProcurementCycle"("year", "month");

-- CreateIndex
CREATE INDEX "ProcurementCycle_status_idx" ON "ProcurementCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementOrder_orderNumber_key" ON "ProcurementOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "ProcurementOrder_status_submittedAt_idx" ON "ProcurementOrder"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementOrder_centreId_cycleId_key" ON "ProcurementOrder"("centreId", "cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "ProofOfDelivery_deliveryId_key" ON "ProofOfDelivery"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "DonorOrganisation_slug_key" ON "DonorOrganisation"("slug");

-- CreateIndex
CREATE INDEX "DonorOrganisation_status_verificationStatus_idx" ON "DonorOrganisation"("status", "verificationStatus");

-- CreateIndex
CREATE INDEX "DonorOrganisation_type_idx" ON "DonorOrganisation"("type");

-- CreateIndex
CREATE INDEX "DonorUser_userId_status_idx" ON "DonorUser"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DonorUser_donorOrganisationId_userId_key" ON "DonorUser"("donorOrganisationId", "userId");

-- CreateIndex
CREATE INDEX "PartnershipRequest_donorOrganisationId_status_idx" ON "PartnershipRequest"("donorOrganisationId", "status");

-- CreateIndex
CREATE INDEX "PartnershipRequest_centreId_idx" ON "PartnershipRequest"("centreId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactProject_slug_key" ON "ImpactProject"("slug");

-- CreateIndex
CREATE INDEX "ImpactProject_status_featured_idx" ON "ImpactProject"("status", "featured");

-- CreateIndex
CREATE INDEX "ImpactProject_centreId_idx" ON "ImpactProject"("centreId");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorshipCommitment_referenceNumber_key" ON "SponsorshipCommitment"("referenceNumber");

-- CreateIndex
CREATE INDEX "SponsorshipCommitment_donorOrganisationId_commitmentStatus_idx" ON "SponsorshipCommitment"("donorOrganisationId", "commitmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerBookmark_donorOrganisationId_centreId_impactProjectI_key" ON "PartnerBookmark"("donorOrganisationId", "centreId", "impactProjectId", "impactReportId");

-- CreateIndex
CREATE INDEX "PartnerEngagement_donorOrganisationId_action_idx" ON "PartnerEngagement"("donorOrganisationId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "FundingOrganisation_slug_key" ON "FundingOrganisation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FundingOrganisationUser_fundingOrganisationId_userId_key" ON "FundingOrganisationUser"("fundingOrganisationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingCall_referenceNumber_key" ON "FundingCall"("referenceNumber");

-- CreateIndex
CREATE INDEX "FundingCall_type_status_idx" ON "FundingCall"("type", "status");

-- CreateIndex
CREATE INDEX "MessageThread_donorOrganisationId_centreId_idx" ON "MessageThread"("donorOrganisationId", "centreId");

-- CreateIndex
CREATE INDEX "IntelligenceQuery_userId_status_createdAt_idx" ON "IntelligenceQuery"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceQuery_queryCategory_status_idx" ON "IntelligenceQuery"("queryCategory", "status");

-- CreateIndex
CREATE INDEX "IntelligenceQuery_organisationType_organisationId_idx" ON "IntelligenceQuery"("organisationType", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceResponse_queryId_key" ON "IntelligenceResponse"("queryId");

-- CreateIndex
CREATE INDEX "IntelligenceSourceReference_sourceType_sourceId_idx" ON "IntelligenceSourceReference"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "IntelligenceInsight_targetRole_status_severity_idx" ON "IntelligenceInsight"("targetRole", "status", "severity");

-- CreateIndex
CREATE INDEX "IntelligenceInsight_centreId_status_idx" ON "IntelligenceInsight"("centreId", "status");

-- CreateIndex
CREATE INDEX "IntelligenceInsight_supplierId_status_idx" ON "IntelligenceInsight"("supplierId", "status");

-- CreateIndex
CREATE INDEX "IntelligenceInsight_donorOrganisationId_status_idx" ON "IntelligenceInsight"("donorOrganisationId", "status");

-- CreateIndex
CREATE INDEX "IntelligenceInsight_fundingOrganisationId_status_idx" ON "IntelligenceInsight"("fundingOrganisationId", "status");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_status_priority_idx" ON "IntelligenceRecommendation"("status", "priority");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_centreId_status_idx" ON "IntelligenceRecommendation"("centreId", "status");

-- CreateIndex
CREATE INDEX "IntelligencePromptTemplate_role_active_displayOrder_idx" ON "IntelligencePromptTemplate"("role", "active", "displayOrder");

-- CreateIndex
CREATE INDEX "IntelligenceProposalDraft_centreId_status_idx" ON "IntelligenceProposalDraft"("centreId", "status");

-- CreateIndex
CREATE INDEX "IntelligenceBudgetDraft_centreId_status_idx" ON "IntelligenceBudgetDraft"("centreId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_action_entityType_idx" ON "AuditLog"("action", "entityType");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_clerkSessionId_key" ON "Session"("clerkSessionId");

-- CreateIndex
CREATE INDEX "Session_userId_lastSeenAt_idx" ON "Session"("userId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_status_idx" ON "Invitation"("email", "status");

-- CreateIndex
CREATE INDEX "Invitation_centreId_status_idx" ON "Invitation"("centreId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentreUser" ADD CONSTRAINT "CentreUser_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentreUser" ADD CONSTRAINT "CentreUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentrePhoto" ADD CONSTRAINT "CentrePhoto_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentrePhoto" ADD CONSTRAINT "CentrePhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentreNote" ADD CONSTRAINT "CentreNote_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentreActivity" ADD CONSTRAINT "CentreActivity_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvoice" ADD CONSTRAINT "MembershipInvoice_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvoice" ADD CONSTRAINT "MembershipInvoice_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipReceipt" ADD CONSTRAINT "MembershipReceipt_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipReceipt" ADD CONSTRAINT "MembershipReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipReceipt" ADD CONSTRAINT "MembershipReceipt_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ComplianceRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_replacementDocumentId_fkey" FOREIGN KEY ("replacementDocumentId") REFERENCES "ComplianceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProfile" ADD CONSTRAINT "FundingProfile_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProject" ADD CONSTRAINT "FundingProject_fundingProfileId_fkey" FOREIGN KEY ("fundingProfileId") REFERENCES "FundingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingApplication" ADD CONSTRAINT "FundingApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FundingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingApplication" ADD CONSTRAINT "FundingApplication_fundingCallId_fkey" FOREIGN KEY ("fundingCallId") REFERENCES "FundingCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingApplication" ADD CONSTRAINT "FundingApplication_fundingOrganisationId_fkey" FOREIGN KEY ("fundingOrganisationId") REFERENCES "FundingOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiaryList" ADD CONSTRAINT "BeneficiaryList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FundingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiaryList" ADD CONSTRAINT "BeneficiaryList_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FundingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_quotationFileAssetId_fkey" FOREIGN KEY ("quotationFileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProposal" ADD CONSTRAINT "FundingProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FundingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingChecklistItem" ADD CONSTRAINT "FundingChecklistItem_fundingProfileId_fkey" FOREIGN KEY ("fundingProfileId") REFERENCES "FundingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingSupportingDocument" ADD CONSTRAINT "FundingSupportingDocument_fundingProfileId_fkey" FOREIGN KEY ("fundingProfileId") REFERENCES "FundingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingSupportingDocument" ADD CONSTRAINT "FundingSupportingDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingReminder" ADD CONSTRAINT "FundingReminder_fundingProfileId_fkey" FOREIGN KEY ("fundingProfileId") REFERENCES "FundingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingReminder" ADD CONSTRAINT "FundingReminder_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FundingApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUser" ADD CONSTRAINT "SupplierUser_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUser" ADD CONSTRAINT "SupplierUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_replacementDocumentId_fkey" FOREIGN KEY ("replacementDocumentId") REFERENCES "SupplierDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_procurementCycleId_fkey" FOREIGN KEY ("procurementCycleId") REFERENCES "ProcurementCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_procurementCycleId_fkey" FOREIGN KEY ("procurementCycleId") REFERENCES "ProcurementCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrderItem" ADD CONSTRAINT "SupplierOrderItem_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrderItem" ADD CONSTRAINT "SupplierOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_procurementCycleId_fkey" FOREIGN KEY ("procurementCycleId") REFERENCES "ProcurementCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_proofOfPaymentFileAssetId_fkey" FOREIGN KEY ("proofOfPaymentFileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPerformance" ADD CONSTRAINT "SupplierPerformance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierNote" ADD CONSTRAINT "SupplierNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrder" ADD CONSTRAINT "ProcurementOrder_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrder" ADD CONSTRAINT "ProcurementOrder_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ProcurementCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrder" ADD CONSTRAINT "ProcurementOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderItem" ADD CONSTRAINT "ProcurementOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderItem" ADD CONSTRAINT "ProcurementOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_procurementCycleId_fkey" FOREIGN KEY ("procurementCycleId") REFERENCES "ProcurementCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorUser" ADD CONSTRAINT "DonorUser_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorUser" ADD CONSTRAINT "DonorUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnershipRequest" ADD CONSTRAINT "PartnershipRequest_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnershipRequest" ADD CONSTRAINT "PartnershipRequest_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnershipRequest" ADD CONSTRAINT "PartnershipRequest_impactProjectId_fkey" FOREIGN KEY ("impactProjectId") REFERENCES "ImpactProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactProject" ADD CONSTRAINT "ImpactProject_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactProject" ADD CONSTRAINT "ImpactProject_fundingProjectId_fkey" FOREIGN KEY ("fundingProjectId") REFERENCES "FundingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactReport" ADD CONSTRAINT "ImpactReport_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactReport" ADD CONSTRAINT "ImpactReport_impactProjectId_fkey" FOREIGN KEY ("impactProjectId") REFERENCES "ImpactProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactReport" ADD CONSTRAINT "ImpactReport_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactReport" ADD CONSTRAINT "ImpactReport_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactProjectNeed" ADD CONSTRAINT "ImpactProjectNeed_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImpactProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactProjectNeed" ADD CONSTRAINT "ImpactProjectNeed_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorshipCommitment" ADD CONSTRAINT "SponsorshipCommitment_partnershipRequestId_fkey" FOREIGN KEY ("partnershipRequestId") REFERENCES "PartnershipRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorshipCommitment" ADD CONSTRAINT "SponsorshipCommitment_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorshipCommitment" ADD CONSTRAINT "SponsorshipCommitment_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorshipCommitment" ADD CONSTRAINT "SponsorshipCommitment_impactProjectId_fkey" FOREIGN KEY ("impactProjectId") REFERENCES "ImpactProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_impactProjectId_fkey" FOREIGN KEY ("impactProjectId") REFERENCES "ImpactProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBookmark" ADD CONSTRAINT "PartnerBookmark_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBookmark" ADD CONSTRAINT "PartnerBookmark_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBookmark" ADD CONSTRAINT "PartnerBookmark_impactProjectId_fkey" FOREIGN KEY ("impactProjectId") REFERENCES "ImpactProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBookmark" ADD CONSTRAINT "PartnerBookmark_impactReportId_fkey" FOREIGN KEY ("impactReportId") REFERENCES "ImpactReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEngagement" ADD CONSTRAINT "PartnerEngagement_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEngagement" ADD CONSTRAINT "PartnerEngagement_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEngagement" ADD CONSTRAINT "PartnerEngagement_impactProjectId_fkey" FOREIGN KEY ("impactProjectId") REFERENCES "ImpactProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEngagement" ADD CONSTRAINT "PartnerEngagement_impactReportId_fkey" FOREIGN KEY ("impactReportId") REFERENCES "ImpactReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingOrganisationUser" ADD CONSTRAINT "FundingOrganisationUser_fundingOrganisationId_fkey" FOREIGN KEY ("fundingOrganisationId") REFERENCES "FundingOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingOrganisationUser" ADD CONSTRAINT "FundingOrganisationUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingCall" ADD CONSTRAINT "FundingCall_fundingOrganisationId_fkey" FOREIGN KEY ("fundingOrganisationId") REFERENCES "FundingOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingAssessment" ADD CONSTRAINT "FundingAssessment_fundingCallId_fkey" FOREIGN KEY ("fundingCallId") REFERENCES "FundingCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingAssessment" ADD CONSTRAINT "FundingAssessment_fundingApplicationId_fkey" FOREIGN KEY ("fundingApplicationId") REFERENCES "FundingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_partnershipRequestId_fkey" FOREIGN KEY ("partnershipRequestId") REFERENCES "PartnershipRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceQuery" ADD CONSTRAINT "IntelligenceQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceQuery" ADD CONSTRAINT "IntelligenceQuery_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceResponse" ADD CONSTRAINT "IntelligenceResponse_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "IntelligenceQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceResponse" ADD CONSTRAINT "IntelligenceResponse_reportFileAssetId_fkey" FOREIGN KEY ("reportFileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceResponse" ADD CONSTRAINT "IntelligenceResponse_proposalDraftId_fkey" FOREIGN KEY ("proposalDraftId") REFERENCES "IntelligenceProposalDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceResponse" ADD CONSTRAINT "IntelligenceResponse_budgetDraftId_fkey" FOREIGN KEY ("budgetDraftId") REFERENCES "IntelligenceBudgetDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceSourceReference" ADD CONSTRAINT "IntelligenceSourceReference_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "IntelligenceResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceInsight" ADD CONSTRAINT "IntelligenceInsight_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceInsight" ADD CONSTRAINT "IntelligenceInsight_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceInsight" ADD CONSTRAINT "IntelligenceInsight_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceInsight" ADD CONSTRAINT "IntelligenceInsight_fundingOrganisationId_fkey" FOREIGN KEY ("fundingOrganisationId") REFERENCES "FundingOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRecommendation" ADD CONSTRAINT "IntelligenceRecommendation_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "IntelligenceInsight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRecommendation" ADD CONSTRAINT "IntelligenceRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRecommendation" ADD CONSTRAINT "IntelligenceRecommendation_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRecommendation" ADD CONSTRAINT "IntelligenceRecommendation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRecommendation" ADD CONSTRAINT "IntelligenceRecommendation_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRecommendation" ADD CONSTRAINT "IntelligenceRecommendation_fundingOrganisationId_fkey" FOREIGN KEY ("fundingOrganisationId") REFERENCES "FundingOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceProposalDraft" ADD CONSTRAINT "IntelligenceProposalDraft_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceProposalDraft" ADD CONSTRAINT "IntelligenceProposalDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceBudgetDraft" ADD CONSTRAINT "IntelligenceBudgetDraft_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceBudgetDraft" ADD CONSTRAINT "IntelligenceBudgetDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceBudgetDraftItem" ADD CONSTRAINT "IntelligenceBudgetDraftItem_budgetDraftId_fkey" FOREIGN KEY ("budgetDraftId") REFERENCES "IntelligenceBudgetDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
