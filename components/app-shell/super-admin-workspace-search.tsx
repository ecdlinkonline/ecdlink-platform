"use client";

import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createLatestSearchRequestGuard } from "@/lib/search/latest-search-request";
import type { SuperAdminSearchResult } from "@/lib/search/super-admin-search";
import { cn } from "@/lib/utils";

type SearchResponse = {
  ok: boolean;
  data?: { results?: SuperAdminSearchResult[] };
  error?: string;
};

const SEARCH_DEBOUNCE_MS = 250;

export function SuperAdminWorkspaceSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestGuardRef = useRef<ReturnType<typeof createLatestSearchRequestGuard> | null>(null);
  if (!requestGuardRef.current) requestGuardRef.current = createLatestSearchRequestGuard();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuperAdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const groupedResults = useMemo(() => {
    const groups = new Map<string, SuperAdminSearchResult[]>();
    for (const result of results) {
      const group = groups.get(result.moduleLabel) ?? [];
      group.push(result);
      groups.set(result.moduleLabel, group);
    }
    return Array.from(groups.entries());
  }, [results]);

  useEffect(() => {
    const requestGuard = requestGuardRef.current;
    if (!requestGuard) return;
    const generation = requestGuard.begin();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      setOpen(false);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setOpen(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/super-admin/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        const payload = (await response.json()) as SearchResponse;
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Workspace search failed.");
        if (!requestGuard.isCurrent(generation)) return;

        setResults(payload.data?.results ?? []);
        setActiveIndex(0);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (!requestGuard.isCurrent(generation)) return;
        setResults([]);
        setError("Search is temporarily unavailable. Please try again.");
      } finally {
        if (!controller.signal.aborted && requestGuard.isCurrent(generation)) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    requestGuardRef.current?.invalidate();
    setOpen(false);
    setQuery("");
    setResults([]);
    setLoading(false);
    setError(null);
    setActiveIndex(0);
  }, [pathname]);

  const navigateToResult = (result: SuperAdminSearchResult) => {
    requestGuardRef.current?.invalidate();
    setOpen(false);
    setQuery("");
    setResults([]);
    setLoading(false);
    setError(null);
    setActiveIndex(0);
    router.push(result.href);
  };

  const handleQueryChange = (value: string) => {
    requestGuardRef.current?.invalidate();
    setQuery(value);
    setResults([]);
    setActiveIndex(0);
    setError(null);

    if (value.trim().length < 2) {
      setLoading(false);
      setOpen(false);
    } else {
      setLoading(true);
      setOpen(true);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!open || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigateToResult(results[activeIndex] ?? results[0]);
    }
  };

  const showStatus = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative hidden w-72 md:block lg:w-96">
      <div className="flex items-center gap-2 rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {loading ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> : <Search className="h-4 w-4 shrink-0" />}
        <input
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search super admin workspace"
          aria-label="Search super admin workspace"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showStatus}
          aria-controls="super-admin-search-results"
          aria-activedescendant={showStatus && results[activeIndex] ? `super-admin-search-${results[activeIndex].id}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-brand-ink outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
        />
      </div>

      {showStatus ? (
        <div
          id="super-admin-search-results"
          role="listbox"
          aria-label="Super Admin search results"
          className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-lg border border-brand-line bg-white p-2 shadow-soft dark:border-slate-800 dark:bg-slate-950"
        >
          {loading && results.length === 0 ? <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">Searching…</p> : null}
          {!loading && error ? <p className="px-3 py-4 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
          {!loading && !error && results.length === 0 ? <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No matching workspace items found.</p> : null}

          {groupedResults.map(([label, group]) => (
            <div key={label} className="mb-2 last:mb-0">
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              {group.map((result) => {
                const resultIndex = results.findIndex((candidate) => candidate.id === result.id);
                return (
                  <button
                    key={result.id}
                    id={`super-admin-search-${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={resultIndex === activeIndex}
                    onMouseEnter={() => setActiveIndex(resultIndex)}
                    onClick={() => navigateToResult(result)}
                    className={cn(
                      "block w-full rounded-md px-3 py-2 text-left transition",
                      resultIndex === activeIndex
                        ? "bg-brand-accent text-brand-navy dark:bg-slate-900 dark:text-white"
                        : "text-brand-ink hover:bg-brand-accent dark:text-white dark:hover:bg-slate-900"
                    )}
                  >
                    <span className="block truncate text-sm font-semibold">{result.title}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{result.context}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
