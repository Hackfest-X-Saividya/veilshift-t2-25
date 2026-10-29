import { useEffect, useMemo, useState } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Box, Database, FunctionSquare, Globe, Import, ShieldCheck, ShieldOff, Terminal, Variable, Wand2, FileCode, Maximize2, LayoutGrid, MoveRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDB } from "@/lib/friday/store";
import type { GraphEdge, GraphNode, NodeKind } from "@/lib/friday/types";

const KIND_META: Record<NodeKind, { label: string; pill: string; icon: typeof Box }> = {
  source: {
    label: "Source",
    pill: "bg-[#5c182d]/8 text-[#5c182d] dark:text-[#e05d7f] dark:bg-[#e05d7f]/15 border-[#5c182d]/20",
    icon: Import,
  },
  route: {
    label: "Route",
    pill: "bg-[#5c182d]/8 text-[#5c182d] dark:text-[#e05d7f] dark:bg-[#e05d7f]/15 border-[#5c182d]/20",
    icon: Globe,
  },
  variable: {
    label: "Variable",
    pill: "bg-[#70856d]/10 text-[#5c6c5a] dark:text-[#a4b3a1] dark:bg-[#a4b3a1]/15 border-[#70856d]/20",
    icon: Variable,
  },
  transform: {
    label: "Transform",
    pill: "bg-[#b85d38]/10 text-[#b85d38] dark:text-[#e28a65] dark:bg-[#e28a65]/15 border-[#b85d38]/20",
    icon: Wand2,
  },
  call: {
    label: "Call",
    pill: "bg-[#70856d]/10 text-[#5c6c5a] dark:text-[#a4b3a1] dark:bg-[#a4b3a1]/15 border-[#70856d]/20",
    icon: FunctionSquare,
  },
  sanitizer: {
    label: "Control",
    pill: "bg-[#49754f]/10 text-[#49754f] dark:text-[#6ba874] dark:bg-[#6ba874]/15 border-[#49754f]/20",
    icon: ShieldCheck,
  },
  sink: {
    label: "Sensitive Sink",
    pill: "bg-[#7d1c33]/15 text-[#7d1c33] dark:text-[#e05d7f] dark:bg-[#e05d7f]/20 border-[#7d1c33]/30 font-bold",
    icon: Terminal,
  },
  asset: {
    label: "Asset",
    pill: "bg-[#b85d38]/10 text-[#b85d38] dark:text-[#e28a65] dark:bg-[#e28a65]/15 border-[#b85d38]/20",
    icon: Database,
  },
  missing_check: {
    label: "Missing Control",
    pill: "bg-[#7d1c33]/10 text-[#7d1c33] dark:text-[#e05d7f] border-[#7d1c33]/30 border-dashed",
    icon: ShieldOff,
  },
};

export const LEGEND: NodeKind[] = ["source", "route", "variable", "transform", "call", "sanitizer", "sink", "asset", "missing_check"];

type FNode = Node<{ g: GraphNode; selected: boolean; onPath: boolean; dim: boolean; isCompact?: boolean }>;

