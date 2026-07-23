import { getCentreById, listCentres } from "@/lib/centres/api";
import { complianceRecords } from "@/lib/compliance/data";
import { getFundingReadinessByCentreId } from "@/lib/funding/api";
import { membershipRecords } from "@/lib/membership/data";
import { centreOrders, getProduct } from "@/lib/procurement/data";
import type { CentreRiskLevel, CentreHealthLabel, UnifiedCentreAction, UnifiedCentreDocument, UnifiedCentreProfile, UnifiedCentreTimelineItem } from "@/lib/centre-360/types";
import type { EcdCentre } from "@/lib/centres/types";

function membershipScore(status?: string) {
  if (status === "Active") return 25;
  if (status === "Pending") return 12;
  return 0;
}

function procurementScore(centre: EcdCentre, orders: UnifiedCentreProfile["procurementOrders"]) {
  if (orders.length > 0) return 20;
  if (centre.procurementStatus === "Active") return 14;
  if (centre.procurementStatus === "Pending") return 8;
  return 0;
}

function healthLabel(score: number): CentreHealthLabel {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 45) return "Needs Attention";
  return "Critical";
}

function riskLevel(score: number, actions: UnifiedCentreAction[]): CentreRiskLevel {
  if (score < 45 || actions.some((action) => action.status === "Critical")) return "Critical";
  if (score < 60 || actions.length >= 5) return "High";
  if (score < 75 || actions.length >= 2) return "Medium";
  return "Low";
}

function buildDocuments(profile: Omit<UnifiedCentreProfile, "documents" | "timeline" | "outstandingActions" | "healthScore" | "healthLabel" | "riskLevel">): UnifiedCentreDocument[] {
  const complianceDocs = profile.compliance?.documents.map((document) => ({
    id: document.id,
    title: document.type,
    source: "Compliance" as const,
    status: document.status,
    expiryDate: document.expiryDate,
    fileName: document.fileName
  })) ?? [];

  const membershipDocs: UnifiedCentreDocument[] = profile.membership ? [
    {
      id: `${profile.centre.id}-membership-invoice`,
      title: "Annual membership invoice",
      source: "Membership",
      status: profile.membership.invoiceStatus,
      expiryDate: profile.membership.expiryDate,
      fileName: `${profile.membership.invoiceNumber}.pdf`
    },
    {
      id: `${profile.centre.id}-membership-receipt`,
      title: "Membership receipt placeholder",
      source: "Membership",
      status: profile.membership.paymentStatus,
      expiryDate: null,
      fileName: profile.membership.paymentStatus === "Paid" ? `${profile.membership.invoiceNumber}-receipt.pdf` : null
    }
  ] : [];

  const orderDocs = profile.procurementOrders.flatMap((order) => [
    { id: `${order.id}-invoice`, title: `Procurement invoice ${order.invoiceNumber}`, source: "Procurement" as const, status: order.status, expiryDate: null, fileName: `${order.invoiceNumber}.pdf` },
    { id: `${order.id}-pod`, title: `Proof of delivery ${order.orderNumber}`, source: "Procurement" as const, status: order.deliveryStatus, expiryDate: null, fileName: order.deliveryStatus === "Delivered" ? `${order.orderNumber}-pod.pdf` : null }
  ]);

  const fundingDocs = profile.funding?.supportingDocuments.map((document) => ({
    id: document.id,
    title: document.label,
    source: "Funding" as const,
    status: document.complete ? "Ready" : "Draft",
    expiryDate: null,
    fileName: document.complete ? `${profile.centre.id}-${document.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf` : null
  })) ?? [];

  const centreDocs = profile.centre.centrePhotos.map((photo) => ({
    id: photo.id,
    title: photo.title,
    source: "Centre" as const,
    status: "Uploaded",
    expiryDate: null,
    fileName: `${photo.id}.jpg`
  }));

  return [...complianceDocs, ...membershipDocs, ...orderDocs, ...fundingDocs, ...centreDocs];
}

