import type { AiPrompt } from "@/lib/intelligence/types";

export const assistantCopy = {
  commandCentre: "Ask questions across centres, procurement, compliance, funding, membership, suppliers and donors.",
  centre: "Check documents, procurement, membership, funding readiness and next actions.",
  supplier: "Summarise consolidated orders, deliveries, products and stock planning.",
  donor: "Discover centres, summarise impact and prepare partner reports.",
  funding: "Review funding-ready centres, proposal gaps and assessment priorities."
};

export const defaultPromptTemplates: AiPrompt[] = [
  { id: "expired-compliance", label: "Expired compliance", prompt: "Which centres have expired compliance documents?", roles: ["super_admin"], mode: "command-centre" },
  { id: "not-ordered", label: "No monthly order", prompt: "Which centres have not ordered this month?", roles: ["super_admin"], mode: "command-centre" },
  { id: "funding-ready", label: "Funding-ready centres", prompt: "Which centres are funding-ready?", roles: ["super_admin", "funding_partner"], mode: "command-centre" },
  { id: "kitchen-equipment", label: "Kitchen equipment needs", prompt: "Which centres need kitchen equipment?", roles: ["super_admin", "donor"], mode: "command-centre" },
  { id: "supplier-performance", label: "Supplier performance", prompt: "Which suppliers have the best performance?", roles: ["super_admin", "supplier"], mode: "command-centre" },
  { id: "high-risk", label: "High risk centres", prompt: "Which centres are high risk?", roles: ["super_admin"], mode: "command-centre" },
  { id: "procurement-report", label: "Procurement report", prompt: "Generate a monthly procurement report", roles: ["super_admin"], mode: "command-centre" },
  { id: "proposal-outline", label: "Proposal outline", prompt: "Generate a funding proposal outline for Little Stars ECD Centre", roles: ["super_admin", "ecd_centre", "funding_partner"], mode: "command-centre" },
  { id: "missing-docs", label: "Missing documents", prompt: "What compliance documents are missing?", roles: ["ecd_centre"], mode: "ecd-centre" },
  { id: "procurement-order", label: "Suggested order", prompt: "Suggest a monthly procurement order based on number of children", roles: ["ecd_centre"], mode: "ecd-centre" },
  { id: "funding-motivation", label: "Draft motivation", prompt: "Draft a funding motivation for our centre", roles: ["ecd_centre"], mode: "ecd-centre" },
  { id: "supplier-summary", label: "Order summary", prompt: "Summarise consolidated orders", roles: ["supplier"], mode: "supplier" },
  { id: "stock-planning", label: "Stock planning", prompt: "Suggest stock planning for top requested products", roles: ["supplier"], mode: "supplier" },
  { id: "recommend-centres", label: "Recommended centres", prompt: "Recommend verified centres to support", roles: ["donor"], mode: "donor" },
  { id: "impact-report", label: "Impact report draft", prompt: "Generate an impact report draft", roles: ["donor", "funding_partner"], mode: "donor" }
];
