import { Background, Handle, Position, ReactFlow, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Brain, Check, ClipboardList, FileText, Hammer, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import { memo, useEffect, useMemo, useRef } from "react";
import { useOnScreen } from "../../lib/motion";
import AgentGlyph from "../../components/AgentGlyph";
import { AGENT_HEX, NEUTRAL, tint } from "../../lib/agents";
import PacketEdge from "./PacketEdge";
import { deriveGraph } from "./state";

const ICON = { planner: ClipboardList, researcher: Search, builder: Hammer, reviewer: ShieldCheck, brain: Brain, task: FileText };
const COLOR = { ...AGENT_HEX, task: NEUTRAL.mute };
const LABEL = { planner: "Planner", researcher: "Researcher", builder: "Builder", reviewer: "Reviewer", brain: "Shared brain", task: "Your task" };

const AgentNode = memo(function AgentNode({ data }) {
  const { id, status = "idle", message, lit, revision, paused } = data;
  const Icon = status === "error" ? TriangleAlert : ICON[id];
  const color = COLOR[id];
  const thinking = status === "active" || lit;
  const state = thinking ? "thinking" : status === "idle" ? "idle" : status;
  return (
    <div
      className={`w-32 rounded-xl border bg-panel px-3 py-2.5 text-center transition-colors duration-300 ${
        state === "idle" ? "node-idle" : state === "thinking" ? "node-thinking" : ""
      } ${revision && thinking ? "node-revision" : ""}`}
      style={{
        borderColor: status === "error" ? NEUTRAL.alert : thinking || status === "done" ? (revision ? AGENT_HEX.builder : color) : NEUTRAL.line,
        "--ring": revision ? AGENT_HEX.builder : color,
      }}
      aria-hidden="true"
      data-testid={`node-${id}`}
      data-status={status}
      data-state={state}
      data-paused={paused ? "true" : "false"}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: tint(color, 13), color }}>
        {status === "done" ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="flex" aria-hidden="true">
            <Check size={16} style={{ color: AGENT_HEX.reviewer }} />
          </motion.span>
        ) : id === "task" || status === "error" ? (
          <Icon size={16} />
        ) : (
          <AgentGlyph id={id} size={18} />
        )}
      </div>
      <div className={`font-mono text-[11px] font-bold uppercase tracking-wider ${state === "thinking" && !paused ? "shimmer-text" : ""}`} style={{ color }}>
        {LABEL[id]}
      </div>
      <div className="mt-0.5 line-clamp-2 min-h-[2rem] text-[10px] leading-4 text-mute">{message || (status === "idle" ? "idle" : "")}</div>
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
      <Handle id="top" type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
    </div>
  );
});

const nodeTypes = { agent: AgentNode };
const edgeTypes = { packet: PacketEdge };

// The diagram is display-only, so replace the default "press delete to remove it" screen-reader text.
const ARIA_LABELS = {
  "node.a11yDescription.default": "Display only: this diagram shows agent progress and can't be edited.",
  "node.a11yDescription.keyboardDisabled": "Display only: this diagram shows agent progress and can't be edited.",
  "edge.a11yDescription.default": "Display only: this connection shows where work is handed off.",
};

const POS = {
  task: { x: 0, y: 70 },
  planner: { x: 160, y: 70 },
  researcher: { x: 320, y: 0 },
  brain: { x: 320, y: 150 },
  builder: { x: 480, y: 70 },
  reviewer: { x: 640, y: 70 },
};

const EDGES = [
  { id: "task>planner", source: "task", target: "planner" },
  { id: "planner>researcher", source: "planner", target: "researcher" },
  { id: "brain>researcher", source: "brain", target: "researcher", dim: true },
  { id: "researcher>builder", source: "researcher", target: "builder" },
  { id: "builder>reviewer", source: "builder", target: "reviewer" },
  { id: "reviewer>builder", source: "reviewer", target: "builder", sourceHandle: "bottom", targetHandle: "top", back: true },
];

/** React Flow only fits once on load, so re-fit whenever the container changes size. */
function FitOnResize({ containerRef }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let frame;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitView({ padding: 0.12, duration: 0 }));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [containerRef, fitView]);
  return null;
}

/** Glide the camera to a few nodes (the scroll scene follows the active agent and its neighbours); the whole graph when unset. */
function FocusNodes({ ids }) {
  const { fitView } = useReactFlow();
  const key = ids?.join() ?? "";
  useEffect(() => {
    const list = key ? key.split(",") : [];
    fitView(list.length ? { nodes: list.map((id) => ({ id })), duration: 600, padding: 0.4, maxZoom: 1.25 } : { padding: 0.12, duration: 600 });
  }, [key, fitView]);
  return null;
}

export default function AgentGraph({ events, running, focus, id = "mission-graph", className = "h-[270px]", onInspect, inspectable }) {
  const g = useMemo(() => deriveGraph(events), [events]);
  const boxRef = useRef(null);
  const onScreen = useOnScreen(boxRef); // looping rings pause when the graph is off-screen or the tab is hidden

  const nodes = useMemo(
    () =>
      Object.entries(POS).map(([id, position]) => ({
        id,
        type: "agent",
        position,
        draggable: false,
        selectable: false,
        focusable: false,
        style: inspectable?.has(id) ? { cursor: "pointer" } : undefined,
        data:
          id === "task"
            ? { id, status: events.length ? "done" : "idle", message: events.length ? "received" : "waiting", paused: !onScreen }
            : id === "brain"
              ? { id, status: "idle", lit: g.agents.researcher.status === "active", message: "RAG over projects, skills, experience", paused: !onScreen }
              : { id, ...g.agents[id], paused: !onScreen },
      })),
    [g, events.length, onScreen, inspectable],
  );

  const edges = useMemo(
    () =>
      EDGES.map((e) => {
        const active = g.activeEdge === e.id || (e.id === "brain>researcher" && g.agents.researcher.status === "active");
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          focusable: false,
          selectable: false,
          deletable: false,
          animated: active || (running && e.source === "task" && !events.length),
          type: "packet",
          data: { active: active && onScreen, revision: !!e.back, back: !!e.back },
          style: { stroke: NEUTRAL.line2, strokeWidth: active ? 2.5 : 1.5, strokeDasharray: e.dim || e.back ? "4 4" : undefined },
        };
      }),
    [g, running, events.length, onScreen],
  );

  return (
    <div
      ref={boxRef}
      id={id}
      className={`${className} w-full overflow-hidden rounded-2xl border border-line bg-void/60`}
      role="img"
      aria-label="Agent graph: the planner, researcher, builder and reviewer hand work to each other"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        /* clicking an agent with a trace opens the inspector (keyboard users have the inspect buttons in the log) */
        onNodeClick={onInspect ? (_, node) => inspectable?.has(node.id) && onInspect(node.id) : undefined}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        disableKeyboardA11y
        ariaLabelConfig={ARIA_LABELS}
        minZoom={0.3}
      >
        {focus === undefined ? <FitOnResize containerRef={boxRef} /> : <FocusNodes ids={focus} />}
        <Background color={NEUTRAL.line} gap={22} size={1} />
      </ReactFlow>
    </div>
  );
}