function buildOutstandingActions(profile: Omit<UnifiedCentreProfile, "documents" | "timeline" | "outstandingActions" | "healthScore" | "healthLabel" | "riskLevel">): UnifiedCentreAction[] {
  const actions: UnifiedCentreAction[] = [];
  if (!profile.membership || profile.membership.status !== "Active") {
    actions.push({ id: "membership-renewal", title: "Resolve membership renewal", description: "Membership must be active for full ECDLink support.", status: profile.membership?.status === "Overdue" ? "Critical" : "Attention" });
  }
  profile.compliance?.documents.filter((document) => ["Missing", "Expired", "Rejected", "Expiring Soon"].includes(document.status)).slice(0, 4).forEach((document) => {
    actions.push({ id: document.id, title: `${document.type} requires action`, description: document.verificationNote, status: document.status === "Expired" || document.status === "Rejected" ? "Critical" : "Attention" });
  });
  if (profile.funding && profile.funding.readinessScore < 80) {
    actions.push({ id: "funding-readiness", title: "Improve funding readiness", description: "Complete proposal, budget, beneficiary and supporting document gaps.", status: "Attention" });
  }
  if (profile.procurementOrders.length === 0 && profile.centre.procurementStatus !== "Active") {
    actions.push({ id: "procurement-activation", title: "Activate procurement participation", description: "Centre has no monthly procurement order history yet.", status: "Attention" });
  }
  return actions;
}

function buildTimeline(profile: Omit<UnifiedCentreProfile, "documents" | "timeline" | "outstandingActions" | "healthScore" | "healthLabel" | "riskLevel">): UnifiedCentreTimelineItem[] {
  const items: UnifiedCentreTimelineItem[] = [
    ...profile.centre.activityTimeline.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      date: item.createdAt,
      source: item.type === "note" ? "Note" as const : item.type.charAt(0).toUpperCase() + item.type.slice(1) as UnifiedCentreTimelineItem["source"]
    }))
  ];

  if (profile.membership) {
    items.push({
      id: `${profile.membership.id}-renewal`,
      title: "Membership renewal tracked",
      description: `${profile.membership.status} membership with invoice ${profile.membership.invoiceNumber}.`,
      date: profile.membership.startDate,
      source: "Membership"
    });
  }

  profile.procurementOrders.forEach((order) => {
    items.push({ id: `${order.id}-submitted`, title: "Order submitted", description: `${order.orderNumber} submitted for ${order.month}.`, date: order.submittedAt, source: "Procurement" });
    items.push({ id: `${order.id}-delivery`, title: "Delivery status updated", description: `${order.deliveryStatus}: ${order.deliveryNotes}`, date: order.submittedAt, source: "Procurement" });
  });

  profile.compliance?.documents.filter((document) => document.uploadedAt).slice(0, 8).forEach((document) => {
    items.push({ id: `${document.id}-uploaded`, title: "Document uploaded", description: `${document.type} is ${document.status}.`, date: document.uploadedAt ?? profile.centre.lastUpdatedDate, source: "Document" });
  });

  profile.funding?.projectProfiles.forEach((project) => {
    items.push({ id: `${project.id}-created`, title: "Funding application created", description: `${project.title} is ${project.status}.`, date: profile.funding?.lastUpdatedAt ?? profile.centre.lastUpdatedDate, source: "Funding" });
  });

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getUnifiedCentreProfile(centreId: string): Promise<UnifiedCentreProfile | null> {
  const centre = await getCentreById(centreId);
  if (!centre) return null;

  const membership = membershipRecords.find((record) => record.centreId === centre.id) ?? null;
  const compliance = complianceRecords.find((record) => record.centreId === centre.id) ?? null;
  const funding = await getFundingReadinessByCentreId(centre.id);
  const procurementOrders = centreOrders.filter((order) => order.centreId === centre.id);
  const base = { centre, membership, compliance, funding, procurementOrders };
  const outstandingActions = buildOutstandingActions(base);
  const healthScore = Math.round(
    membershipScore(membership?.status) +
      ((compliance?.score ?? 0) * 0.3) +
      procurementScore(centre, procurementOrders) +
      ((funding?.readinessScore ?? 0) * 0.25)
  );

  return {
    ...base,
    documents: buildDocuments(base),
    timeline: buildTimeline(base),
    outstandingActions,
    healthScore,
    healthLabel: healthLabel(healthScore),
    riskLevel: riskLevel(healthScore, outstandingActions)
  };
}

export async function searchUnifiedCentres(query: string) {
  const centres = await listCentres();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return centres;
  return centres.filter((centre) =>
    [centre.centreName, centre.principalName, centre.region, centre.npoNumber, centre.dbeRegistrationStatus]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

export function orderProductSummary(order: UnifiedCentreProfile["procurementOrders"][number]) {
  return order.items.map((item) => {
    const product = getProduct(item.productId);
    return {
      name: product.name,
      supplier: product.supplierBrand,
      packSize: product.packSize,
      quantity: item.quantity,
      total: product.price * item.quantity
    };
  });
}
