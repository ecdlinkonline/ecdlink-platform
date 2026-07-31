import { PrismaClient } from "@prisma/client";
import { seededCentres } from "@/lib/centres/seed";
import { seededCentreToDbCreate } from "@/lib/repositories/centres";
import { permissionsForCentreRole } from "@/lib/auth/rbac";
import { seedRolesAndPermissions } from "@/lib/repositories/users";
import { membershipRecords } from "@/lib/membership/data";
import { complianceDocumentTypes, complianceRecords } from "@/lib/compliance/data";
import { requirementCode } from "@/lib/compliance/format";
import { fundingReadinessRecords } from "@/lib/funding/data";
import { checklistStatusFromBoolean, expandedFundingOpportunityTypes } from "@/lib/funding/format";
import { procurementCategories, procurementProducts, centreOrders, calculateCart, getProduct } from "@/lib/procurement/data";
import { supplierProfiles } from "@/lib/supplier/data";
import { impactProjects, partnerOrganisations, projectCategories } from "@/lib/donor/data";
import { defaultPromptTemplates } from "@/lib/intelligence/constants";

const prisma = new PrismaClient();

const seededTotals = {
  centres: 0,
  memberships: 0,
  complianceRequirements: 0,
  complianceDocuments: 0,
  complianceFiles: 0,
  complianceNotifications: 0,
  fundingProfiles: 0,
  fundingCalls: 0,
  fundingProjects: 0,
  fundingProposals: 0,
  fundingBudgets: 0,
  fundingBeneficiaryLists: 0,
  fundingApplications: 0,
  fundingAssessments: 0,
  fundingReminders: 0,
  productCategories: 0,
  products: 0,
  supplierProducts: 0,
  suppliers: 0,
  supplierDocuments: 0,
  supplierPriceHistory: 0,
  supplierQuotations: 0,
  supplierOrders: 0,
  supplierInvoices: 0,
  supplierPayments: 0,
  supplierDeliveries: 0,
  supplierPerformance: 0,
  procurementCycles: 0,
  procurementOrders: 0,
  procurementOrderItems: 0,
  deliveries: 0,
  donorOrganisations: 0,
  impactProjects: 0,
  impactProjectNeeds: 0,
  partnershipRequests: 0,
  sponsorshipCommitments: 0,
  projectUpdates: 0,
  impactReports: 0,
  partnerBookmarks: 0,
  partnerEngagements: 0,
  partnerMessages: 0,
  intelligencePrompts: 0,
  intelligenceQueries: 0,
  intelligenceResponses: 0,
  intelligenceSourceReferences: 0,
  intelligenceInsights: 0,
  intelligenceRecommendations: 0,
  intelligenceProposalDrafts: 0,
  intelligenceBudgetDrafts: 0,
  intelligenceReports: 0,
  users: 0,
  centreUsers: 0,
  supplierUsers: 0,
  donorUsers: 0,
  fundingOrganisations: 0,
  fundingUsers: 0,
  ecdlinkStaffProfiles: 0,
  ecdlinkStaffAssignments: 0
};

function money(value: number) {
  return value.toFixed(2);
}

function membershipStatus(value: string) {
  return value.toUpperCase().replaceAll(" ", "_") as "ACTIVE" | "PENDING" | "EXPIRED" | "OVERDUE" | "CANCELLED";
}

function paymentStatus(value: string) {
  if (value === "Partially Paid") return "PARTIALLY_PAID";
  if (value === "Not Paid") return "NOT_PAID";
  return value.toUpperCase().replaceAll(" ", "_") as "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "NOT_PAID" | "FAILED" | "REFUNDED";
}

async function seedCentres() {
  for (const centre of seededCentres) {
    await prisma.ecdCentre.upsert({
      where: { slug: centre.id },
      update: {
        centreName: centre.centreName,
        contactPerson: centre.contactPerson,
        phone: centre.phoneNumber,
        email: centre.emailAddress,
        updatedAt: new Date()
      },
      create: seededCentreToDbCreate(centre)
    });
    seededTotals.centres += 1;
  }
}

async function upsertUser(input: { clerkUserId: string; email: string; firstName: string; lastName: string; role: "SUPER_ADMIN" | "ECDLINK_STAFF" | "ECD_CENTRE" | "SUPPLIER" | "DONOR" | "FUNDING_ORGANISATION" | "SYSTEM" }) {
  const role = await prisma.role.findUnique({ where: { key: input.role } });
  const user = await prisma.user.upsert({
    where: { clerkUserId: input.clerkUserId },
    update: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      roleId: role?.id,
      status: "ACTIVE"
    },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      roleId: role?.id,
      status: "ACTIVE"
    }
  });
  seededTotals.users += 1;
  return user;
}

async function seedCoreUsers() {
  await upsertUser({ clerkUserId: "seed-super-admin", email: "admin@ecdlink.co.za", firstName: "ECDLink", lastName: "Admin", role: "SUPER_ADMIN" });

  for (const centre of seededCentres.slice(0, 16)) {
    const dbCentre = await prisma.ecdCentre.findUnique({ where: { slug: centre.id } });
    if (!dbCentre) continue;
    const principalName = centre.principalName.split(" ");
    const user = await upsertUser({
      clerkUserId: `seed-principal-${centre.id}`,
      email: `principal.${centre.id}@ecdlink.demo`,
      firstName: principalName[0] ?? "Centre",
      lastName: principalName.slice(1).join(" ") || "Principal",
      role: "ECD_CENTRE"
    });

    await prisma.centreUser.upsert({
      where: { centreId_userId: { centreId: dbCentre.id, userId: user.id } },
      update: { role: "PRINCIPAL", status: "ACTIVE", permissions: permissionsForCentreRole("PRINCIPAL"), isPrimary: true },
      create: { centreId: dbCentre.id, userId: user.id, role: "PRINCIPAL", status: "ACTIVE", permissions: permissionsForCentreRole("PRINCIPAL"), isPrimary: true, title: "Principal" }
    });
    seededTotals.centreUsers += 1;
  }
}

async function seedEcdlinkStaff() {
  const admin = await prisma.user.findUnique({ where: { clerkUserId: "seed-super-admin" } });
  const staffSeeds = [
    {
      clerkUserId: "seed-staff-operations-manager",
      email: "operations.manager@ecdlink.demo",
      firstName: "Naledi",
      lastName: "Mokoena",
      employeeNumber: "ECDL-STAFF-001",
      jobTitle: "Operations Manager",
      department: "OPERATIONS" as const,
      assignmentRole: "Operations Lead"
    },
    {
      clerkUserId: "seed-staff-compliance-officer",
      email: "compliance.officer@ecdlink.demo",
      firstName: "Ayesha",
      lastName: "Peters",
      employeeNumber: "ECDL-STAFF-002",
      jobTitle: "Compliance Officer",
      department: "COMPLIANCE" as const,
      assignmentRole: "Compliance Support"
    },
    {
      clerkUserId: "seed-staff-social-worker",
      email: "social.worker@ecdlink.demo",
      firstName: "Thabo",
      lastName: "Dlamini",
      employeeNumber: "ECDL-STAFF-003",
      jobTitle: "Social Worker",
      department: "FAMILY_SUPPORT" as const,
      assignmentRole: "Family Support"
    },
    {
      clerkUserId: "seed-staff-procurement-officer",
      email: "procurement.officer@ecdlink.demo",
      firstName: "Megan",
      lastName: "Jacobs",
      employeeNumber: "ECDL-STAFF-004",
      jobTitle: "Procurement Officer",
      department: "PROCUREMENT" as const,
      assignmentRole: "Procurement Support"
    }
  ];
  const centres = await prisma.ecdCentre.findMany({ take: 16, orderBy: { centreName: "asc" } });

  for (const [staffIndex, staffSeed] of staffSeeds.entries()) {
    const user = await upsertUser({
      clerkUserId: staffSeed.clerkUserId,
      email: staffSeed.email,
      firstName: staffSeed.firstName,
      lastName: staffSeed.lastName,
      role: "ECDLINK_STAFF"
    });

    const profile = await prisma.ecdlinkStaffProfile.upsert({
      where: { userId: user.id },
      update: {
        employeeNumber: staffSeed.employeeNumber,
        firstName: staffSeed.firstName,
        lastName: staffSeed.lastName,
        jobTitle: staffSeed.jobTitle,
        department: staffSeed.department,
        employmentStatus: "ACTIVE",
        workEmail: staffSeed.email,
        isActive: true
      },
      create: {
        userId: user.id,
        employeeNumber: staffSeed.employeeNumber,
        firstName: staffSeed.firstName,
        lastName: staffSeed.lastName,
        jobTitle: staffSeed.jobTitle,
        department: staffSeed.department,
        employmentStatus: "ACTIVE",
        workEmail: staffSeed.email,
        startDate: new Date("2026-07-01"),
        isActive: true
      }
    });
    seededTotals.ecdlinkStaffProfiles += 1;

    const assignedCentres = centres.filter((_, centreIndex) => centreIndex % staffSeeds.length === staffIndex || centreIndex === staffIndex).slice(0, 6);
    for (const [assignmentIndex, centre] of assignedCentres.entries()) {
      await prisma.ecdlinkStaffCentreAssignment.upsert({
        where: {
          staffProfileId_centreId_assignmentRole: {
            staffProfileId: profile.id,
            centreId: centre.id,
            assignmentRole: staffSeed.assignmentRole
          }
        },
        update: {
          assignedBy: admin?.id,
          isPrimary: assignmentIndex === 0,
          isActive: true,
          notes: `Seeded ${staffSeed.assignmentRole.toLowerCase()} assignment.`
        },
        create: {
          staffProfileId: profile.id,
          centreId: centre.id,
          assignmentRole: staffSeed.assignmentRole,
          assignedBy: admin?.id,
          isPrimary: assignmentIndex === 0,
          isActive: true,
          notes: `Seeded ${staffSeed.assignmentRole.toLowerCase()} assignment.`
        }
      });
      seededTotals.ecdlinkStaffAssignments += 1;
    }
  }
}

async function seedMemberships() {
  for (const record of membershipRecords) {
    const centre = await prisma.ecdCentre.findUnique({ where: { slug: record.centreId } });
    if (!centre) continue;
    const membership = await prisma.membership.upsert({
      where: { id: record.id },
      update: {
        membershipYear: record.membershipYear,
        status: membershipStatus(record.status),
        paymentStatus: paymentStatus(record.paymentStatus),
        amountPaid: money(record.amountPaid),
        balance: money(record.amountOutstanding),
        notes: record.notes
      },
      create: {
        id: record.id,
        centreId: centre.id,
        membershipYear: record.membershipYear,
        annualFee: money(record.annualFee),
        startDate: new Date(record.startDate),
        expiryDate: new Date(record.expiryDate),
        renewalReminderDate: new Date(record.renewalReminderDate),
        renewalDate: new Date(record.renewalReminderDate),
        status: membershipStatus(record.status),
        paymentStatus: paymentStatus(record.paymentStatus),
        amountDue: money(record.annualFee),
        amountPaid: money(record.amountPaid),
        balance: money(record.amountOutstanding),
        notes: record.notes
      }
    });
    await prisma.membershipInvoice.upsert({
      where: { invoiceNo: record.invoiceNumber },
      update: { status: record.invoiceStatus === "Paid" ? "PAID" : record.invoiceStatus === "Sent" ? "SENT" : "GENERATED" },
      create: {
        membershipId: membership.id,
        invoiceNo: record.invoiceNumber,
        amount: money(record.annualFee),
        status: record.invoiceStatus === "Paid" ? "PAID" : record.invoiceStatus === "Sent" ? "SENT" : "GENERATED",
        issuedAt: record.invoiceDate ? new Date(record.invoiceDate) : new Date(record.startDate),
        dueAt: new Date(record.renewalReminderDate)
      }
    });
    if (record.amountPaid > 0) {
      await prisma.membershipPayment.upsert({
        where: { id: `payment-${record.id}` },
        update: {
          amount: money(record.amountPaid),
          status: "PAID",
          paymentMethod: record.paymentMethod ?? "EFT",
          receiptReference: record.receiptNumber ?? `PAY-${record.membershipYear}-${record.id}`,
          paidAt: record.paymentDate ? new Date(record.paymentDate) : new Date(record.startDate)
        },
        create: {
          id: `payment-${record.id}`,
          membershipId: membership.id,
          amount: money(record.amountPaid),
          status: "PAID",
          paymentMethod: record.paymentMethod ?? "EFT",
          receiptReference: record.receiptNumber ?? `PAY-${record.membershipYear}-${record.id}`,
          paidAt: record.paymentDate ? new Date(record.paymentDate) : new Date(record.startDate)
        }
      });
    }
    if (record.receiptNumber) {
      await prisma.membershipReceipt.upsert({
        where: { receiptNo: record.receiptNumber },
        update: { amount: money(record.amountPaid) },
        create: {
          membershipId: membership.id,
          paymentId: `payment-${record.id}`,
          receiptNo: record.receiptNumber,
          amount: money(record.amountPaid),
          issuedAt: record.paymentDate ? new Date(record.paymentDate) : new Date(record.startDate)
        }
      });
    }
    await prisma.ecdCentre.update({ where: { id: centre.id }, data: { membershipStatus: membershipStatus(record.status) } });
    seededTotals.memberships += 1;
  }
}

