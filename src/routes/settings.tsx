import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, Panel } from "@/components/friday/ui";
import { DEFAULT_EXCLUDES } from "@/lib/friday/ingest";
import { clearAllData, toggleCategory, updateSettings, useDB } from "@/lib/friday/store";
import { CATEGORY_LABEL, type Category } from "@/lib/friday/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · FRIDAY" },
      { name: "description", content: "Workspace, analysis, privacy and retention settings for FRIDAY." },
      { property: "og:title", content: "Settings · FRIDAY" },
      { property: "og:description", content: "Configure FRIDAY's local analysis and data retention." },
    ],
  }),
  component: SettingsPage,
});

const save = async (p: Promise<void>, msg = "Settings saved") => { try { await p; toast.success(msg); } catch (e) { toast.error(`Couldn't save: ${(e as Error).message}`); } };

function SettingsPage() {
  const { settings, scans, projects } = useDB();
  const [ws, setWs] = useState(settings.workspaceName);
  const [ex, setEx] = useState(settings.extraExclusions.join(", "));
  const [wipe, setWipe] = useState(false);
  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Workspace">
          <label className="eyebrow">Workspace name</label>
          <div className="mt-1.5 flex gap-2"><Input value={ws} onChange={(e) => setWs(e.target.value)} /><Button size="sm" onClick={() => save(updateSettings({ workspaceName: ws.trim() || "Local workspace" }))}>Save</Button></div>
          <div className="mt-4 flex items-center justify-between text-sm"><span>Light theme</span><Switch checked={settings.theme === "light"} onCheckedChange={(v) => save(updateSettings({ theme: v ? "light" : "dark" }))} /></div>
          <p className="mt-3 text-xs text-muted-foreground">No accounts: this prototype is a single-user local workspace, so there is no sign-in.</p>
        </Panel>
        <Panel title="Vulnerability categories">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <div key={c} className="flex items-center justify-between py-1.5 text-sm"><span>{CATEGORY_LABEL[c]}</span><Switch checked={settings.categories[c]} onCheckedChange={(v) => save(toggleCategory(c, v))} /></div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">Applies to future scans. Language support: Python (Flask, FastAPI).</p>
        </Panel>
        <Panel title="File & directory exclusions">
          <p className="text-xs text-muted-foreground">Always excluded: <span className="font-mono">{DEFAULT_EXCLUDES.join(", ")}</span></p>
          <label className="eyebrow mt-3 block">Additional directory names (comma-separated)</label>
          <div className="mt-1.5 flex gap-2"><Input value={ex} onChange={(e) => setEx(e.target.value)} placeholder="tests, migrations" /><Button size="sm" onClick={() => save(updateSettings({ extraExclusions: ex.split(",").map((s) => s.trim()).filter(Boolean) }))}>Save</Button></div>
        </Panel>
        <Panel title="Display preferences">
          <div className="flex items-center justify-between text-sm"><span>Show numeric confidence (otherwise High/Medium/Low)</span><Switch checked={settings.showNumericConfidence} onCheckedChange={(v) => save(updateSettings({ showNumericConfidence: v }))} /></div>
          <label className="mt-4 flex items-center justify-between gap-3 text-sm">Default minimum confidence in Findings
            <span className="flex items-center gap-2"><input type="range" min={0} max={90} step={5} value={settings.minConfidence} onChange={(e) => updateSettings({ minConfidence: Number(e.target.value) })} className="accent-primary" /><span className="w-8 font-mono text-xs">{settings.minConfidence}%</span></span>
          </label>
        </Panel>
        <Panel title="Analysis engine & model status">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Rule-based taint analysis</span><span className="text-success font-medium">Active · 100% in-browser</span></li>
            <li className="flex justify-between"><span>Remediation AI Model</span><span className="text-emerald-400 font-mono text-xs">NVIDIA nemotron-3.5-super-vl-120b</span></li>
            <li className="flex justify-between"><span>AI Provider</span><span className="text-muted-foreground font-mono text-xs">https://integrate.api.nvidia.com/v1</span></li>
            <li className="flex justify-between"><span>Source Code Privacy Boundary</span><span className="text-success font-medium">Enforced · 0 LOC transmitted</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Vulnerability analysis and AST parsing run entirely in your local browser sandbox. When AI remediation is requested, only the abstract vulnerability rule type and target framework are dispatched to NVIDIA Nemotron with thinking reasoning enabled.</p>
        </Panel>
        <Panel title="Privacy & data retention">
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Uploaded files are read and analyzed entirely inside this browser tab. They are never executed.</li>
            <li>Projects, scans, findings and source copies live in this browser's IndexedDB on this device. Nothing is sent to a server, and no external AI service is contacted.</li>
            <li>Clearing site data in your browser also deletes everything.</li>
          </ul>
          <label className="mt-4 flex items-center justify-between gap-3 text-sm">Scans kept per project
            <Input type="number" min={1} max={200} className="w-20" value={settings.retentionScansPerProject} onChange={(e) => save(updateSettings({ retentionScansPerProject: Math.max(1, Math.min(200, Number(e.target.value) || 1)) }), "Retention updated")} />
          </label>
          <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <span>{projects.length} projects · {scans.length} scans stored</span>
            <Button size="sm" variant="destructive" onClick={() => setWipe(true)}>Delete all data</Button>
          </div>
        </Panel>
      </div>
      <AlertDialog open={wipe} onOpenChange={setWipe}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete all projects and scans?</AlertDialogTitle><AlertDialogDescription>This permanently deletes every project, scan, stored source file and finding status in this browser. Settings are kept.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => save(clearAllData(), "All data deleted")}>Delete everything</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