function GNode({ data }: NodeProps<FNode>) {
  const m = KIND_META[data.g.kind];
  const Icon = m.icon;
  const isVulnerable = data.g.vulnerable;

  return (
    <div
      className={cn(
        "group relative w-[205px] rounded-2xl border border-white/80 dark:border-white/10 bg-white/75 dark:bg-card/75 px-3 py-2.5 backdrop-blur-xl shadow-[0_4px_16px_-2px_rgba(85,95,80,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
        data.selected && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg",
        data.dim && "opacity-40 grayscale-[20%]",
        isVulnerable && "border-[#7d1c33]/40 ring-1 ring-[#7d1c33]/30 shadow-[0_0_16px_rgba(125,28,51,0.15)] bg-white/90 dark:bg-card/90"
      )}
    >
      {/* Invisible connection handles */}
      <Handle type="target" position={Position.Left} id="left-in" className="!size-0 !border-0 !opacity-0" />
      <Handle type="source" position={Position.Right} id="right-out" className="!size-0 !border-0 !opacity-0" />
      <Handle type="target" position={Position.Right} id="right-in" className="!size-0 !border-0 !opacity-0" />
      <Handle type="source" position={Position.Left} id="left-out" className="!size-0 !border-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-out" className="!size-0 !border-0 !opacity-0" />
      <Handle type="target" position={Position.Top} id="top-in" className="!size-0 !border-0 !opacity-0" />

      {/* Top Header Pill Badge */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider", m.pill)}>
          <Icon className="size-2.5" />
          {m.label}
        </span>
        {isVulnerable && (
          <span className="flex size-4 items-center justify-center rounded-full bg-[#7d1c33]/15 text-[#7d1c33] dark:text-[#e05d7f]">
            <AlertTriangle className="size-2.5" />
          </span>
        )}
      </div>

      {/* Main Code Label */}
      <div
        className="font-mono text-[11.5px] font-semibold text-foreground truncate select-none leading-tight"
        title={data.g.label}
      >
        {data.g.label}
      </div>

      {/* File & Function Location */}
      {data.g.file && (
        <div className="mt-1.5 flex items-center gap-1 font-mono text-[9px] text-muted-foreground/85 truncate pt-1.5 border-t border-border/30">
          <FileCode className="size-2.5 shrink-0 opacity-60" />
          <span className="truncate">
            {data.g.file.split("/").pop()}:{data.g.line}
            {data.g.fn ? ` · ${data.g.fn}()` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { g: GNode };

// Layout with spacious 2-row or linear arrangement
function layout(nodes: GraphNode[], edges: GraphEdge[], mode: "compact" | "linear" = "compact") {
  const incoming = new Map<string, string[]>();
  edges.forEach((e) => incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]));
  const rank = new Map<string, number>();

  const visit = (id: string, stack: Set<string>): number => {
    if (rank.has(id)) return rank.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const r = Math.max(-1, ...(incoming.get(id) ?? []).map((p) => visit(p, stack))) + 1;
    stack.delete(id);
    rank.set(id, r);
    return r;
  };

  nodes.forEach((n) => visit(n.id, new Set()));
  const maxRank = Math.max(0, ...rank.values());
  const isChain = nodes.length >= 4 && nodes.length <= maxRank + 2;

  const pos = new Map<string, { x: number; y: number }>();

  if (mode === "compact" && isChain && nodes.length >= 4) {
    // Spacious 2-Row Snake Layout with wide breathing room
    // Row 0 (L -> R) and Row 1 (R -> L)
    const cols = Math.ceil(nodes.length / 2);
    const colSpacing = 320; // extra wide spacing between horizontal nodes to prevent edge label overlap
    const rowSpacing = 170; // generous vertical gap between rows for clear labels

    nodes.forEach((n) => {
      const r = rank.get(n.id) ?? 0;
      if (r < cols) {
        // Row 0: Left to Right
        pos.set(n.id, {
          x: r * colSpacing + 40,
          y: 40,
        });
      } else {
        // Row 1: Right to Left (aligned directly below row 0)
        const colIndex = (cols - 1) - (r - cols);
        pos.set(n.id, {
          x: colIndex * colSpacing + 40,
          y: 40 + rowSpacing,
        });
      }
    });
  } else {
    // Linear or DAG parallel branch layout
    const perRank = new Map<number, number>();
    nodes.forEach((n) => {
      const r = rank.get(n.id) ?? 0;
      const i = perRank.get(r) ?? 0;
      perRank.set(r, i + 1);
      pos.set(n.id, {
        x: r * 320 + 40,
        y: i * 160 + 50,
      });
    });
  }

  return pos;
}

export interface SecurityGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  riskyNodeIds?: Set<string>;
  selectedId?: string | null;
  onSelect?: (n: GraphNode | null) => void;
  onSelectEdge?: (e: GraphEdge) => void;
  selectedEdgeId?: string | null;
  className?: string;
  minimap?: boolean;
  fitKey?: string;
}

function Inner({
  nodes,
  edges,
  riskyNodeIds,
  selectedId,
  onSelect,
  onSelectEdge,
  selectedEdgeId,
  minimap = false,
  fitKey,
}: SecurityGraphProps) {
  const [layoutMode, setLayoutMode] = useState<"compact" | "linear">("compact");
  const pos = useMemo(() => layout(nodes, edges, layoutMode), [nodes, edges, layoutMode]);
  const rf = useReactFlow();
  const { settings } = useDB();
  const risky = riskyNodeIds ?? new Set(nodes.map((n) => n.id));

  const fnodes: FNode[] = nodes.map((n) => ({
    id: n.id,
    type: "g",
    position: pos.get(n.id) ?? { x: 0, y: 0 },
    data: {
      g: n,
      selected: n.id === selectedId,
      onPath: risky.has(n.id),
      dim: !risky.has(n.id),
    },
  }));

  const fedges: Edge[] = edges.map((e) => {
    const onPath = risky.has(e.from) && risky.has(e.to);
    const pFrom = pos.get(e.from) ?? { x: 0, y: 0 };
    const pTo = pos.get(e.to) ?? { x: 0, y: 0 };

    let sourceHandle = "right-out";
    let targetHandle = "left-in";

    // Auto-select clean handles so lines never slash diagonally across
    if (pTo.y > pFrom.y + 60) {
      // Direct vertical drop from top row to bottom row
      sourceHandle = "bottom-out";
      targetHandle = "top-in";
    } else if (pTo.x < pFrom.x - 60) {
      // Flowing Right to Left on bottom row
      sourceHandle = "left-out";
      targetHandle = "right-in";
    }

    return {
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle,
      targetHandle,
      type: "smoothstep",
      label: e.relation,
      className: cn(onPath && "risky", e.id === selectedEdgeId && "selected"),
      style: {
        strokeWidth: onPath ? 2 : 1.5,
        stroke: onPath ? "#7d1c33" : "rgba(126, 142, 123, 0.4)",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: onPath ? "#7d1c33" : "rgba(126, 142, 123, 0.5)",
      },
      selected: e.id === selectedEdgeId,
    };
  });

  const handleFitView = () => {
    rf.fitView({ padding: 0.2, duration: 300, minZoom: 0.5, maxZoom: 1.0 });
  };

  useEffect(() => {
    const t1 = setTimeout(handleFitView, 50);
    const t2 = setTimeout(handleFitView, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [fitKey, rf, nodes.length, layoutMode]);

  return (
    <div className="relative h-full w-full">
      {/* Floating Toolbar Pill (Compact Fit / Linear / Center View) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-2 py-1 backdrop-blur-xl shadow-xs">
        <button
          onClick={() => setLayoutMode("compact")}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
            layoutMode === "compact"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Fit nodes in view"
        >
          <LayoutGrid className="size-3" />
          Compact
        </button>

        <button
          onClick={() => setLayoutMode("linear")}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
            layoutMode === "linear"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Linear chain"
        >
          <MoveRight className="size-3" />
          Linear
        </button>

        <div className="h-3.5 w-px bg-border/60 mx-0.5" />

        <button
          onClick={handleFitView}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-all"
          title="Re-center"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      <ReactFlow
        nodes={fnodes}
        edges={fedges}
        nodeTypes={nodeTypes}
        colorMode={settings.theme === "dark" ? "dark" : "light"}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => onSelect?.((n.data as FNode["data"]).g)}
        onEdgeClick={(_, e) => {
          const ge = edges.find((x) => x.id === e.id);
          if (ge) onSelectEdge?.(ge);
        }}
        onPaneClick={() => onSelect?.(null)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color={settings.theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(126, 142, 123, 0.15)"}
        />
        <Controls showInteractive={false} position="bottom-left" />
        {minimap && (
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => ((n.data as FNode["data"]).g.vulnerable ? "#7d1c33" : "rgba(126, 142, 123, 0.6)")}
            maskColor={settings.theme === "dark" ? "rgba(22, 18, 20, 0.8)" : "rgba(247, 244, 237, 0.8)"}
          />
        )}
      </ReactFlow>
    </div>
  );
}

export function SecurityGraph(props: SecurityGraphProps) {
  return (
    <div className={cn("relative h-[480px] w-full overflow-hidden rounded-3xl border border-white/80 dark:border-white/10 bg-card/45 backdrop-blur-2xl shadow-xs", props.className)}>
      <ReactFlowProvider>
        <Inner {...props} />
      </ReactFlowProvider>
    </div>
  );
}

export function GraphLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 pt-2", className)}>
      {LEGEND.map((k) => {
        const m = KIND_META[k];
        const I = m.icon;
        return (
          <span key={k} className="inline-flex items-center gap-1.5 text-xs font-medium">
            <span className={cn("inline-flex items-center justify-center size-5 rounded-full border shadow-2xs", m.pill)}>
              <I className="size-2.5" />
            </span>
            <span className="text-muted-foreground">{m.label}</span>
          </span>
        );
      })}
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#7d1c33] dark:text-[#e05d7f]">
        <span className="h-0 w-6 border-t-[2px] border-dashed border-[#7d1c33] dark:border-[#e05d7f]" />
        Risky Taint Path
      </span>
    </div>
  );
}

export const kindLabel = (k: NodeKind) => KIND_META[k].label;
