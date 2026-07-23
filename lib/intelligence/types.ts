import type { UserRole } from "@/lib/auth/roles";

export type AssistantMode = "command-centre" | "ecd-centre" | "supplier" | "donor" | "funding-partner";

export type AiPrompt = {
  id: string;
  label: string;
  prompt: string;
  roles: UserRole[];
  mode: AssistantMode;
};

export type AiInsight = {
  id: string;
  title: string;
  value: string;
  description: string;
  tone: "navy" | "green" | "warning";
  severity?: "Information" | "Low" | "Medium" | "High" | "Critical";
  status?: string;
};

export type AiRecommendation = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
};

export type MockAiResponse = {
  answer: string;
  bullets: string[];
  recommendations: AiRecommendation[];
  title?: string;
  summary?: string;
  confidenceLevel?: number;
  dataFreshnessDate?: string;
  requiresHumanReview?: boolean;
  warnings?: string[];
  sourceReferences?: Array<{ sourceType: string; sourceLabel: string; module: string; relationship?: string }>;
  outputPlaceholder?: {
    title: string;
    description: string;
    type: "Report" | "Proposal" | "Procurement" | "Compliance" | "Budget" | "Search";
  };
};

export type IntelligenceReportDto = {
  id: string;
  title: string;
  reportType: string;
  status: string;
  generatedAt: string;
};
