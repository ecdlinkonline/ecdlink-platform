import { IntelligenceAssistant } from "@/components/intelligence/intelligence-assistant";
import { assistantCopy, defaultPromptTemplates } from "@/lib/intelligence/constants";
import { getIntelligencePrompts, getMockAiResponse, getRoleInsights } from "@/lib/intelligence/engine";
import type { AssistantMode } from "@/lib/intelligence/types";
import type { UserRole } from "@/lib/auth/roles";

const roleCopy: Record<UserRole, string> = {
  super_admin: assistantCopy.commandCentre,
  ecdlink_staff: assistantCopy.commandCentre,
  ecd_centre: assistantCopy.centre,
  supplier: assistantCopy.supplier,
  donor: assistantCopy.donor,
  funding_partner: assistantCopy.funding
};

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  ecdlink_staff: "ECDLink Staff",
  ecd_centre: "ECD Centre",
  supplier: "Supplier",
  donor: "Donor / CSI Partner",
  funding_partner: "Funding Organisation"
};

export async function IntelligencePage({
  role,
  mode,
  title,
  description
}: {
  role: UserRole;
  mode: AssistantMode;
  title: string;
  description?: string;
}) {
  const databasePrompts = await getIntelligencePrompts();
  const fallbackPrompts = defaultPromptTemplates.filter((prompt) => prompt.roles.includes(role) || prompt.mode === mode);
  const prompts = databasePrompts.length ? databasePrompts : fallbackPrompts;
  const [insights, responseBank, fallbackResponse] = await Promise.all([
    getRoleInsights(role),
    Promise.all(prompts.map(async (prompt) => ({ prompt: prompt.prompt, response: await getMockAiResponse(prompt.prompt, role) }))),
    getMockAiResponse("", role)
  ]);

  return (
    <IntelligenceAssistant
      title={title}
      description={description ?? roleCopy[role]}
      roleLabel={roleLabels[role]}
      prompts={prompts}
      insights={insights}
      responseBank={responseBank}
      fallbackResponse={fallbackResponse}
    />
  );
}
