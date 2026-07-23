import { seededCentres } from "@/lib/centres/seed";
import { complianceRecords } from "@/lib/compliance/data";
import { fundingReadinessRecords } from "@/lib/funding/data";
import { membershipRecords } from "@/lib/membership/data";
import type { ImpactCentre, ImpactProject, PartnerMessage, PartnerOrganisation, PartnershipRequest, ProjectCategory } from "@/lib/donor/types";

export const projectCategories: ProjectCategory[] = ["Nutrition Programme", "Kitchen Upgrade", "Playground Equipment", "Learning Resources", "Infrastructure Repairs", "Training", "Furniture", "ICT Equipment"];

export const partnerOrganisations: PartnerOrganisation[] = [
  ...["Ubuntu Foods CSI", "Cape Early Learning Foundation", "Bright Futures NGO", "Thrive Individual Giving", "Gauteng Social Development"].map((name, index) => ({
    id: `partner-${index + 1}`,
    name,
    type: ["Corporate Social Investment (CSI)", "Foundation", "NGO", "Individual Donor", "Government Department"][index] as PartnerOrganisation["type"],
    contactPerson: ["Lindiwe Maseko", "James Naidoo", "Ayesha Khan", "Peter Jacobs", "Nomvula Mokoena"][index],
    email: `contact${index + 1}@partner.org.za`,
    focusAreas: [projectCategories[index], projectCategories[(index + 2) % projectCategories.length]],
    status: index === 3 ? "Pending" as const : "Approved" as const,
    engagementScore: 92 - index * 6
  })),
  ...Array.from({ length: 10 }).map((_, index) => ({
    id: `partner-extra-${index + 1}`,
    name: `ECD Impact Partner ${index + 1}`,
    type: (index % 2 === 0 ? "Corporate Social Investment (CSI)" : "Foundation") as PartnerOrganisation["type"],
    contactPerson: `Partner Lead ${index + 1}`,
    email: `lead${index + 1}@ecdimpact.org.za`,
    focusAreas: [projectCategories[(index + 1) % projectCategories.length], projectCategories[(index + 4) % projectCategories.length]],
    status: index % 5 === 0 ? "Pending" as const : "Approved" as const,
    engagementScore: 74 + (index % 5) * 4
  }))
];

export const impactCentres: ImpactCentre[] = seededCentres.slice(0, 16).map((centre, index) => {
  const compliance = complianceRecords.find((item) => item.centreId === centre.id);
  const funding = fundingReadinessRecords.find((item) => item.centreId === centre.id);
  const membership = membershipRecords.find((item) => item.centreId === centre.id);
  return {
    id: centre.id,
    name: centre.centreName,
    location: `${centre.area}, ${centre.region}`,
    province: centre.region,
    children: centre.numberOfChildren,
    staff: centre.numberOfStaff,
    registrationStatus: centre.registrationStatus,
    complianceScore: compliance?.score ?? 0,
    fundingReadiness: funding?.readinessScore ?? 0,
    membershipStatus: membership?.status ?? centre.membershipStatus,
    currentNeeds: [projectCategories[index % projectCategories.length], projectCategories[(index + 2) % projectCategories.length]],
    activeProjectCount: 1 + (index % 3),
    imageTone: index % 3 === 0 ? "bg-blue-100" : index % 3 === 1 ? "bg-green-100" : "bg-amber-100"
  };
});

export const impactProjects: ImpactProject[] = Array.from({ length: 20 }).map((_, index) => {
  const centre = impactCentres[index % impactCentres.length];
  const category = projectCategories[index % projectCategories.length];
  return {
    id: `impact-project-${index + 1}`,
    centreId: centre.id,
    centreName: centre.name,
    title: `${category} for ${centre.name}`,
    category,
    goal: `Improve ${category.toLowerCase()} outcomes for ${centre.children} children.`,
    budget: 12000 + index * 4500,
    progress: Math.min(94, 18 + index * 4),
    description: "A verified ECDLink centre project prepared for partner review with supporting evidence, photos and impact reporting.",
    impact: `${centre.children} children and ${centre.staff} staff supported through this project.`,
    requiredItems: ["Project proposal", "Budget", "Photos", "Beneficiary list", "Completion report"],
    timeline: `${8 + (index % 8)} weeks`,
    status: index % 7 === 0 ? "Pending Approval" : index % 6 === 0 ? "Featured" : "Active",
    province: centre.province,
    photos: [{ title: "Centre photo", tone: centre.imageTone }, { title: "Project evidence", tone: index % 2 === 0 ? "bg-slate-100" : "bg-green-100" }]
  };
});

export const partnershipRequests: PartnershipRequest[] = impactProjects.slice(0, 10).map((project, index) => ({
  id: `request-${index + 1}`,
  partnerId: partnerOrganisations[index % partnerOrganisations.length].id,
  projectId: project.id,
  type: ["Express Interest", "Request Meeting", "Sponsor Project", "Request Proposal", "Bookmark Project"][index % 5] as PartnershipRequest["type"],
  status: index % 3 === 0 ? "New" : index % 3 === 1 ? "In Review" : "Approved",
  createdAt: `2026-07-${String(index + 1).padStart(2, "0")}`
}));

export const partnerMessages: PartnerMessage[] = [
  { id: "msg-1", from: "ECDLink", subject: "Proposal pack ready", preview: "The nutrition project pack is ready for partner review.", createdAt: "2026-07-10" },
  { id: "msg-2", from: "CSI", subject: "Meeting request", preview: "Ubuntu Foods CSI requested a meeting with ECDLink.", createdAt: "2026-07-09" },
  { id: "msg-3", from: "Centre", subject: "Project photos uploaded", preview: "New project evidence photos are available.", createdAt: "2026-07-08" }
];

export function formatDonorCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}