async function seedCompliance() {
  for (const [index, type] of complianceDocumentTypes.entries()) {
    await prisma.complianceRequirement.upsert({
      where: { type },
      update: {
        name: type,
        code: requirementCode(type),
        category: index < 4 ? "Registration" : index < 8 ? "Governance" : index < 12 ? "Operations" : "Health and Safety",
        required: true,
        requiresExpiryDate: ["NPO", "DBE", "Tax", "Bank", "Fire", "Food"].some((item) => type.includes(item)),
        acceptedFileTypes: ["application/pdf", "image/jpeg", "image/png"],
        maxFileSize: 10_000_000,
        active: true,
        displayOrder: index + 1
      },
      create: {
        type,
        name: type,
        code: requirementCode(type),
        description: `${type} compliance requirement for ECD centre operations.`,
        category: index < 4 ? "Registration" : index < 8 ? "Governance" : index < 12 ? "Operations" : "Health and Safety",
        required: true,
        requiresExpiryDate: ["NPO", "DBE", "Tax", "Bank", "Fire", "Food"].some((item) => type.includes(item)),
        acceptedFileTypes: ["application/pdf", "image/jpeg", "image/png"],
        maxFileSize: 10_000_000,
        active: true,
        displayOrder: index + 1
      }
    });
    seededTotals.complianceRequirements += 1;
  }
  for (const record of complianceRecords) {
    const centre = await prisma.ecdCentre.findUnique({ where: { slug: record.centreId } });
    if (!centre) continue;
    for (const document of record.documents) {
      const requirement = await prisma.complianceRequirement.findUnique({ where: { type: document.type } });
      const file = document.fileName ? await prisma.fileAsset.upsert({
        where: { id: `file-${document.id}` },
        update: {
          originalFilename: document.fileName,
          mimeType: document.fileName.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
          fileSize: 120000
        },
        create: {
          id: `file-${document.id}`,
          storageProvider: "placeholder",
          storageKey: `compliance/${centre.slug}/${document.fileName}`,
          originalFilename: document.fileName,
          mimeType: document.fileName.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
          fileSize: 120000,
          checksum: `seed-${document.id}`
        }
      }) : null;
      if (file) seededTotals.complianceFiles += 1;
      const dbStatus = document.status === "Verified" ? "VERIFIED" : document.status.toUpperCase().replaceAll(" ", "_") as "UPLOADED" | "MISSING" | "EXPIRED" | "EXPIRING_SOON" | "VERIFIED" | "REJECTED";
      const verificationStatus = document.status === "Verified" ? "VERIFIED" : document.status === "Rejected" ? "REJECTED" : document.status === "Missing" ? "PENDING_REVIEW" : "PENDING_REVIEW";
      await prisma.complianceDocument.upsert({
        where: { id: document.id },
        update: {
          requirementId: requirement?.id,
          fileId: file?.id,
          status: dbStatus,
          verificationStatus,
          adminNotes: document.verificationNote,
          rejectionReason: document.status === "Rejected" ? "Document must be replaced with a valid copy." : null,
          expiryDate: document.expiryDate ? new Date(document.expiryDate) : null,
          submittedAt: document.uploadedAt ? new Date(document.uploadedAt) : null
        },
        create: {
          id: document.id,
          centreId: centre.id,
          requirementId: requirement?.id,
          fileId: file?.id,
          documentType: document.type,
          documentNumber: `${requirementCode(document.type)}-${centre.slug}`,
          issueDate: document.uploadedAt ? new Date(document.uploadedAt) : null,
          expiryDate: document.expiryDate ? new Date(document.expiryDate) : null,
          status: dbStatus,
          verificationStatus,
          submittedAt: document.uploadedAt ? new Date(document.uploadedAt) : null,
          verifiedAt: document.status === "Verified" ? new Date("2026-07-10") : null,
          rejectedAt: document.status === "Rejected" ? new Date("2026-07-10") : null,
          rejectionReason: document.status === "Rejected" ? "Document must be replaced with a valid copy." : null,
          adminNotes: document.verificationNote,
          reminderDate: document.reminderDate ? new Date(document.reminderDate) : null
        }
      });
      if (["Missing", "Expired", "Expiring Soon", "Rejected"].includes(document.status)) {
        await prisma.notification.upsert({
          where: { id: `notification-${document.id}` },
          update: { title: `Compliance ${document.status}`, body: `${document.type}: ${document.verificationNote}` },
          create: { id: `notification-${document.id}`, centreId: centre.id, title: `Compliance ${document.status}`, body: `${document.type}: ${document.verificationNote}` }
        });
        seededTotals.complianceNotifications += 1;
      }
      seededTotals.complianceDocuments += 1;
    }
  }
}

