import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FlaskConical, Lock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/friday/ui";
import { CountermeasureLab } from "@/components/friday/CountermeasureLab";
import { useDB } from "@/lib/friday/store";
import type { Category } from "@/lib/friday/types";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  { id: "sqli", label: "SQL injection", blurb: "Query rewriting via string literals" },
  { id: "cmdi", label: "Command injection", blurb: "Shell metacharacters reaching a shell" },
  { id: "access", label: "Access control", blurb: "Reading another user's object" },
];

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Countermeasure Lab · FRIDAY" },
      { name: "description", content: "Symbolic taint-path sandbox: toggle defenses and see whether a probe breaches the sink or is contained." },
      { property: "og:title", content: "Countermeasure Lab · FRIDAY" },
      { property: "og:description", content: "Interactive, in-browser countermeasure simulation for SQL injection, command injection and access control." },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  const db = useDB();

  // Find which categories were actually detected in scanned projects
  const detectedCategories = useMemo(() => {
    const cats = new Set<Category>();
    for (const scan of db.scans) {
      for (const finding of scan.findings) {
        cats.add(finding.category);
      }
    }
    return cats;
  }, [db.scans]);

  // Only show categories detected in current project scans; if no scans exist yet, show all as educational sandbox
  const activeCategories = useMemo(() => {
    if (detectedCategories.size === 0) return ALL_CATEGORIES;
    return ALL_CATEGORIES.filter((c) => detectedCategories.has(c.id));
  }, [detectedCategories]);

  const [cat, setCat] = useState<Category>(() => activeCategories[0]?.id ?? "sqli");

  // Keep cat valid if active list changes
  const currentCat = activeCategories.some((c) => c.id === cat) ? cat : activeCategories[0]?.id ?? "sqli";
  const active = ALL_CATEGORIES.find((c) => c.id === currentCat)!;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Defense verification"
        title="Countermeasure Lab"
        description="Feed a probe through an active vulnerability class and toggle defenses to watch the outcome flip between breached and contained. Symbolic only — nothing is executed and nothing leaves your browser."
        actions={
          <div className="flex items-center gap-2">
            {detectedCategories.size > 0 && (
              <span className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] text-primary">
                <ShieldAlert className="size-3" />
                Filtered to {detectedCategories.size} detected vulnerability classes
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <Lock className="size-3" />
              Symbolic · local
            </span>
          </div>
        }
      />

      <div className={cn("grid gap-1.5", activeCategories.length === 1 ? "grid-cols-1" : activeCategories.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {activeCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              "rounded-md border p-3 text-left transition-colors",
              currentCat === c.id ? "border-primary bg-primary/10" : "hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className={cn("size-3.5", currentCat === c.id && "text-primary")} />
              {c.label}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{c.blurb}</div>
          </button>
        ))}
      </div>

      <CountermeasureLab key={currentCat} category={currentCat} />
      <p className="text-xs text-muted-foreground">
        Modeling the {active.label.toLowerCase()} class. Open a finding's detail page to inspect the actual source code and sink graph for that specific issue.
      </p>
    </div>
  );
}
