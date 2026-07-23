"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  FileText,
  Lightbulb,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
  WandSparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, KpiCard, PageHeader, StatusBadge, useToast } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiInsight, AiPrompt, MockAiResponse } from "@/lib/intelligence/types";
import { cn } from "@/lib/utils";

type ResponseBankItem = {
  prompt: string;
  response: MockAiResponse;
};

type ChatMessage = {
  id: string;
  sender: "assistant" | "user";
  content: string;
  response?: MockAiResponse;
};

const insightIcons = [Lightbulb, CheckCircle2, FileText, Search];

export function IntelligenceAssistant({
  title,
  description,
  roleLabel,
  prompts,
  insights,
  responseBank,
  fallbackResponse
}: {
  title: string;
  description: string;
  roleLabel: string;
  prompts: AiPrompt[];
  insights: AiInsight[];
  responseBank: ResponseBankItem[];
  fallbackResponse: MockAiResponse;
}) {
  const { pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(prompts[0]?.prompt ?? "");
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      content: `ECDLink Intelligence is ready for ${roleLabel}. Ask about centres, compliance, procurement, funding, suppliers, donors or next actions.`,
      response: fallbackResponse
    }
  ]);

  const filteredPrompts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return prompts;
    return prompts.filter((prompt) => `${prompt.label} ${prompt.prompt}`.toLowerCase().includes(normalized));
  }, [prompts, query]);

  function resolveResponse(prompt: string) {
    const normalized = prompt.trim().toLowerCase();
    const exact = responseBank.find((item) => item.prompt.toLowerCase() === normalized);
    if (exact) return exact.response;
    const fuzzy = responseBank.find((item) => normalized.includes(item.prompt.toLowerCase().slice(0, 16)) || item.prompt.toLowerCase().includes(normalized.slice(0, 16)));
    return fuzzy?.response ?? fallbackResponse;
  }

  async function ask(prompt: string) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isAsking) return;
    setIsAsking(true);
    let response = resolveResponse(cleanPrompt);
    try {
      const apiResponse = await fetch("/api/intelligence/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryText: cleanPrompt, queryCategory: "General" })
      });
      const payload = await apiResponse.json();
      if (payload.ok && payload.data?.response) response = payload.data.response;
      if (!apiResponse.ok) throw new Error(payload.error ?? "Intelligence request failed.");
    } catch (error) {
      pushToast({
        title: "Using prepared response",
        description: error instanceof Error ? error.message : "The database query could not be saved, so a prepared response is shown."
      });
    }
    setMessages((items) => [
      ...items,
      { id: `user-${Date.now()}`, sender: "user", content: cleanPrompt },
      { id: `assistant-${Date.now()}`, sender: "assistant", content: response.answer, response }
    ]);
    setDraft("");
    pushToast({
      title: "Insight prepared",
      description: response.outputPlaceholder ? `${response.outputPlaceholder.title} is ready as a placeholder.` : "Database-backed intelligence response generated."
    });
    setIsAsking(false);
  }

  const latestAssistantResponse = [...messages].reverse().find((message) => message.sender === "assistant" && message.response)?.response;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ECDLink Intelligence"
        title={title}
        description={description}
        actions={
          <Button type="button" variant="secondary" onClick={() => ask("Generate a monthly procurement report")}>
            <FileText className="h-4 w-4" />
            Generate report
          </Button>
        }
      />

      <Alert
        title="Mock AI engine"
        description="This module uses deterministic responses from seeded platform data. It is ready for a future secure AI API integration."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {insights.map((insight, index) => {
          const Icon = insightIcons[index % insightIcons.length];
          return <KpiCard key={insight.id} label={insight.title} value={insight.value} description={insight.description} tone={insight.tone} icon={Icon} />;
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="border-b border-brand-line bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Bot className="h-5 w-5 text-brand-navy dark:text-blue-200" />
                  Chat Assistant
                </CardTitle>
                <CardDescription className="dark:text-slate-400">Ask operational questions or generate report placeholders.</CardDescription>
              </div>
              <StatusBadge status="Seeded data" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="max-h-[540px] space-y-4 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn("flex", message.sender === "user" ? "justify-end" : "justify-start")}
                  >
                    <div className={cn("max-w-[92%] rounded-lg border p-4 sm:max-w-[82%]", message.sender === "user" ? "border-brand-navy bg-brand-navy text-white" : "border-brand-line bg-brand-accent dark:border-slate-800 dark:bg-slate-950")}>
                      <div className="flex items-start gap-3">
                        {message.sender === "assistant" ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" /> : <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />}
                        <div className="min-w-0">
                          <p className={cn("text-sm leading-6", message.sender === "assistant" ? "text-slate-700 dark:text-slate-200" : "text-white")}>{message.content}</p>
                          {message.response ? <ResponsePanel response={message.response} /> : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="rounded-lg border border-brand-line bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask ECDLink Intelligence..."
                className="min-h-24 w-full resize-none bg-transparent text-sm leading-6 text-brand-ink outline-none placeholder:text-slate-400 dark:text-white"
              />
              <div className="flex flex-col gap-3 border-t border-brand-line pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-500">Smart search across seeded ECDLink records</p>
                <Button type="button" onClick={() => ask(draft)} disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                  {isAsking ? "Asking..." : "Ask"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <WandSparkles className="h-5 w-5 text-brand-green" />
                Suggested Prompts
              </CardTitle>
              <CardDescription className="dark:text-slate-400">Role-aware prompts for fast decisions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-brand-line bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search prompts"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                {filteredPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => ask(prompt.prompt)}
                    className="w-full rounded-lg border border-brand-line bg-white p-3 text-left transition hover:border-brand-navy hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-brand-ink dark:text-white">{prompt.label}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{prompt.prompt}</p>
                      </div>
                      <Badge variant="muted">{prompt.mode}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Action Recommendations</CardTitle>
              <CardDescription className="dark:text-slate-400">Generated from the latest assistant response.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(latestAssistantResponse?.recommendations ?? []).map((item) => (
                <div key={item.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <p className="font-bold text-brand-ink dark:text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                  <Button type="button" variant="ghost" className="mt-3 px-0" onClick={() => pushToast({ title: item.actionLabel, description: "Placeholder action queued for the future workflow." })}>
                    {item.actionLabel}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ResponsePanel({ response }: { response: MockAiResponse }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {typeof response.confidenceLevel === "number" ? <Badge variant="default">{response.confidenceLevel}% confidence</Badge> : null}
        {response.dataFreshnessDate ? <Badge variant="muted">Fresh {new Date(response.dataFreshnessDate).toLocaleDateString("en-ZA")}</Badge> : null}
        {response.requiresHumanReview ? <Badge variant="warning">Human review</Badge> : null}
      </div>
      {response.warnings?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          {response.warnings.slice(0, 2).join(" ")}
        </div>
      ) : null}
      {response.bullets.length ? (
        <ul className="space-y-2">
          {response.bullets.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand-green" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {response.outputPlaceholder ? (
        <div className="rounded-lg border border-dashed border-brand-navy/30 bg-white p-4 dark:border-blue-300/30 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="default">{response.outputPlaceholder.type} placeholder</Badge>
              <p className="mt-2 font-bold text-brand-ink dark:text-white">{response.outputPlaceholder.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{response.outputPlaceholder.description}</p>
            </div>
            <FileText className="h-5 w-5 text-brand-navy dark:text-blue-200" />
          </div>
        </div>
      ) : null}
      {response.sourceReferences?.length ? (
        <div className="rounded-lg border border-brand-line bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sources</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {response.sourceReferences.slice(0, 6).map((source) => (
              <Badge key={`${source.module}-${source.sourceType}-${source.sourceLabel}`} variant="muted">
                {source.module}: {source.sourceLabel}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