async function seedFunding() {
  const fundingOrganisations = await prisma.fundingOrganisation.findMany({ orderBy: { name: "asc" } });
  const defaultOrganisation = fundingOrganisations[0] ?? await prisma.fundingOrganisation.upsert({
    where: { slug: "ecdlink-funding-desk" },
    update: { name: "ECDLink Funding Desk", type: "ECDLink", status: "Active" },
    create: { slug: "ecdlink-funding-desk", name: "ECDLink Funding Desk", type: "ECDLink", status: "Active" }
  });

  for (const [index, type] of expandedFundingOpportunityTypes.entries()) {
    const organisation = fundingOrganisations[index % Math.max(fundingOrganisations.length, 1)] ?? defaultOrganisation;
    await prisma.fundingCall.upsert({
      where: { id: `funding-call-${index + 1}` },
      update: {
        fundingOrganisationId: organisation.id,
        title: `${type} opportunity ${index + 1}`,
        type,
        status: index % 5 === 0 ? "Closing Soon" : "Open",
        featured: index < 4,
        maximumAmount: money(45000 + index * 12000),
        closesAt: new Date(2026, 8 + (index % 4), 15)
      },
      create: {
        id: `funding-call-${index + 1}`,
        fundingOrganisationId: organisation.id,
        referenceNumber: `FC-2026-${String(index + 1).padStart(3, "0")}`,
        title: `${type} opportunity ${index + 1}`,
        type,
        description: `Seeded ${type.toLowerCase()} call for ECDLink centre funding readiness and application tracking.`,
        focusAreas: [type.replace(" funding", ""), index % 2 === 0 ? "ECD nutrition" : "Centre operations"],
        eligibleRegions: ["Cape Flats", "Khayelitsha", "Mitchells Plain", "Gugulethu"],
        eligibleOrganisationTypes: ["ECD Centre", "NPO", "Community organisation"],
        minimumAmount: money(5000),
        maximumAmount: money(45000 + index * 12000),
        applicationMethod: "ECDLink application pack placeholder",
        contactEmail: "funding@ecdlink.demo",
        requiredDocuments: ["NPO Certificate", "Budget", "Project Proposal", "Beneficiary List"],
        featured: index < 4,
        opensAt: new Date(2026, 6, 1),
        closesAt: new Date(2026, 8 + (index % 4), 15),
        publishedAt: new Date(2026, 6, 1),
        status: index % 5 === 0 ? "Closing Soon" : "Open"
      }
    });
    seededTotals.fundingCalls += 1;
  }

  const fundingCalls = await prisma.fundingCall.findMany({ orderBy: { id: "asc" } });

  for (const record of fundingReadinessRecords) {
    const centre = await prisma.ecdCentre.findUnique({ where: { slug: record.centreId } });
    if (!centre) continue;
    const readinessStatus = record.readinessScore >= 80 ? "READY" : record.readinessScore >= 50 ? "IN_PROGRESS" : "NEEDS_ATTENTION";
    const profile = await prisma.fundingProfile.upsert({
      where: { id: record.id },
      update: {
        centreId: centre.id,
        readinessScore: record.readinessScore,
        status: record.status.toUpperCase().replaceAll(" ", "_") as "DRAFT" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "APPROVED" | "REJECTED",
        readinessStatus,
        proposalReady: record.applicationChecklist[0]?.complete ?? false,
        budgetReady: record.applicationChecklist[1]?.complete ?? false,
        beneficiaryListReady: record.applicationChecklist[2]?.complete ?? false,
        supportingDocsReady: record.supportingDocuments.every((item) => item.complete),
        missingRequirements: [...record.applicationChecklist, ...record.supportingDocuments].filter((item) => !item.complete).map((item) => item.label),
        recommendedActions: record.adminNotes,
        adminNotes: record.adminNotes.join("\n"),
        lastAssessmentDate: new Date(record.lastUpdatedAt),
        nextReviewDate: new Date(2026, 7, 30)
      },
      create: {
        id: record.id,
        centreId: centre.id,
        readinessScore: record.readinessScore,
        status: record.status.toUpperCase().replaceAll(" ", "_") as "DRAFT" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "APPROVED" | "REJECTED",
        readinessStatus,
        proposalReady: record.applicationChecklist[0]?.complete ?? false,
        budgetReady: record.applicationChecklist[1]?.complete ?? false,
        beneficiaryListReady: record.applicationChecklist[2]?.complete ?? false,
        supportingDocsReady: record.supportingDocuments.every((item) => item.complete),
        missingRequirements: [...record.applicationChecklist, ...record.supportingDocuments].filter((item) => !item.complete).map((item) => item.label),
        recommendedActions: record.adminNotes,
        adminNotes: record.adminNotes.join("\n"),
        lastAssessmentDate: new Date(record.lastUpdatedAt),
        nextReviewDate: new Date(2026, 7, 30)
      }
    });

    for (const [index, item] of record.applicationChecklist.entries()) {
      await prisma.fundingChecklistItem.upsert({
        where: { id: item.id },
        update: { fundingProfileId: profile.id, label: item.label, status: checklistStatusFromBoolean(item.complete), note: item.note, displayOrder: index + 1 },
        create: { id: item.id, fundingProfileId: profile.id, category: "Application", label: item.label, status: checklistStatusFromBoolean(item.complete), note: item.note, displayOrder: index + 1 }
      });
    }

    for (const [index, item] of record.supportingDocuments.entries()) {
      await prisma.fundingSupportingDocument.upsert({
        where: { id: item.id },
        update: { fundingProfileId: profile.id, label: item.label, documentType: item.label, status: checklistStatusFromBoolean(item.complete), note: item.note },
        create: { id: item.id, fundingProfileId: profile.id, label: item.label, documentType: item.label, status: checklistStatusFromBoolean(item.complete), note: item.note, uploadedAt: item.complete ? new Date(record.lastUpdatedAt) : null }
      });
    }

    for (const [projectIndex, project] of record.projectProfiles.entries()) {
      const dbProject = await prisma.fundingProject.upsert({
        where: { id: project.id },
        update: {
          fundingProfileId: profile.id,
          opportunityType: project.opportunityType,
          funderType: project.funderType,
          requestedAmount: money(project.requestedAmount),
          fundingGap: money(project.requestedAmount),
          beneficiaries: project.beneficiaries,
          status: project.status.toUpperCase().replaceAll(" ", "_") as "DRAFT" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "APPROVED" | "REJECTED",
          objective: project.objective
        },
        create: {
          id: project.id,
          fundingProfileId: profile.id,
          title: project.title,
          slug: `${project.id}-slug`,
          opportunityType: project.opportunityType,
          funderType: project.funderType,
          summary: project.objective,
          objective: project.objective,
          problemStatement: `${centre.centreName} needs targeted support to strengthen early learning outcomes.`,
          expectedOutcomes: ["Improved centre operations", "Better child learning environment", "Stronger reporting pack"],
          requiredItems: ["Proposal", "Budget", "Beneficiary list", "Supporting documents"],
          requestedAmount: money(project.requestedAmount),
          fundingGap: money(project.requestedAmount),
          beneficiaries: project.beneficiaries,
          startDate: new Date(2026, 8, 1),
          endDate: new Date(2027, 1, 28),
          status: project.status.toUpperCase().replaceAll(" ", "_") as "DRAFT" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "APPROVED" | "REJECTED",
          visibility: projectIndex === 0 ? "Partner Portal" : "Internal",
          approvedForPartnerPortal: projectIndex === 0 && record.readinessScore >= 65
        }
      });
      seededTotals.fundingProjects += 1;

      await prisma.fundingProposal.upsert({
        where: { id: `proposal-${project.id}` },
        update: { title: `${project.title} proposal`, status: dbProject.status },
        create: { id: `proposal-${project.id}`, projectId: dbProject.id, title: `${project.title} proposal`, executiveSummary: project.objective, problemStatement: `${centre.centreName} requires support aligned to ${project.funderType}.`, projectPlan: "Project plan placeholder for guided proposal builder.", impactStatement: `${project.beneficiaries} children will benefit.`, status: dbProject.status, version: 1 }
      });
      seededTotals.fundingProposals += 1;

      const budget = await prisma.budget.upsert({
        where: { id: `budget-${project.id}` },
        update: { total: money(project.requestedAmount), requestedAmount: money(project.requestedAmount), status: project.status },
        create: { id: `budget-${project.id}`, projectId: dbProject.id, title: `${project.title} budget`, total: money(project.requestedAmount), requestedAmount: money(project.requestedAmount), status: project.status }
      });
      seededTotals.fundingBudgets += 1;

      const budgetItems = [
        { label: "Programme materials", category: "Materials", quantity: 1, unitCost: project.requestedAmount * 0.35 },
        { label: "Operational support", category: "Operations", quantity: 1, unitCost: project.requestedAmount * 0.4 },
        { label: "Monitoring and reporting", category: "Reporting", quantity: 1, unitCost: project.requestedAmount * 0.25 }
      ];
      for (const [itemIndex, item] of budgetItems.entries()) {
        await prisma.budgetItem.upsert({
          where: { id: `budget-item-${project.id}-${itemIndex}` },
          update: { unitCost: money(item.unitCost), lineTotal: money(item.quantity * item.unitCost) },
          create: { id: `budget-item-${project.id}-${itemIndex}`, budgetId: budget.id, label: item.label, category: item.category, quantity: item.quantity, unitCost: money(item.unitCost), lineTotal: money(item.quantity * item.unitCost), displayOrder: itemIndex + 1 }
        });
      }

      await prisma.beneficiaryList.upsert({
        where: { id: `beneficiaries-${project.id}` },
        update: { count: project.beneficiaries, boysCount: Math.round(project.beneficiaries * 0.49), girlsCount: Math.round(project.beneficiaries * 0.51) },
        create: { id: `beneficiaries-${project.id}`, projectId: dbProject.id, name: `${centre.centreName} beneficiary list`, count: project.beneficiaries, beneficiaryType: "Children", reportingPeriod: "2026", boysCount: Math.round(project.beneficiaries * 0.49), girlsCount: Math.round(project.beneficiaries * 0.51), notes: "Seeded beneficiary list placeholder." }
      });
      seededTotals.fundingBeneficiaryLists += 1;

      if (seededTotals.fundingApplications < 24 && (record.status !== "Draft" || projectIndex === 0)) {
        const call = fundingCalls[seededTotals.fundingApplications % fundingCalls.length];
        const appStatus = project.status === "Ready" ? "SUBMITTED" : project.status.toUpperCase().replaceAll(" ", "_") as "DRAFT" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "APPROVED" | "REJECTED";
        const application = await prisma.fundingApplication.upsert({
          where: { id: `application-${project.id}` },
          update: { status: appStatus, requestedAmount: money(project.requestedAmount), fundingCallId: call?.id, fundingOrganisationId: call?.fundingOrganisationId },
          create: {
            id: `application-${project.id}`,
            projectId: dbProject.id,
            fundingCallId: call?.id,
            fundingOrganisationId: call?.fundingOrganisationId,
            applicationNumber: `FA-2026-${String(seededTotals.fundingApplications + 1).padStart(4, "0")}`,
            requestedAmount: money(project.requestedAmount),
            readinessScoreAtSubmission: record.readinessScore,
            submissionMethod: "ECDLink funding desk",
            status: appStatus,
            submittedAt: ["SUBMITTED", "APPROVED", "REJECTED"].includes(appStatus) ? new Date(record.lastUpdatedAt) : null,
            decidedAt: ["APPROVED", "REJECTED"].includes(appStatus) ? new Date(2026, 6, 20) : null,
            decisionDate: ["APPROVED", "REJECTED"].includes(appStatus) ? new Date(2026, 6, 20) : null,
            notes: "Seeded funding application for readiness tracking."
          }
        });
        seededTotals.fundingApplications += 1;

        if (call) {
          const totalScore = Math.min(95, Math.max(35, record.readinessScore + (projectIndex * 3)));
          await prisma.fundingAssessment.upsert({
            where: { id: `assessment-${application.id}` },
            update: { score: totalScore, totalScore, status: "Assessed" },
            create: { id: `assessment-${application.id}`, fundingCallId: call.id, fundingApplicationId: application.id, fundingOrganisationId: call.fundingOrganisationId, eligibilityScore: totalScore, complianceScore: Math.max(30, totalScore - 5), projectQualityScore: totalScore, budgetScore: Math.max(30, totalScore - 3), impactScore: Math.min(100, totalScore + 4), totalScore, score: totalScore, status: "Assessed", recommendation: totalScore >= 75 ? "Recommended" : "Needs revision", notes: "Seeded assessment placeholder.", assessedAt: new Date(2026, 6, 21) }
          });
          seededTotals.fundingAssessments += 1;
        }
      }
    }

    if (record.readinessScore < 80) {
      await prisma.fundingReminder.upsert({
        where: { id: `funding-reminder-${profile.id}` },
        update: { title: "Funding readiness follow-up", body: `${centre.centreName} needs support to complete funding readiness actions.` },
        create: { id: `funding-reminder-${profile.id}`, fundingProfileId: profile.id, title: "Funding readiness follow-up", body: `${centre.centreName} needs support to complete funding readiness actions.`, dueAt: new Date(2026, 7, 30) }
      });
      await prisma.notification.upsert({
        where: { id: `notification-funding-${profile.id}` },
        update: { title: "Funding readiness action required", body: `${centre.centreName} has outstanding funding readiness items.` },
        create: { id: `notification-funding-${profile.id}`, centreId: centre.id, title: "Funding readiness action required", body: `${centre.centreName} has outstanding funding readiness items.` }
      });
      seededTotals.fundingReminders += 1;
    }

    await prisma.auditLog.upsert({
      where: { id: `audit-funding-${profile.id}` },
      update: { action: "funding.profile.seed", entityType: "FundingProfile", entityId: profile.id, metadata: { readinessScore: record.readinessScore } },
      create: { id: `audit-funding-${profile.id}`, action: "funding.profile.seed", entityType: "FundingProfile", entityId: profile.id, metadata: { readinessScore: record.readinessScore } }
    });
    seededTotals.fundingProfiles += 1;
  }
}

