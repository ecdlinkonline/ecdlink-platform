import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileCheck2,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  PackageCheck,
  PlaySquare,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
};

export type FeatureCard = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const navigation: NavItem[] = [
  { label: "Services", href: "#services" },
  { label: "How it works", href: "#how-it-works" },
  { label: "SmartKids TV", href: "#smartkids" },
  { label: "Donors", href: "#donors" },
  { label: "Stories", href: "#testimonials" }
];

export const heroStats = [
  { value: "16", label: "Active ECD Centres" },
  { value: "Monthly", label: "Procurement Network" },
  { value: "Full", label: "Compliance & Funding Support" },
  { value: "SA", label: "Growing Across South Africa" }
];

export const services: FeatureCard[] = [
  {
    icon: ShoppingCart,
    title: "Monthly Procurement",
    description:
      "Budget-led monthly ordering, consolidated supplier demand, packed centre allocations and payment coordination."
  },
  {
    icon: UsersRound,
    title: "Annual Membership",
    description:
      "A structured membership layer for onboarding, renewals, centre support, communications and network growth."
  },
  {
    icon: FileCheck2,
    title: "Compliance Support",
    description:
      "NPO, DBE, SARS Tax PIN, PBO, bank confirmation and committee ID records kept organised and review-ready."
  },
  {
    icon: HandCoins,
    title: "Funding Readiness",
    description:
      "Funding opportunities, application tracking, proposal documents, project budgets and readiness reporting."
  }
];

export const workflowSteps = [
  {
    icon: Building2,
    title: "Centres join ECDLink",
    text: "Each centre builds a profile, uploads compliance documents and activates membership."
  },
  {
    icon: LayoutDashboard,
    title: "Operations become visible",
    text: "Procurement, funding, supplier and compliance workflows move into a shared dashboard."
  },
  {
    icon: Truck,
    title: "ECDLink coordinates supply",
    text: "Monthly centre orders are consolidated into supplier-ready batches and packed by centre."
  },
  {
    icon: BadgeCheck,
    title: "Partners fund with confidence",
    text: "Donors and funding organisations can support verified centres and track measurable impact."
  }
];

export const roleCards: FeatureCard[] = [
  {
    icon: LayoutDashboard,
    title: "Super Admin",
    description: "Network dashboards, centres, suppliers, reports and notifications."
  },
  {
    icon: Building2,
    title: "ECD Centre",
    description: "Profile, membership, documents, orders, funding, events and messages."
  },
  {
    icon: PackageCheck,
    title: "Supplier",
    description: "Catalogue, quotations, consolidated orders, deliveries and payments."
  },
  {
    icon: HeartHandshake,
    title: "Donor / CSI Partner",
    description: "Verified centres, active projects, donations, impact and reports."
  },
  {
    icon: ShieldCheck,
    title: "Funding Organisation",
    description: "Programmes, applications, applicant documents and outcomes."
  }
];

export const testimonials = [
  {
    quote:
      "ECDLink gives us one place to manage the work that used to sit across WhatsApp, paper files and spreadsheets.",
    name: "Centre Principal",
    role: "ECD Centre Partner"
  },
  {
    quote:
      "The consolidated order flow makes fulfilment clearer. We can plan stock, packing and delivery with much better visibility.",
    name: "Regional Supplier",
    role: "Procurement Partner"
  },
  {
    quote:
      "For CSI reporting, the difference is structure. We can see verified centres, needs, documents and impact signals together.",
    name: "CSI Lead",
    role: "Donor Partner"
  }
];

export const supplierLogos = [
  "FreshStart Foods",
  "EduPack SA",
  "CleanCare",
  "Little Learners",
  "Ubuntu Supply",
  "BrightBox"
];

export const dashboardRows = [
  { centre: "Little Stars ECD", status: "Verified", budget: "R15,000", order: "Packed" },
  { centre: "Bright Steps Centre", status: "Expiring soon", budget: "R9,500", order: "Consolidated" },
  { centre: "Ubuntu Kids", status: "Pending", budget: "R12,250", order: "Submitted" }
];

export const smartKidsItems = [
  { icon: PlaySquare, title: "Video gallery", text: "Learning clips, centre stories and programme updates." },
  { icon: Sparkles, title: "Competitions", text: "Network-wide activities that keep centres engaged." },
  { icon: ClipboardCheck, title: "Announcements", text: "Important deadlines, events and partner notices." }
];