async function seedProductsAndSuppliers() {
  for (const category of procurementCategories) {
    await prisma.productCategory.upsert({ where: { slug: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") }, update: {}, create: { name: category, slug: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") } });
    seededTotals.productCategories += 1;
  }
  const supplierStatuses = ["Approved", "Approved", "Approved", "Pending", "Under Review", "Suspended", "Approved", "Rejected", "Approved", "Archived"];
  const taxStatuses = ["Compliant", "Compliant", "Expiring Soon", "Pending Verification", "Unknown", "Expired", "Compliant", "Rejected", "Compliant", "Compliant"];
  for (const [supplierIndex, supplier] of supplierProfiles.entries()) {
    const onboardingChecklist = {
      businessDetailsComplete: true,
      contactDetailsComplete: true,
      bankingDetailsPlaceholderComplete: supplierIndex % 3 !== 0,
      taxComplianceComplete: taxStatuses[supplierIndex] === "Compliant",
      productCategoriesSelected: true,
      deliveryAreasSelected: supplier.areasServed.length > 0,
      priceListUploadedPlaceholder: supplierIndex % 2 === 0,
      agreementAccepted: supplierIndex % 4 !== 0,
      adminReviewComplete: supplierStatuses[supplierIndex] === "Approved"
    };
    const onboardingPercentage = Math.round((Object.values(onboardingChecklist).filter(Boolean).length / Object.values(onboardingChecklist).length) * 100);
    const dbSupplier = await prisma.supplier.upsert({
      where: { slug: supplier.id },
      update: {
        companyName: supplier.companyName,
        deliveryCapability: supplier.deliveryCapability,
        bulkPricingCapability: supplier.bulkPricing,
        taxComplianceStatus: taxStatuses[supplierIndex],
        status: supplierStatuses[supplierIndex],
        onboardingChecklist,
        onboardingPercentage
      },
      create: {
        companyName: supplier.companyName,
        slug: supplier.id,
        registrationNumber: supplier.registrationNumber,
        vatNumber: `VAT-${String(4000000000 + supplierIndex)}`,
        taxNumber: `TAX-${String(9000000000 + supplierIndex)}`,
        contactPerson: supplier.contactPerson,
        phone: supplier.phoneNumber,
        alternativePhone: `021 555 ${String(2000 + supplierIndex)}`,
        email: supplier.emailAddress,
        website: `https://${supplier.id}.demo`,
        physicalAddress: supplier.physicalAddress,
        suburb: supplier.areasServed[0],
        city: "Cape Town",
        province: "Western Cape",
        postalCode: String(7700 + supplierIndex),
        areasServed: supplier.areasServed,
        deliveryCapability: supplier.deliveryCapability,
        bulkPricingCapability: supplier.bulkPricing,
        minimumOrderValue: money(500 + supplierIndex * 250),
        standardLeadTimeDays: 2 + (supplierIndex % 5),
        taxComplianceStatus: taxStatuses[supplierIndex],
        status: supplierStatuses[supplierIndex],
        onboardingChecklist,
        onboardingPercentage,
        approvedAt: supplierStatuses[supplierIndex] === "Approved" ? new Date("2026-07-05") : null,
        suspendedAt: supplierStatuses[supplierIndex] === "Suspended" ? new Date("2026-07-06") : null,
        suspensionReason: supplierStatuses[supplierIndex] === "Suspended" ? "Seeded suspension for review." : null,
        archivedAt: supplierStatuses[supplierIndex] === "Archived" ? new Date("2026-07-08") : null
      }
    });
    const supplierRoles = ["OWNER", "ADMINISTRATOR", "SALES", "FINANCE", "LOGISTICS", "CATALOGUE_MANAGER", "READ_ONLY"] as const;
    const userCount = supplierIndex < 5 ? 2 : 1;
    for (let userIndex = 0; userIndex < userCount; userIndex++) {
      const role = supplierRoles[(supplierIndex + userIndex) % supplierRoles.length];
      const user = await upsertUser({
        clerkUserId: `seed-supplier-${supplier.id}-${userIndex + 1}`,
        email: `supplier.${supplier.id}.${userIndex + 1}@ecdlink.demo`,
        firstName: supplier.contactPerson.split(" ")[0] ?? "Supplier",
        lastName: userIndex === 0 ? supplier.contactPerson.split(" ").slice(1).join(" ") || "Owner" : role.toLowerCase().replace("_", " "),
        role: "SUPPLIER"
      });
      await prisma.supplierUser.upsert({
        where: { supplierId_userId: { supplierId: dbSupplier.id, userId: user.id } },
        update: { role, status: "ACTIVE", isPrimary: userIndex === 0 },
        create: { supplierId: dbSupplier.id, userId: user.id, role, status: "ACTIVE", permissions: role === "READ_ONLY" ? ["supplier.read"] : ["supplier.read", "supplier.manage", "catalogue.manage", "orders.manage", "deliveries.manage", "finance.manage", "quotations.manage"], isPrimary: userIndex === 0 }
      });
      seededTotals.supplierUsers += 1;
    }
    seededTotals.suppliers += 1;
  }
  for (const [index, product] of procurementProducts.entries()) {
    const category = await prisma.productCategory.findUnique({ where: { slug: product.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") } });
    if (!category) continue;
    const dbProduct = await prisma.product.upsert({
      where: { id: product.id },
      update: {
        sku: `ECDL-${String(index + 1).padStart(5, "0")}`,
        currentPrice: money(product.price),
        stockStatus: product.availability === "Low Stock" ? "LOW_STOCK" : product.availability === "Out of Stock" ? "OUT_OF_STOCK" : "AVAILABLE"
      },
      create: {
        id: product.id,
        sku: `ECDL-${String(index + 1).padStart(5, "0")}`,
        categoryId: category.id,
        name: product.name,
        description: `${product.name} for monthly ECD centre procurement.`,
        brand: product.supplierBrand,
        packSize: product.packSize,
        unit: product.packSize.includes("kg") ? "kg" : product.packSize.includes("pack") ? "pack" : "unit",
        currentPrice: money(product.price),
        vatApplicable: index % 3 === 0,
        stockStatus: product.availability === "Low Stock" ? "LOW_STOCK" : product.availability === "Out of Stock" ? "OUT_OF_STOCK" : "AVAILABLE"
      }
    });
    const supplier = await prisma.supplier.findUnique({ where: { slug: supplierProfiles[index % supplierProfiles.length].id } });
    if (supplier) {
      const supplierProduct = await prisma.supplierProduct.upsert({
        where: { supplierId_productId: { supplierId: supplier.id, productId: dbProduct.id } },
        update: {
          unitPrice: money(product.price),
          supplierProductName: product.name,
          availability: product.availability,
          stockStatus: product.availability === "Low Stock" ? "LOW_STOCK" : product.availability === "Out of Stock" ? "OUT_OF_STOCK" : "AVAILABLE",
          availableQuantity: 50 + (index % 80),
          minimumOrderQuantity: 1 + (index % 5),
          maximumOrderQuantity: 250,
          leadTimeDays: 2 + (index % 5),
          deliveryAvailable: true,
          active: true,
          supplierProductCode: `SUP-${String(index + 1).padStart(5, "0")}`,
          barcodePlaceholder: `600000${String(index + 1).padStart(6, "0")}`
        },
        create: {
          supplierId: supplier.id,
          productId: dbProduct.id,
          unitPrice: money(product.price),
          supplierProductName: product.name,
          availability: product.availability,
          stockStatus: product.availability === "Low Stock" ? "LOW_STOCK" : product.availability === "Out of Stock" ? "OUT_OF_STOCK" : "AVAILABLE",
          availableQuantity: 50 + (index % 80),
          minimumOrderQuantity: 1 + (index % 5),
          maximumOrderQuantity: 250,
          leadTimeDays: 2 + (index % 5),
          deliveryAvailable: true,
          active: true,
          priceEffectiveFrom: new Date("2026-07-01"),
          supplierProductCode: `SUP-${String(index + 1).padStart(5, "0")}`,
          barcodePlaceholder: `600000${String(index + 1).padStart(6, "0")}`
        }
      });
      await prisma.supplierPriceHistory.upsert({
        where: { id: `price-history-${dbProduct.id}` },
        update: { oldPrice: money(Math.max(1, product.price - 3)), newPrice: money(product.price), effectiveDate: new Date("2026-07-01") },
        create: { id: `price-history-${dbProduct.id}`, supplierProductId: supplierProduct.id, oldPrice: money(Math.max(1, product.price - 3)), newPrice: money(product.price), effectiveDate: new Date("2026-07-01"), reason: "Seeded catalogue price load" }
      });
      seededTotals.supplierPriceHistory += 1;
      seededTotals.supplierProducts += 1;
    }
    seededTotals.products += 1;
  }
}

async function seedProcurement() {
  const cycle = await prisma.procurementCycle.upsert({
    where: { id: "cycle-2026-07" },
    update: { month: "July", year: 2026, status: "OPEN" },
    create: {
      id: "cycle-2026-07",
      month: "July",
      year: 2026,
      opensAt: new Date("2026-07-01"),
      closesAt: new Date("2026-07-17"),
      deliveryWindowStart: new Date("2026-07-20"),
      deliveryWindowEnd: new Date("2026-07-31"),
      status: "OPEN"
    }
  });
  seededTotals.procurementCycles += 1;
  const statuses = ["AWAITING_APPROVAL", "APPROVED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;
  const deliveryStatuses = ["PENDING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;
  for (const [index, centreSeed] of seededCentres.slice(0, 16).entries()) {
    const centre = await prisma.ecdCentre.findUnique({ where: { slug: centreSeed.id } });
    if (!centre) continue;
    const budget = [2000, 3000, 5000, 8000, 10000][index % 5];
    const items = Array.from({ length: 13 }, (_, itemIndex) => {
      const product = procurementProducts[(index * 7 + itemIndex) % procurementProducts.length];
      return { productId: product.id, quantity: 1 + ((index + itemIndex) % 4) };
    });
    const totals = calculateCart(items);
    const status = statuses[index % statuses.length];
    const orderNumber = `ECD-2026-07-${String(index + 1).padStart(4, "0")}`;
    const dbOrder = await prisma.procurementOrder.upsert({
      where: { centreId_cycleId: { centreId: centre.id, cycleId: cycle.id } },
      update: {
        orderNumber,
        selectedBudget: money(budget),
        currentSpend: money(totals.total),
        remainingBudget: money(budget - totals.total),
        percentageUsed: Math.round((totals.total / budget) * 100),
        status
      },
      create: {
        orderNumber,
        centreId: centre.id,
        cycleId: cycle.id,
        selectedBudget: money(budget),
        currentSpend: money(totals.total),
        remainingBudget: money(budget - totals.total),
        percentageUsed: Math.round((totals.total / budget) * 100),
        subtotal: money(totals.subtotal),
        total: money(totals.total),
        status,
        approvalNotes: status === "APPROVED" ? "Approved for supplier consolidation." : null,
        rejectionNotes: status === "CANCELLED" ? "Cancelled seed sample." : null,
        budgetOverride: totals.total > budget,
        submittedAt: new Date(`2026-07-${String(2 + (index % 10)).padStart(2, "0")}`)
      }
    });
    await prisma.invoice.upsert({
      where: { invoiceNo: `INV-ECD-2026-07-${String(index + 1).padStart(4, "0")}` },
      update: { amount: money(totals.total), status: status === "DELIVERED" ? "PAID" : "GENERATED" },
      create: { invoiceNo: `INV-ECD-2026-07-${String(index + 1).padStart(4, "0")}`, orderId: dbOrder.id, amount: money(totals.total), status: status === "DELIVERED" ? "PAID" : "GENERATED" }
    });
    const deliveryStatus = deliveryStatuses[index % deliveryStatuses.length];
    await prisma.delivery.upsert({
      where: { id: `delivery-${dbOrder.id}` },
      update: { status: deliveryStatus },
      create: { id: `delivery-${dbOrder.id}`, orderId: dbOrder.id, status: deliveryStatus, notes: "Seed delivery tracking sample.", deliveryNote: "Delivery note placeholder", driverPlaceholder: "Driver placeholder", vehiclePlaceholder: "Vehicle placeholder" }
    });
    seededTotals.deliveries += 1;
    for (const item of items) {
      const product = getProduct(item.productId);
      await prisma.procurementOrderItem.upsert({
        where: { id: `${dbOrder.id}-${item.productId}` },
        update: { quantity: item.quantity, lineTotal: money(product.price * item.quantity) },
        create: { id: `${dbOrder.id}-${item.productId}`, orderId: dbOrder.id, productId: product.id, unitPrice: money(product.price), quantity: item.quantity, lineTotal: money(product.price * item.quantity), productNameSnapshot: product.name, packSizeSnapshot: product.packSize, brandSnapshot: product.supplierBrand, supplierNameSnapshot: product.supplierBrand }
      });
      seededTotals.procurementOrderItems += 1;
    }
    seededTotals.procurementOrders += 1;
  }
}

async function seedSupplierOperations() {
  const suppliers = await prisma.supplier.findMany({ include: { products: { include: { product: { include: { category: true } } } } }, orderBy: { companyName: "asc" } });
  const cycle = await prisma.procurementCycle.findUnique({ where: { id: "cycle-2026-07" } });
  const approvedOrders = await prisma.procurementOrder.findMany({ where: { status: { in: ["APPROVED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] } }, include: { centre: true, items: { include: { product: true } } } });
  const documentTypes = ["Company registration", "Tax compliance PIN", "VAT certificate", "B-BBEE affidavit or certificate", "Bank confirmation letter", "Proof of address", "Food safety certificate", "Product catalogue", "Price list", "Insurance placeholder", "Supplier agreement"];
  const quotationStatuses = ["REQUESTED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"] as const;
  const supplierOrderStatuses = ["Awaiting Confirmation", "Confirmed", "Processing", "Packed", "Ready for Dispatch", "Out for Delivery", "Delivered", "Cancelled"] as const;
  const invoiceStatuses = ["Not Paid", "Partially Paid", "Paid", "Overdue", "Disputed"] as const;

  for (const [supplierIndex, supplier] of suppliers.entries()) {
    for (const [docIndex, documentType] of documentTypes.entries()) {
      const file = await prisma.fileAsset.upsert({
        where: { id: `supplier-file-${supplier.slug}-${docIndex}` },
        update: { originalFilename: `${supplier.slug}-${documentType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf` },
        create: { id: `supplier-file-${supplier.slug}-${docIndex}`, storageProvider: "placeholder", storageKey: `suppliers/${supplier.slug}/${docIndex}.pdf`, originalFilename: `${supplier.slug}-${documentType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`, mimeType: "application/pdf", fileSize: 140000, checksum: `seed-supplier-${supplier.slug}-${docIndex}` }
      });
      const status = docIndex % 7 === 0 ? "EXPIRING_SOON" : docIndex % 6 === 0 ? "REJECTED" : docIndex % 5 === 0 ? "PENDING_REVIEW" : "VERIFIED";
      await prisma.supplierDocument.upsert({
        where: { id: `supplier-doc-${supplier.slug}-${docIndex}` },
        update: { status, verificationStatus: status === "VERIFIED" ? "VERIFIED" : status === "REJECTED" ? "REJECTED" : "PENDING_REVIEW", fileId: file.id },
        create: { id: `supplier-doc-${supplier.slug}-${docIndex}`, supplierId: supplier.id, fileId: file.id, documentType, documentNumber: `SUP-${docIndex}-${supplier.slug}`, issueDate: new Date("2026-01-10"), expiryDate: docIndex % 3 === 0 ? new Date("2026-08-15") : new Date("2027-01-15"), status, verificationStatus: status === "VERIFIED" ? "VERIFIED" : status === "REJECTED" ? "REJECTED" : "PENDING_REVIEW", submittedAt: new Date("2026-07-02"), verifiedAt: status === "VERIFIED" ? new Date("2026-07-05") : null, rejectionReason: status === "REJECTED" ? "Seeded rejection requiring replacement." : null }
      });
      seededTotals.supplierDocuments += 1;
    }

    const quoteItems = supplier.products.slice(0, 5);
    const quoteSubtotal = quoteItems.reduce((sum, item) => sum + Number(item.unitPrice) * (10 + supplierIndex), 0);
    const quote = await prisma.supplierQuotation.upsert({
      where: { quotationNumber: `ECDL-QUO-2026-${String(supplierIndex + 1).padStart(4, "0")}` },
      update: { status: quotationStatuses[supplierIndex % quotationStatuses.length], totalAmount: money(quoteSubtotal * 1.15) },
      create: {
        quotationNumber: `ECDL-QUO-2026-${String(supplierIndex + 1).padStart(4, "0")}`,
        supplierId: supplier.id,
        procurementCycleId: cycle?.id,
        status: quotationStatuses[supplierIndex % quotationStatuses.length],
        validFrom: new Date("2026-07-01"),
        validUntil: new Date("2026-07-31"),
        subtotal: money(quoteSubtotal),
        vatAmount: money(quoteSubtotal * 0.15),
        totalAmount: money(quoteSubtotal * 1.15),
        submittedAt: supplierIndex % 2 === 0 ? new Date("2026-07-03") : null,
        approvedAt: quotationStatuses[supplierIndex % quotationStatuses.length] === "APPROVED" ? new Date("2026-07-04") : null,
        rejectionReason: quotationStatuses[supplierIndex % quotationStatuses.length] === "REJECTED" ? "Seeded quotation comparison rejection." : null,
        items: { create: quoteItems.map((item) => ({ productId: item.productId, productNameSnapshot: item.product.name, packSizeSnapshot: item.product.packSize, quantity: 10 + supplierIndex, unitPrice: item.unitPrice, lineTotal: money(Number(item.unitPrice) * (10 + supplierIndex)), availability: item.availability, leadTimeDays: item.leadTimeDays })) }
      }
    });
    seededTotals.supplierQuotations += 1;

    const supplierProducts = supplier.products.slice(0, 6);
    if (!supplierProducts.length) continue;
    const allocations = supplierProducts.map((supplierProduct, productIndex) => {
      const matchingOrders = approvedOrders.slice(productIndex, productIndex + 4);
      const centreAllocations = matchingOrders.map((order, allocationIndex) => ({ centreName: order.centre.centreName, quantity: 2 + allocationIndex + productIndex, packingNote: `Pack separately for ${order.centre.centreName}` }));
      const totalQuantity = centreAllocations.reduce((sum, item) => sum + item.quantity, 0);
      return { supplierProduct, centreAllocations, totalQuantity, lineTotal: totalQuantity * Number(supplierProduct.unitPrice) };
    });
    const orderTotal = allocations.reduce((sum, item) => sum + item.lineTotal, 0);
    const supplierOrder = await prisma.supplierOrder.upsert({
      where: { orderReference: `ECDL-SO-2026-${String(supplierIndex + 1).padStart(4, "0")}` },
      update: { status: supplierOrderStatuses[supplierIndex % supplierOrderStatuses.length], totalValue: money(orderTotal) },
      create: {
        supplierId: supplier.id,
        procurementCycleId: cycle?.id,
        orderReference: `ECDL-SO-2026-${String(supplierIndex + 1).padStart(4, "0")}`,
        status: supplierOrderStatuses[supplierIndex % supplierOrderStatuses.length],
        totalValue: money(orderTotal),
        confirmedAt: supplierIndex % 2 === 0 ? new Date("2026-07-10") : null,
        packedAt: supplierIndex % 3 === 0 ? new Date("2026-07-15") : null,
        deliverySchedule: new Date("2026-07-22"),
        packingNotes: "Pack centre allocations separately and label by centre.",
        items: { create: allocations.map(({ supplierProduct, centreAllocations, totalQuantity, lineTotal }) => ({ productId: supplierProduct.productId, productNameSnapshot: supplierProduct.product.name, packSizeSnapshot: supplierProduct.product.packSize, unitPriceSnapshot: supplierProduct.unitPrice, totalQuantity, lineTotal: money(lineTotal), centreAllocations, packingInstructions: { labelTemplate: "centre-name-product-quantity", separatePerCentre: true } })) }
      }
    });
    seededTotals.supplierOrders += 1;

    const invoiceStatus = invoiceStatuses[supplierIndex % invoiceStatuses.length];
    const amountPaid = invoiceStatus === "Paid" ? orderTotal : invoiceStatus === "Partially Paid" ? orderTotal * 0.45 : 0;
    const invoice = await prisma.supplierInvoice.upsert({
      where: { invoiceNumber: `ECDL-SUP-2026-${String(supplierIndex + 1).padStart(4, "0")}` },
      update: { paymentStatus: invoiceStatus, amountPaid: money(amountPaid), outstandingAmount: money(orderTotal - amountPaid) },
      create: { invoiceNumber: `ECDL-SUP-2026-${String(supplierIndex + 1).padStart(4, "0")}`, supplierId: supplier.id, procurementCycleId: cycle?.id, supplierOrderId: supplierOrder.id, invoiceDate: new Date("2026-07-20"), dueDate: new Date("2026-08-05"), subtotal: money(orderTotal), vatAmount: money(0), totalAmount: money(orderTotal), amountPaid: money(amountPaid), outstandingAmount: money(orderTotal - amountPaid), paymentStatus: invoiceStatus, externalInvoiceReference: `EXT-${supplier.slug}-${supplierIndex + 1}` }
    });
    seededTotals.supplierInvoices += 1;
    if (amountPaid > 0) {
      await prisma.supplierPayment.upsert({
        where: { id: `supplier-payment-${invoice.id}` },
        update: { amount: money(amountPaid), paymentReference: `PAY-${invoice.invoiceNumber}` },
        create: { id: `supplier-payment-${invoice.id}`, supplierInvoiceId: invoice.id, supplierId: supplier.id, amount: money(amountPaid), paymentDate: new Date("2026-07-25"), paymentMethod: "EFT", paymentReference: `PAY-${invoice.invoiceNumber}`, notes: "Seeded supplier payment." }
      });
      seededTotals.supplierPayments += 1;
    }

    const procurementOrder = approvedOrders[supplierIndex % Math.max(approvedOrders.length, 1)];
    if (procurementOrder) {
      await prisma.delivery.upsert({
        where: { id: `supplier-delivery-${supplier.id}` },
        update: { status: supplierIndex % 4 === 0 ? "DELIVERED" : supplierIndex % 3 === 0 ? "OUT_FOR_DELIVERY" : "PACKED", supplierId: supplier.id, supplierOrderId: supplierOrder.id },
        create: { id: `supplier-delivery-${supplier.id}`, orderId: procurementOrder.id, supplierId: supplier.id, procurementCycleId: cycle?.id, supplierOrderId: supplierOrder.id, status: supplierIndex % 4 === 0 ? "DELIVERED" : supplierIndex % 3 === 0 ? "OUT_FOR_DELIVERY" : "PACKED", scheduledAt: new Date("2026-07-22"), scheduledDate: new Date("2026-07-22"), dispatchedAt: supplierIndex % 3 === 0 ? new Date("2026-07-22") : null, deliveredAt: supplierIndex % 4 === 0 ? new Date("2026-07-23") : null, driverName: "Driver Placeholder", driverPhone: "021 555 9000", vehicleRegistration: `ECD-${supplierIndex} WC`, deliveryNoteNumber: `DN-${supplierIndex + 1}`, deliveryNotes: "Seeded consolidated supplier delivery.", receivedByName: supplierIndex % 4 === 0 ? "Centre recipient" : null }
      });
      seededTotals.supplierDeliveries += 1;
    }

    const score = Math.max(45, Math.min(96, 88 - supplierIndex * 4));
    await prisma.supplierPerformance.upsert({
      where: { supplierId_period: { supplierId: supplier.id, period: "2026-07" } },
      update: { averagePerformanceScore: score, totalMonthlyOrderValue: money(orderTotal) },
      create: { supplierId: supplier.id, period: "2026-07", orderConfirmationRate: 70 + supplierIndex, quotationResponseHours: 12 + supplierIndex * 3, orderFulfilmentRate: score, onTimeDeliveryRate: score - 3, productAvailabilityRate: score + 2, priceCompetitivenessScore: 72, invoiceAccuracyRate: 90 - supplierIndex, disputeRate: supplierIndex % 3, averagePerformanceScore: score, totalMonthlyOrderValue: money(orderTotal), completedOrders: supplierIndex % 4, performanceBand: score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Improvement" : "High Risk" }
    });
    seededTotals.supplierPerformance += 1;

    await prisma.notification.upsert({
      where: { id: `notification-supplier-${supplier.id}` },
      update: { title: "Supplier order allocated", body: `${supplier.companyName} has a seeded consolidated order.` },
      create: { id: `notification-supplier-${supplier.id}`, title: "Supplier order allocated", body: `${supplier.companyName} has a seeded consolidated order.` }
    });
    await prisma.auditLog.upsert({
      where: { id: `audit-supplier-${supplier.id}` },
      update: { action: "supplier.seed", entityType: "Supplier", entityId: supplier.id },
      create: { id: `audit-supplier-${supplier.id}`, action: "supplier.seed", entityType: "Supplier", entityId: supplier.id, metadata: { status: supplier.status } }
    });
  }
}

async function seedDonors() {
  const projectNeedTemplates = [
    { itemName: "Groceries and nutrition packs", needType: "Nutrition", supportType: "Financial", unit: "packs" },
    { itemName: "Kitchen equipment", needType: "Equipment", supportType: "In-kind", unit: "items" },
    { itemName: "Learning resources", needType: "Education", supportType: "In-kind", unit: "sets" },
    { itemName: "Minor infrastructure repairs", needType: "Infrastructure", supportType: "Financial", unit: "jobs" },
    { itemName: "Practitioner training", needType: "Training", supportType: "Services", unit: "sessions" }
  ];

  for (const [index, partner] of partnerOrganisations.entries()) {
    const status = partner.status === "Suspended" ? "Suspended" : partner.status === "Pending" ? "Pending" : "Approved";
    const donor = await prisma.donorOrganisation.upsert({
      where: { slug: partner.id },
      update: {
        name: partner.name,
        organisationName: partner.name,
        type: partner.type,
        organisationType: partner.type,
        contactPerson: partner.contactPerson,
        email: partner.email,
        focusAreas: partner.focusAreas,
        preferredRegions: ["Cape Town", "Johannesburg", "Khayelitsha"].slice(0, 1 + (index % 3)),
        partnershipInterests: ["Centre directory", "Project sponsorship", "Impact reporting"],
        status,
        verificationStatus: status === "Approved" ? "Verified" : "Pending Verification",
        onboardingPercentage: status === "Approved" ? 90 - (index % 4) * 5 : 45,
        annualSupportBudget: money(50000 + index * 15000)
      },
      create: {
        name: partner.name,
        organisationName: partner.name,
        slug: partner.id,
        type: partner.type,
        organisationType: partner.type,
        registrationNumber: `NPO-PARTNER-${String(index + 1).padStart(3, "0")}`,
        contactPerson: partner.contactPerson,
        phone: `021 555 ${String(7000 + index).padStart(4, "0")}`,
        email: partner.email,
        website: `https://${partner.id}.example.org.za`,
        physicalAddress: `${10 + index} Partnership Avenue`,
        suburb: index % 2 === 0 ? "Cape Town" : "Johannesburg",
        city: index % 2 === 0 ? "Cape Town" : "Johannesburg",
        province: index % 2 === 0 ? "Western Cape" : "Gauteng",
        focusAreas: partner.focusAreas,
        preferredRegions: ["Cape Town", "Johannesburg", "Khayelitsha"].slice(0, 1 + (index % 3)),
        annualSupportBudget: money(50000 + index * 15000),
        partnershipInterests: ["Centre directory", "Project sponsorship", "Impact reporting"],
        status,
        verificationStatus: status === "Approved" ? "Verified" : "Pending Verification",
        onboardingChecklist: { profile: true, verification: status === "Approved", focusAreas: true, reportingPreferences: true },
        onboardingPercentage: status === "Approved" ? 90 - (index % 4) * 5 : 45,
        approvedAt: status === "Approved" ? new Date("2026-07-03") : null
      }
    });

    const userCount = index < 5 ? 2 : 1;
    for (let userIndex = 0; userIndex < userCount; userIndex += 1) {
      const user = await upsertUser({
        clerkUserId: `seed-donor-${partner.id}-${userIndex + 1}`,
        email: `donor.${partner.id}.${userIndex + 1}@ecdlink.demo`,
        firstName: userIndex === 0 ? partner.contactPerson.split(" ")[0] ?? "Partner" : "Programme",
        lastName: userIndex === 0 ? partner.contactPerson.split(" ").slice(1).join(" ") || "Lead" : `User ${index + 1}`,
        role: "DONOR"
      });
      await prisma.donorUser.upsert({
        where: { donorOrganisationId_userId: { donorOrganisationId: donor.id, userId: user.id } },
        update: {
          role: userIndex === 0 ? "OWNER" : "PROGRAMME_MANAGER",
          status: "ACTIVE",
          permissions: userIndex === 0 ? ["partner.read", "partner.manage", "requests.manage", "commitments.manage", "reports.read", "messages.manage"] : ["partner.read", "requests.manage", "reports.read", "messages.manage"],
          isPrimary: userIndex === 0
        },
        create: {
          donorOrganisationId: donor.id,
          userId: user.id,
          role: userIndex === 0 ? "OWNER" : "PROGRAMME_MANAGER",
          status: "ACTIVE",
          permissions: userIndex === 0 ? ["partner.read", "partner.manage", "requests.manage", "commitments.manage", "reports.read", "messages.manage"] : ["partner.read", "requests.manage", "reports.read", "messages.manage"],
          isPrimary: userIndex === 0
        }
      });
      seededTotals.donorUsers += 1;
    }

    await prisma.auditLog.upsert({
      where: { id: `audit-partner-${donor.id}` },
      update: { action: "partner.seed", entityType: "DonorOrganisation", entityId: donor.id },
      create: { id: `audit-partner-${donor.id}`, action: "partner.seed", entityType: "DonorOrganisation", entityId: donor.id, metadata: { status, focusAreas: partner.focusAreas } }
    });
    seededTotals.donorOrganisations += 1;
  }

  for (const [index, centreSeed] of seededCentres.slice(0, 16).entries()) {
    const centre = await prisma.ecdCentre.findUnique({ where: { slug: centreSeed.id } });
    if (!centre) continue;
    await prisma.partnerEngagement.upsert({
      where: { id: `centre-directory-profile-${centre.id}` },
      update: { action: "centre.directory.seed", centreId: centre.id },
      create: { id: `centre-directory-profile-${centre.id}`, donorOrganisationId: (await prisma.donorOrganisation.findFirst({ orderBy: { createdAt: "asc" } }))?.id ?? "", centreId: centre.id, action: "centre.directory.seed", metadata: { publicProfile: true, children: centreSeed.numberOfChildren, index } }
    });
    seededTotals.partnerEngagements += 1;
  }

  for (const [index, project] of impactProjects.entries()) {
    const centre = await prisma.ecdCentre.findUnique({ where: { slug: project.centreId } });
    if (!centre) continue;
    const committed = Math.round(project.budget * (project.progress / 100));
    const dbProject = await prisma.impactProject.upsert({
      where: { id: project.id },
      update: {
        slug: project.id,
        centreId: centre.id,
        title: project.title,
        category: project.category,
        projectType: project.category,
        summary: project.goal,
        fullDescription: project.description,
        problemStatement: `The centre requires support for ${project.category.toLowerCase()} to improve daily ECD operations.`,
        objectives: ["Improve centre quality", "Support children safely", "Enable partner reporting"],
        expectedOutcomes: [project.impact, "Verified completion evidence", "Reusable impact report"],
        supportNeeded: project.requiredItems,
        requestedAmount: money(project.budget),
        totalBudget: money(project.budget),
        amountCommitted: money(committed),
        amountReceived: money(Math.round(committed * 0.65)),
        remainingNeed: money(Math.max(project.budget - committed, 0)),
        numberOfBeneficiaries: centre.numberOfChildren,
        startDate: new Date("2026-07-15"),
        endDate: new Date(`2026-${String(8 + (index % 4)).padStart(2, "0")}-28`),
        budget: money(project.budget),
        progress: project.progress,
        description: project.description,
        status: project.status,
        projectStatus: project.status === "Pending Approval" ? "Submitted" : project.status,
        visibility: "Partner",
        featured: project.status === "Featured",
        approvedForPartnerPortal: true,
        approvedAt: new Date("2026-07-04")
      },
      create: {
        id: project.id,
        slug: project.id,
        centreId: centre.id,
        title: project.title,
        category: project.category,
        projectType: project.category,
        summary: project.goal,
        fullDescription: project.description,
        problemStatement: `The centre requires support for ${project.category.toLowerCase()} to improve daily ECD operations.`,
        objectives: ["Improve centre quality", "Support children safely", "Enable partner reporting"],
        expectedOutcomes: [project.impact, "Verified completion evidence", "Reusable impact report"],
        supportNeeded: project.requiredItems,
        requestedAmount: money(project.budget),
        totalBudget: money(project.budget),
        amountCommitted: money(committed),
        amountReceived: money(Math.round(committed * 0.65)),
        remainingNeed: money(Math.max(project.budget - committed, 0)),
        numberOfBeneficiaries: centre.numberOfChildren,
        startDate: new Date("2026-07-15"),
        endDate: new Date(`2026-${String(8 + (index % 4)).padStart(2, "0")}-28`),
        budget: money(project.budget),
        progress: project.progress,
        description: project.description,
        status: project.status,
        projectStatus: project.status === "Pending Approval" ? "Submitted" : project.status,
        visibility: "Partner",
        featured: project.status === "Featured",
        approvedForPartnerPortal: true,
        approvedAt: new Date("2026-07-04")
      }
    });

    for (let needIndex = 0; needIndex < 2 + (index % 2); needIndex += 1) {
      const template = projectNeedTemplates[(index + needIndex) % projectNeedTemplates.length];
      const quantity = 1 + ((index + needIndex) % 5);
      const unitCost = 750 + (index + needIndex) * 125;
      await prisma.impactProjectNeed.upsert({
        where: { id: `${dbProject.id}-need-${needIndex + 1}` },
        update: {
          itemName: template.itemName,
          quantity,
          estimatedUnitCost: money(unitCost),
          estimatedTotalCost: money(quantity * unitCost)
        },
        create: {
          id: `${dbProject.id}-need-${needIndex + 1}`,
          projectId: dbProject.id,
          needType: template.needType,
          itemName: template.itemName,
          description: `Support item for ${project.title}.`,
          quantity,
          unit: template.unit,
          estimatedUnitCost: money(unitCost),
          estimatedTotalCost: money(quantity * unitCost),
          priority: needIndex === 0 ? "High" : "Medium",
          supportType: template.supportType
        }
      });
      seededTotals.impactProjectNeeds += 1;
    }
    seededTotals.impactProjects += 1;
  }

  const donors = await prisma.donorOrganisation.findMany({ orderBy: { slug: "asc" } });
  const projects = await prisma.impactProject.findMany({ include: { centre: true }, orderBy: { id: "asc" } });
  const donorUsers = await prisma.donorUser.findMany({ include: { user: true, organisation: true } });

  for (let index = 0; index < 15; index += 1) {
    const donor = donors[index % donors.length];
    const project = projects[index % projects.length];
    if (!donor || !project) continue;
    const requestType = ["Express Interest", "Request Meeting", "Sponsor Project", "Request Proposal", "In-kind Support"][index % 5];
    const status = index % 5 === 0 ? "Submitted" : index % 5 === 1 ? "Under Review" : index % 5 === 2 ? "Approved" : index % 5 === 3 ? "Closed" : "Declined";
    await prisma.partnershipRequest.upsert({
      where: { id: `request-${index + 1}` },
      update: { status, requestStatus: status, donorOrganisationId: donor.id, centreId: project.centreId, impactProjectId: project.id },
      create: {
        id: `request-${index + 1}`,
        donorOrganisationId: donor.id,
        centreId: project.centreId,
        impactProjectId: project.id,
        type: requestType,
        requestType,
        message: `${donor.organisationName ?? donor.name} is interested in supporting ${project.title}.`,
        proposedSupportType: index % 2 === 0 ? "Financial" : "In-kind",
        proposedAmount: money(10000 + index * 2500),
        proposedItems: { items: projectCategories.slice(index % projectCategories.length, (index % projectCategories.length) + 2) },
        preferredMeetingDate: new Date(`2026-07-${String(12 + (index % 12)).padStart(2, "0")}`),
        status,
        requestStatus: status,
        submittedAt: new Date(`2026-07-${String(1 + index).padStart(2, "0")}`),
        reviewedAt: status !== "Submitted" ? new Date(`2026-07-${String(5 + index).padStart(2, "0")}`) : null,
        closedAt: ["Closed", "Declined"].includes(status) ? new Date(`2026-07-${String(10 + index).padStart(2, "0")}`) : null
      }
    });
    seededTotals.partnershipRequests += 1;
  }

  const requests = await prisma.partnershipRequest.findMany({ include: { donor: true, project: true } });
  for (const [index, request] of requests.slice(0, 10).entries()) {
    const amount = 9000 + index * 3500;
    await prisma.sponsorshipCommitment.upsert({
      where: { id: `commitment-${index + 1}` },
      update: { committedAmount: money(amount), commitmentStatus: index % 4 === 0 ? "Fulfilled" : index % 3 === 0 ? "Partially Fulfilled" : "Confirmed" },
      create: {
        id: `commitment-${index + 1}`,
        partnershipRequestId: request.id,
        donorOrganisationId: request.donorOrganisationId,
        centreId: request.centreId ?? request.project?.centreId ?? projects[index % projects.length]?.centreId ?? "",
        impactProjectId: request.impactProjectId,
        commitmentType: index % 2 === 0 ? "Financial" : "In-kind",
        committedAmount: money(amount),
        committedItems: { items: ["Food packs", "Learning kits"].slice(0, 1 + (index % 2)) },
        expectedFulfilmentDate: new Date(`2026-08-${String(5 + index).padStart(2, "0")}`),
        fulfilledDate: index % 4 === 0 ? new Date(`2026-08-${String(8 + index).padStart(2, "0")}`) : null,
        commitmentStatus: index % 4 === 0 ? "Fulfilled" : index % 3 === 0 ? "Partially Fulfilled" : "Confirmed",
        referenceNumber: `ECDL-COM-${String(index + 1).padStart(4, "0")}`,
        notes: "Seeded partner commitment for CSI portal reporting."
      }
    });
    seededTotals.sponsorshipCommitments += 1;
  }

  for (const [index, project] of projects.entries()) {
    await prisma.projectUpdate.upsert({
      where: { id: `project-update-${index + 1}` },
      update: { progressPercentage: project.progress, visibility: index % 3 === 0 ? "Public" : "Partner" },
      create: {
        id: `project-update-${index + 1}`,
        impactProjectId: project.id,
        title: `${project.title} progress update`,
        updateDate: new Date(`2026-07-${String(4 + (index % 20)).padStart(2, "0")}`),
        summary: "Centre update prepared for partner review.",
        fullUpdate: "The centre has shared implementation progress, photos placeholder evidence and next steps for ECDLink moderation.",
        progressPercentage: project.progress,
        beneficiariesReached: project.numberOfBeneficiaries ?? 0,
        milestoneStatus: index % 4 === 0 ? "Completed" : "In Progress",
        visibility: index % 3 === 0 ? "Public" : "Partner",
        approvedAt: new Date("2026-07-11")
      }
    });
    seededTotals.projectUpdates += 1;

    const donor = donors[index % donors.length];
    if (!donor) continue;
    await prisma.impactReport.upsert({
      where: { id: `impact-report-${index + 1}` },
      update: { status: index % 4 === 0 ? "Shared" : "Approved", visibility: index % 4 === 0 ? "Public" : "Partner" },
      create: {
        id: `impact-report-${index + 1}`,
        centreId: project.centreId,
        impactProjectId: project.id,
        donorOrganisationId: donor.id,
        title: `${project.title} impact report`,
        body: "Generated report placeholder with beneficiary numbers, photos and completion evidence.",
        reportingPeriodStart: new Date("2026-07-01"),
        reportingPeriodEnd: new Date("2026-07-31"),
        reportType: index % 2 === 0 ? "Monthly Update" : "Completion Report",
        summary: "Partner-visible impact report for the donor portal.",
        beneficiariesReached: project.numberOfBeneficiaries ?? 0,
        childrenReached: project.numberOfBeneficiaries ?? 0,
        staffSupported: project.centre.numberOfStaff ?? 0,
        activitiesCompleted: ["Centre visit", "Needs verification", "Photo evidence placeholder"],
        outputs: ["Project progress captured", "Impact metrics updated"],
        outcomes: ["Improved readiness", "Partner reporting enabled"],
        challenges: "Payment and sponsorship integration remains a future production item.",
        nextSteps: "Validate evidence and publish the final partner report.",
        amountAllocated: money(Number(project.totalBudget)),
        amountUsed: money(Number(project.amountReceived)),
        remainingAmount: money(Number(project.remainingNeed)),
        status: index % 4 === 0 ? "Shared" : "Approved",
        visibility: index % 4 === 0 ? "Public" : "Partner",
        approvedAt: new Date("2026-07-11")
      }
    });
    seededTotals.impactReports += 1;
  }

  for (let index = 0; index < 20; index += 1) {
    const donor = donors[index % donors.length];
    const project = projects[index % projects.length];
    if (!donor || !project) continue;
    await prisma.partnerBookmark.upsert({
      where: { id: `partner-bookmark-${index + 1}` },
      update: { donorOrganisationId: donor.id, impactProjectId: project.id },
      create: { id: `partner-bookmark-${index + 1}`, donorOrganisationId: donor.id, impactProjectId: project.id, bookmarkType: "project" }
    });
    seededTotals.partnerBookmarks += 1;
  }

  for (let index = 0; index < 45; index += 1) {
    const donor = donors[index % donors.length];
    const project = projects[index % projects.length];
    if (!donor || !project) continue;
    await prisma.partnerEngagement.upsert({
      where: { id: `partner-engagement-${index + 1}` },
      update: { action: index % 3 === 0 ? "centre.view" : index % 3 === 1 ? "project.view" : "report.download" },
      create: {
        id: `partner-engagement-${index + 1}`,
        donorOrganisationId: donor.id,
        centreId: project.centreId,
        impactProjectId: project.id,
        action: index % 3 === 0 ? "centre.view" : index % 3 === 1 ? "project.view" : "report.download",
        metadata: { source: "seed", session: `demo-${Math.floor(index / 3)}` }
      }
    });
    seededTotals.partnerEngagements += 1;
  }

  for (let index = 0; index < 10; index += 1) {
    const donor = donors[index % donors.length];
    const project = projects[index % projects.length];
    const donorUser = donorUsers.find((item) => item.donorOrganisationId === donor?.id);
    if (!donor || !project) continue;
    await prisma.messageThread.upsert({
      where: { id: `partner-thread-${index + 1}` },
      update: { subject: `${project.title} partnership discussion`, donorOrganisationId: donor.id, centreId: project.centreId },
      create: {
        id: `partner-thread-${index + 1}`,
        subject: `${project.title} partnership discussion`,
        threadType: "Partnership Support",
        donorOrganisationId: donor.id,
        centreId: project.centreId,
        messages: {
          create: {
            id: `partner-message-${index + 1}`,
            senderUserId: donorUser?.userId,
            senderType: "DONOR",
            body: `${donor.organisationName ?? donor.name} would like to discuss project support and reporting requirements.`
          }
        }
      }
    });
    seededTotals.partnerMessages += 1;
  }

  for (const [index, donor] of donors.entries()) {
    await prisma.notification.upsert({
      where: { id: `notification-partner-${donor.id}` },
      update: { title: "Partner profile ready", body: `${donor.organisationName ?? donor.name} has a seeded partner portal profile.` },
      create: { id: `notification-partner-${donor.id}`, title: "Partner profile ready", body: `${donor.organisationName ?? donor.name} has a seeded partner portal profile.` }
    });
    await prisma.auditLog.upsert({
      where: { id: `audit-partner-portal-${donor.id}` },
      update: { action: "partner.portal.seed", entityType: "DonorOrganisation", entityId: donor.id },
      create: { id: `audit-partner-portal-${donor.id}`, action: "partner.portal.seed", entityType: "DonorOrganisation", entityId: donor.id, metadata: { index, phase: "2E" } }
    });
  }
}

async function seedFundingPartners() {
  const organisations = [
    { id: "western-cape-ecd-fund", name: "Western Cape ECD Fund", type: "Government funding" },
    { id: "national-learning-trust", name: "National Learning Trust", type: "Foundation" }
  ];

  for (const organisation of organisations) {
    const dbOrganisation = await prisma.fundingOrganisation.upsert({
      where: { slug: organisation.id },
      update: { name: organisation.name, type: organisation.type, status: "Active" },
      create: { slug: organisation.id, name: organisation.name, type: organisation.type, status: "Active" }
    });
    seededTotals.fundingOrganisations += 1;

    const user = await upsertUser({
      clerkUserId: `seed-funding-${organisation.id}`,
      email: `funding.${organisation.id}@ecdlink.demo`,
      firstName: organisation.name.split(" ")[0] ?? "Funding",
      lastName: "Partner",
      role: "FUNDING_ORGANISATION"
    });

    await prisma.fundingOrganisationUser.upsert({
      where: { fundingOrganisationId_userId: { fundingOrganisationId: dbOrganisation.id, userId: user.id } },
      update: { isPrimary: true },
      create: { fundingOrganisationId: dbOrganisation.id, userId: user.id, isPrimary: true }
    });
    seededTotals.fundingUsers += 1;
  }
}

function promptRole(role: string) {
  if (role === "super_admin") return "SUPER_ADMIN";
  if (role === "ecdlink_staff") return "ECDLINK_STAFF";
  if (role === "supplier") return "SUPPLIER";
  if (role === "donor") return "DONOR";
  if (role === "funding_partner") return "FUNDING_ORGANISATION";
  return "ECD_CENTRE";
}

async function seedIntelligence() {
  const promptRows = defaultPromptTemplates.flatMap((prompt, index) =>
    prompt.roles.map((role) => ({ ...prompt, role, displayOrder: index + 1 }))
  );

  for (const prompt of promptRows) {
    await prisma.intelligencePromptTemplate.upsert({
      where: { id: `prompt-${prompt.id}-${prompt.role}` },
      update: {
        role: promptRole(prompt.role),
        category: prompt.mode,
        title: prompt.label,
        promptText: prompt.prompt,
        active: true,
        displayOrder: prompt.displayOrder
      },
      create: {
        id: `prompt-${prompt.id}-${prompt.role}`,
        role: promptRole(prompt.role),
        category: prompt.mode,
        title: prompt.label,
        promptText: prompt.prompt,
        description: `Seeded ${prompt.label} prompt for ${prompt.role}.`,
        active: true,
        displayOrder: prompt.displayOrder
      }
    });
    seededTotals.intelligencePrompts += 1;
  }

  const [admin, centreUser, supplierUser, donorUser, fundingUser] = await Promise.all([
    prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, include: { roleRecord: true } }),
    prisma.user.findFirst({ where: { role: "ECD_CENTRE" }, include: { roleRecord: true, centreUsers: true } }),
    prisma.user.findFirst({ where: { role: "SUPPLIER" }, include: { roleRecord: true, supplierUsers: true } }),
    prisma.user.findFirst({ where: { role: "DONOR" }, include: { roleRecord: true, donorUsers: true } }),
    prisma.user.findFirst({ where: { role: "FUNDING_ORGANISATION" }, include: { roleRecord: true, fundingUsers: true } })
  ]);
  const centres = await prisma.ecdCentre.findMany({ take: 16, orderBy: { centreName: "asc" } });
  const suppliers = await prisma.supplier.findMany({ take: 5, orderBy: { companyName: "asc" } });
  const donor = await prisma.donorOrganisation.findFirst();
  const fundingOrganisation = await prisma.fundingOrganisation.findFirst();
  const fundingCall = await prisma.fundingCall.findFirst();
  const impactProject = await prisma.impactProject.findFirst();

  const querySeeds = [
    { id: "intelligence-query-admin-risk", user: admin, text: "Which centres are high risk?", category: "Risk", role: "SUPER_ADMIN", organisationType: "Platform", organisationId: null },
    { id: "intelligence-query-centre-docs", user: centreUser, text: "What compliance documents are missing?", category: "Compliance", role: "ECD_CENTRE", organisationType: "Centre", organisationId: centreUser?.centreUsers[0]?.centreId },
    { id: "intelligence-query-supplier-demand", user: supplierUser, text: "Which products have the highest demand?", category: "Supplier", role: "SUPPLIER", organisationType: "Supplier", organisationId: supplierUser?.supplierUsers[0]?.supplierId },
    { id: "intelligence-query-donor-impact", user: donorUser, text: "Generate an impact summary.", category: "Impact", role: "DONOR", organisationType: "DonorOrganisation", organisationId: donorUser?.donorUsers[0]?.donorOrganisationId },
    { id: "intelligence-query-funding-assessment", user: fundingUser, text: "Show applications awaiting assessment.", category: "Funding", role: "FUNDING_ORGANISATION", organisationType: "FundingOrganisation", organisationId: fundingUser?.fundingUsers[0]?.fundingOrganisationId }
  ];

  for (const [index, querySeed] of querySeeds.entries()) {
    if (!querySeed.user) continue;
    const query = await prisma.intelligenceQuery.upsert({
      where: { id: querySeed.id },
      update: { queryText: querySeed.text, queryCategory: querySeed.category, status: "COMPLETED", completedAt: new Date("2026-07-11") },
      create: {
        id: querySeed.id,
        userId: querySeed.user.id,
        roleId: querySeed.user.roleId,
        organisationType: querySeed.organisationType,
        organisationId: querySeed.organisationId ?? undefined,
        queryText: querySeed.text,
        queryCategory: querySeed.category,
        queryIntent: "Seeded intelligence demo",
        status: "COMPLETED",
        completedAt: new Date("2026-07-11"),
        metadata: { seed: true }
      }
    });
    seededTotals.intelligenceQueries += 1;

    const response = await prisma.intelligenceResponse.upsert({
      where: { queryId: query.id },
      update: {
        responseType: index === 0 ? "Risk Assessment" : index === 3 ? "Report" : "Summary",
        title: `${querySeed.category} intelligence response`,
        answerText: `Seeded database-backed response for: ${querySeed.text}`,
        confidenceLevel: 75 + index
      },
      create: {
        queryId: query.id,
        responseType: index === 0 ? "Risk Assessment" : index === 3 ? "Report" : "Summary",
        title: `${querySeed.category} intelligence response`,
        summary: "Seeded response generated from linked ECDLink records.",
        answerText: `Seeded database-backed response for: ${querySeed.text}`,
        structuredData: { bullets: ["Facts are sourced from database records.", "Human review is required before action."], recommendations: [{ id: `seed-rec-${index}`, title: "Review result", description: "Validate the generated summary.", actionLabel: "Review" }] },
        confidenceLevel: 75 + index,
        dataFreshnessDate: new Date("2026-07-11"),
        generatedBy: "Rules Engine",
        requiresHumanReview: true,
        warnings: ["Seeded placeholder output for prototype review."]
      }
    });
    await prisma.intelligenceQuery.update({ where: { id: query.id }, data: { responseId: response.id } });
    seededTotals.intelligenceResponses += 1;

    const sourceCentre = centres[index % Math.max(centres.length, 1)];
    if (sourceCentre) {
      await prisma.intelligenceSourceReference.upsert({
        where: { id: `source-${response.id}-centre` },
        update: { sourceLabel: sourceCentre.centreName },
        create: { id: `source-${response.id}-centre`, responseId: response.id, sourceType: "EcdCentre", sourceId: sourceCentre.id, sourceLabel: sourceCentre.centreName, module: "Centres", relationship: "seed source" }
      });
      seededTotals.intelligenceSourceReferences += 1;
    }
  }

  for (const [index, centre] of centres.entries()) {
    const severity = index % 5 === 0 ? "CRITICAL" : index % 4 === 0 ? "HIGH" : index % 3 === 0 ? "MEDIUM" : "LOW";
    const insight = await prisma.intelligenceInsight.upsert({
      where: { id: `insight-centre-health-${centre.id}` },
      update: { severity, status: index % 6 === 0 ? "ACKNOWLEDGED" : "NEW" },
      create: {
        id: `insight-centre-health-${centre.id}`,
        insightType: index % 2 === 0 ? "Compliance Risk" : "Operational Recommendation",
        title: `${centre.centreName} health signal`,
        summary: `${centre.centreName} has a seeded centre health signal for Intelligence review.`,
        severity,
        priority: severity === "CRITICAL" ? 1 : severity === "HIGH" ? 2 : 3,
        targetRole: "SUPER_ADMIN",
        centreId: centre.id,
        relatedEntityType: "EcdCentre",
        relatedEntityId: centre.id,
        status: index % 6 === 0 ? "ACKNOWLEDGED" : "NEW",
        metadata: { value: severity, seed: true }
      }
    });
    seededTotals.intelligenceInsights += 1;

    await prisma.intelligenceRecommendation.upsert({
      where: { id: `recommendation-centre-${centre.id}` },
      update: { status: index % 4 === 0 ? "ACCEPTED" : "SUGGESTED" },
      create: {
        id: `recommendation-centre-${centre.id}`,
        insightId: insight.id,
        centreId: centre.id,
        recommendationType: "Operational Recommendation",
        title: `Review ${centre.centreName}`,
        description: "Prioritise membership, compliance and funding readiness follow-up.",
        rationale: "Generated from seeded centre health and compliance signals.",
        priority: insight.priority,
        actionRoute: `/dashboard/super-admin/centres/${centre.slug}`,
        status: index % 4 === 0 ? "ACCEPTED" : "SUGGESTED",
        metadata: { seed: true }
      }
    });
    seededTotals.intelligenceRecommendations += 1;
  }

  for (const [index, supplier] of suppliers.entries()) {
    const insight = await prisma.intelligenceInsight.upsert({
      where: { id: `insight-supplier-risk-${supplier.id}` },
      update: { title: `${supplier.companyName} performance signal` },
      create: { id: `insight-supplier-risk-${supplier.id}`, insightType: "Supplier Risk", title: `${supplier.companyName} performance signal`, summary: "Seeded supplier performance insight.", severity: index % 2 === 0 ? "MEDIUM" : "LOW", priority: 3, targetRole: "SUPER_ADMIN", supplierId: supplier.id, relatedEntityType: "Supplier", relatedEntityId: supplier.id, metadata: { seed: true } }
    });
    await prisma.intelligenceRecommendation.upsert({
      where: { id: `recommendation-supplier-${supplier.id}` },
      update: { title: `Review ${supplier.companyName} performance` },
      create: { id: `recommendation-supplier-${supplier.id}`, insightId: insight.id, supplierId: supplier.id, recommendationType: "Supplier Risk", title: `Review ${supplier.companyName} performance`, description: "Review delivery and fulfilment performance before the next procurement cycle.", rationale: "Generated from supplier records.", priority: 3 }
    });
    seededTotals.intelligenceInsights += 1;
    seededTotals.intelligenceRecommendations += 1;
  }

  if (donor && impactProject) {
    await prisma.intelligenceInsight.upsert({
      where: { id: `insight-partner-reporting-${donor.id}` },
      update: { title: "Impact reporting reminder" },
      create: { id: `insight-partner-reporting-${donor.id}`, insightType: "Impact Reporting Due", title: "Impact reporting reminder", summary: `${donor.organisationName ?? donor.name} has seeded partner reporting follow-up.`, severity: "MEDIUM", priority: 2, targetRole: "DONOR", donorOrganisationId: donor.id, relatedEntityType: "ImpactProject", relatedEntityId: impactProject.id, metadata: { seed: true } }
    });
    seededTotals.intelligenceInsights += 1;
  }

  if (fundingOrganisation && fundingCall) {
    await prisma.intelligenceRecommendation.upsert({
      where: { id: `recommendation-funding-${fundingOrganisation.id}` },
      update: { title: "Review funding applications awaiting assessment" },
      create: { id: `recommendation-funding-${fundingOrganisation.id}`, fundingOrganisationId: fundingOrganisation.id, recommendationType: "Funding Opportunity Match", title: "Review funding applications awaiting assessment", description: "Use readiness score and missing requirement checks before approval.", rationale: `Seeded from ${fundingCall.title}.`, priority: 2 }
    });
    seededTotals.intelligenceRecommendations += 1;
  }

  const draftCentre = centres[0];
  if (draftCentre && admin) {
    const proposalDraft = await prisma.intelligenceProposalDraft.upsert({
      where: { id: `proposal-draft-${draftCentre.id}` },
      update: { title: `${draftCentre.centreName} Seeded Proposal Draft` },
      create: {
        id: `proposal-draft-${draftCentre.id}`,
        centreId: draftCentre.id,
        projectId: impactProject?.id,
        fundingCallId: fundingCall?.id,
        title: `${draftCentre.centreName} Seeded Proposal Draft`,
        executiveSummary: "Seeded rule-based proposal draft for Intelligence review.",
        organisationBackground: `${draftCentre.centreName} is an ECD centre in ${draftCentre.region}.`,
        problemStatement: "Township ECD centres need reliable operational support.",
        projectDescription: "Prototype proposal draft generated from centre and project data.",
        objectives: ["Support children", "Improve readiness", "Strengthen reporting"],
        expectedOutcomes: ["Improved funding readiness", "Clear partner report"],
        implementationPlan: "Human-reviewed implementation plan placeholder.",
        monitoringAndEvaluation: "Track children reached, activities and evidence.",
        sustainability: "Build ongoing centre operating capacity.",
        risks: "Generated output requires human review.",
        conclusion: "Ready for review before conversion.",
        generatedFromData: { seed: true, centreId: draftCentre.id },
        createdByUserId: admin.id
      }
    });
    seededTotals.intelligenceProposalDrafts += 1;

    const budgetDraft = await prisma.intelligenceBudgetDraft.upsert({
      where: { id: `budget-draft-${draftCentre.id}` },
      update: { title: `${draftCentre.centreName} Seeded Budget Draft` },
      create: {
        id: `budget-draft-${draftCentre.id}`,
        centreId: draftCentre.id,
        projectId: impactProject?.id,
        title: `${draftCentre.centreName} Seeded Budget Draft`,
        requestedAmount: money(25000),
        estimatedTotal: money(25000),
        assumptions: ["Seeded budget draft.", "Human review required."],
        createdByUserId: admin.id,
        items: {
          create: [
            { id: `budget-draft-item-${draftCentre.id}-nutrition`, category: "Nutrition", description: "Nutrition support", quantity: 1, unit: "allocation", estimatedUnitCost: money(10000), estimatedTotal: money(10000), justification: "ECD operating support." },
            { id: `budget-draft-item-${draftCentre.id}-resources`, category: "Learning Resources", description: "Learning materials", quantity: 1, unit: "allocation", estimatedUnitCost: money(15000), estimatedTotal: money(15000), justification: "Learning support." }
          ]
        }
      }
    });
    seededTotals.intelligenceBudgetDrafts += 1;

    const reportQuery = await prisma.intelligenceQuery.upsert({
      where: { id: "intelligence-report-query-executive" },
      update: { queryText: "Generate executive dashboard summary", status: "COMPLETED" },
      create: { id: "intelligence-report-query-executive", userId: admin.id, roleId: admin.roleId, organisationType: "Platform", queryText: "Generate executive dashboard summary", queryCategory: "Reporting", status: "COMPLETED", completedAt: new Date("2026-07-11") }
    });
    const report = await prisma.intelligenceResponse.upsert({
      where: { queryId: reportQuery.id },
      update: { responseType: "Report", title: "Executive dashboard summary" },
      create: { queryId: reportQuery.id, responseType: "Report", title: "Executive dashboard summary", summary: "Seeded generated report metadata.", answerText: "Executive dashboard summary placeholder.", structuredData: { proposalDraftId: proposalDraft.id, budgetDraftId: budgetDraft.id }, generatedBy: "Analytics Engine", requiresHumanReview: true }
    });
    await prisma.intelligenceQuery.update({ where: { id: reportQuery.id }, data: { responseId: report.id } });
    seededTotals.intelligenceReports += 1;
  }

  await prisma.auditLog.upsert({
    where: { id: "audit-intelligence-seed" },
    update: { action: "intelligence.seed", entityType: "Intelligence" },
    create: { id: "audit-intelligence-seed", action: "intelligence.seed", entityType: "Intelligence", metadata: { phase: "2F" } }
  });
}

async function main() {
  await seedRolesAndPermissions();
  await seedCentres();
  await seedCoreUsers();
  await seedEcdlinkStaff();
  await seedMemberships();
  await seedCompliance();
  await seedFundingPartners();
  await seedFunding();
  await seedProductsAndSuppliers();
  await seedProcurement();
  await seedSupplierOperations();
  await seedDonors();
  await seedIntelligence();
  console.table(seededTotals);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
