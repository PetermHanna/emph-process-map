// Flow canvas on React Flow (xyflow, MIT) in the classic swimlane drawing: one lane per role, steps left to right.
// Company versions are editable by dropping, never by drawing lines: while a step (or a new Task, Choice or End from the
// palette) is dragged, the canvas shows its slots (the gaps between steps, one per branch of a choice); dropping it in a
// slot puts it there and redraws the links, and the lane it lands in sets its role. Lanes are predefined roles: "Add
// swimlane" offers the roles maintained in the app. Branch labels, targets (also loops back) and order are edited in the
// choice's properties. Microsoft reference flows are read-only.
import * as React from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, MarkerType, useReactFlow, useNodesInitialized, applyNodeChanges,
  type Node, type Edge, type NodeProps, type NodeChange,
} from "@xyflow/react";
import { tokens, Button, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Tag } from "@fluentui/react-components";
import { Add16Regular } from "@fluentui/react-icons";
import { FlowStep, STEP_TYPE, CHANGE } from "./shape";
import { XYFLOW_CSS } from "./xyflowcss";
import { Slot, Placed, slots as slotsOf, pickSlot, cutOff, place } from "./placement";

const W = 168, H = 62, COL = 214, LANE = 112, ROW = 86, HEAD = 128;
/** A step moved less than this was not really moved: it snaps back and nothing changes. */
const MIN_MOVE = COL * 0.3;
const LANE_COLOURS = ["#0D9488", "#7C3AED", "#2563EB", "#DB2777", "#EA580C", "#16A34A", "#0891B2", "#A16207"];
const CHANGE_COL: Record<number, string> = { [CHANGE.added]: "#107C10", [CHANGE.changed]: "#C27C00", [CHANGE.removed]: "#C50F1F" };

type StepData = { st: FlowStep; laneColour: string; selected: boolean; accent: string };
type LaneData = { name: string; colour: string; width: number; height: number; odd: boolean; hot?: boolean };
type SlotData = { hot: boolean; label: string };

function StepNode({ data }: NodeProps<Node<StepData>>) {
  const { st, laneColour, selected, accent } = data;
  const ch = CHANGE_COL[st.change];
  const border = selected ? accent : ch || "#D1D1D1";
  const common: React.CSSProperties = { width: W, minHeight: H, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center",
    fontFamily: tokens.fontFamilyBase, fontSize: 12.5, lineHeight: 1.25, color: "#242424", padding: "8px 10px", boxSizing: "border-box",
    boxShadow: selected ? "0 6px 18px rgba(13,148,136,.25)" : "0 2px 6px rgba(0,0,0,.10)", transition: "box-shadow .15s" };
  let shape: React.CSSProperties;
  if (st.type === STEP_TYPE.start || st.type === STEP_TYPE.end) shape = { borderRadius: 32, background: st.type === STEP_TYPE.start ? "linear-gradient(135deg,#E8F6EC,#D4EFDB)" : "linear-gradient(135deg,#E2E8F0,#CBD5E1)", border: `2px solid ${border}` };
  else if (st.type === STEP_TYPE.decision) shape = { background: "linear-gradient(135deg,#FEF9C3,#FDE68A)", border: `2px solid ${border}`, borderRadius: 10, clipPath: "polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%)" };
  else shape = { background: "#FFFFFF", border: `${selected ? 2.5 : 1.5}px solid ${border}`, borderRadius: 10, borderLeft: `6px solid ${laneColour}` };
  return (
    <div style={{ ...common, ...shape, opacity: st.change === CHANGE.removed ? 0.6 : 1 }}>
      <Handle type="target" position={Position.Left} isConnectable={false} style={{ background: "#8A8886", width: 6, height: 6, border: "none" }} />
      <div style={{ fontWeight: 600, textDecoration: st.change === CHANGE.removed ? "line-through" : undefined }}>{st.name}</div>
      {ch && <span style={{ position: "absolute", top: -5, right: -5, width: 11, height: 11, borderRadius: 6, background: ch, border: "2px solid #fff" }} />}
      <Handle type="source" position={Position.Right} isConnectable={false} style={{ background: "#8A8886", width: 6, height: 6, border: "none" }} />
    </div>
  );
}
function LaneNode({ data }: NodeProps<Node<LaneData>>) {
  return (
    <div style={{ width: data.width, height: data.height, background: data.hot ? "rgba(13,148,136,.06)" : data.odd ? "rgba(0,0,0,.025)" : "rgba(255,255,255,.6)",
      borderTop: "1px solid #E3E3E3", display: "flex", alignItems: "stretch", pointerEvents: "none", transition: "background .12s" }}>
      <div style={{ width: HEAD - 18, borderRight: `4px solid ${data.colour}`, display: "flex", alignItems: "center", padding: "0 10px", boxSizing: "border-box",
        fontFamily: tokens.fontFamilyBase, fontSize: 11.5, fontWeight: 700, color: data.colour, textTransform: "uppercase", letterSpacing: ".03em", lineHeight: 1.2 }}>{data.name || "No role"}</div>
    </div>
  );
}
// A place to drop: shown while dragging, the one that would be used is larger and blue.
function SlotNode({ data }: NodeProps<Node<SlotData>>) {
  const d = data.hot ? 26 : 14;
  return (
    <div style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ width: d, height: d, borderRadius: d, background: data.hot ? "#0D9488" : "#fff", border: "2px solid #0D9488", boxShadow: data.hot ? "0 0 0 6px rgba(13,148,136,.18)" : "none",
        color: "#fff", fontSize: 16, fontWeight: 700, lineHeight: d - 4 + "px", textAlign: "center", transition: "all .12s" }}>{data.hot ? "+" : ""}</div>
      {data.hot && data.label && <div style={{ position: "absolute", top: 28, whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, color: "#0D9488", background: "#fff", borderRadius: 6, padding: "1px 6px", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }}>{data.label}</div>}
    </div>
  );
}
const nodeTypes = { step: StepNode, lane: LaneNode, slot: SlotNode };

/** Column per step: longest path from the start, ignoring links that loop back. Steps never share a cell: when two land in the
 *  same lane and column (the branches of a decision), the next one goes on an extra row below and the lane grows. */
export function swimlaneLayout(steps: FlowStep[], extraLanes: string[] = []) {
  const by = new Map(steps.map(s => [s.code, s]));
  const lanes: string[] = [];
  steps.forEach(s => { if (!lanes.includes(s.func || "")) lanes.push(s.func || ""); });
  extraLanes.forEach(l => { if (!lanes.includes(l)) lanes.push(l); });
  const back = new Set<string>(); const state = new Map<string, number>();
  const dfs = (c: string) => { state.set(c, 1); for (const l of by.get(c)?.next || []) { if (!by.has(l.to)) continue; const t = state.get(l.to); if (t === 1) back.add(c + ">" + l.to); else if (!t) dfs(l.to); } state.set(c, 2); };
  const roots = steps.filter(s => s.type === STEP_TYPE.start).concat(steps.filter(s => !steps.some(o => o.next.some(l => l.to === s.code))));
  roots.forEach(r => { if (!state.get(r.code)) dfs(r.code); });
  steps.forEach(s => { if (!state.get(s.code)) dfs(s.code); });
  const col = new Map<string, number>(steps.map(s => [s.code, 0]));
  for (let i = 0; i < steps.length; i++) {
    let moved = false;
    steps.forEach(s => s.next.forEach(l => { if (!by.has(l.to) || back.has(s.code + ">" + l.to)) return; const c = col.get(s.code)! + 1; if (c > col.get(l.to)!) { col.set(l.to, c); moved = true; } }));
    if (!moved) break;
  }
  // order of discovery from the start, following links in their order: the first branch of a choice gets the top row
  const rank = new Map<string, number>(); const visit = (c: string) => { if (rank.has(c) || !by.has(c)) return; rank.set(c, rank.size); by.get(c)!.next.forEach(l => { if (!back.has(c + ">" + l.to)) visit(l.to); }); };
  roots.forEach(r => visit(r.code)); steps.forEach(s => visit(s.code));
  // Row hint per step: the n-th branch of a choice runs n rows below it (counting branches into the same lane), steps
  // follow their predecessor's row, and where branches meet again the step takes the highest (smallest) row.
  const hint = new Map<string, number>(), laneOf = (c: string) => by.get(c)?.func || "";
  steps.slice().sort((a, b) => col.get(a.code)! - col.get(b.code)! || rank.get(a.code)! - rank.get(b.code)!).forEach(a => {
    if (!hint.has(a.code)) hint.set(a.code, 0);
    const fwd = a.next.filter(l => by.has(l.to) && !back.has(a.code + ">" + l.to));
    fwd.forEach((l, i) => {
      const same = laneOf(l.to) === laneOf(a.code);
      const off = a.type === STEP_TYPE.decision ? fwd.slice(0, i).filter(z => laneOf(z.to) === laneOf(l.to) && z.to !== l.to).length : 0;
      const h = (same ? hint.get(a.code)! : 0) + off;
      if (!hint.has(l.to) || h < hint.get(l.to)!) hint.set(l.to, h);
    });
  });
  const taken = new Set<string>(), row = new Map<string, number>(), rows = lanes.map(() => 1);
  steps.slice().sort((a, b) => col.get(a.code)! - col.get(b.code)! || (hint.get(a.code) || 0) - (hint.get(b.code) || 0) || rank.get(a.code)! - rank.get(b.code)!).forEach(s => {
    const li = lanes.indexOf(s.func || ""), c = col.get(s.code)!; let r = hint.get(s.code) || 0;
    while (taken.has(li + ":" + c + ":" + r)) r++;
    taken.add(li + ":" + c + ":" + r); row.set(s.code, r); rows[li] = Math.max(rows[li], r + 1);
  });
  const laneH = rows.map(n => LANE + (n - 1) * ROW), laneTop: number[] = [];
  laneH.reduce((y, h, i) => { laneTop[i] = y; return y + h; }, 0);
  const cols = Math.max(0, ...Array.from(col.values())) + 1;
  const pos = new Map<string, { x: number; y: number }>();
  steps.forEach(s => { const li = lanes.indexOf(s.func || ""); pos.set(s.code, { x: HEAD + col.get(s.code)! * COL + (COL - W) / 2, y: laneTop[li] + (LANE - H) / 2 + row.get(s.code)! * ROW }); });
  return { lanes, pos, back, col, row, laneTop, laneH, width: HEAD + cols * COL + 20, height: laneH.reduce((a, b) => a + b, 0) };
}

const PALETTE = [
  { type: STEP_TYPE.task, label: "Activity", style: { borderRadius: 6, background: "#fff", borderLeft: "5px solid #0D9488" } },
  { type: STEP_TYPE.decision, label: "Decision", style: { borderRadius: 6, background: "linear-gradient(135deg,#FEF9C3,#FDE68A)", clipPath: "polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%)", padding: "4px 18px" } },
  { type: STEP_TYPE.end, label: "End", style: { borderRadius: 16, background: "linear-gradient(135deg,#E2E8F0,#CBD5E1)" } },
];
const DRAG_TYPE = "application/x-emph-activity";

interface Props {
  steps: FlowStep[]; selected: string | null; colour: string; editable: boolean;
  onSelect: (code: string, to?: string) => void;
  /** a drop that changed the flow: the whole new list, the changed codes and the new step's code */
  onPlace?: (p: Placed) => void;
  /** code and sort number for a new step */
  newStep?: () => { code: string; sort: number; flowId: string };
  /** a drop that was refused, with the reason */
  onRefuse?: (message: string) => void;
  onUndo?: () => void; canUndo?: boolean;
  /** the predefined roles a new swimlane can be added for */
  roles?: string[];
}

function Canvas({ steps, selected, colour, editable, onSelect, onPlace, newStep, onRefuse, extraLanes }: Props & { extraLanes: string[] }) {
  const rf = useReactFlow();
  const lay = React.useMemo(() => swimlaneLayout(steps, extraLanes), [steps, extraLanes]);
  const laneColour = (f: string) => LANE_COLOURS[Math.max(0, lay.lanes.indexOf(f || "")) % LANE_COLOURS.length];
  // while dragging: what is dragged, the slot and the lane it would land in
  const [drag, setDrag] = React.useState<{ code: string | null; type: number | null; slot: Slot | null; lane: number } | null>(null);
  const geo = React.useMemo(() => ({ pos: lay.pos, back: lay.back, W, H, ROW }), [lay]);
  const allSlots = React.useMemo(() => (drag ? slotsOf(steps, geo, drag.code) : []), [steps, geo, drag?.code]);
  // above the first lane or below the last one counts as that lane: only predefined roles are lanes, a drop never makes one
  const laneAt = (y: number) => { const i = lay.laneTop.findIndex((t, k) => y >= t && y < t + lay.laneH[k]); return i >= 0 ? i : y < 0 ? 0 : lay.lanes.length - 1; };
  // A drag goes by the pointer, not by the node's stored position, which can lag behind it: the dot that lights up is the one used.
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);
  const pointer = (e: any) => { const t = e?.changedTouches?.[0] || e; return rf.screenToFlowPosition({ x: t.clientX, y: t.clientY }); };
  const originOf = (code: string | null) => (code ? dragStart.current : null);
  const pick = (x: number, y: number, code: string | null) =>
    pickSlot(slotsOf(steps, geo, code), x, y, { origin: originOf(code), hitX: COL * 0.35, hitY: ROW * 0.6, straight: COL * 0.35, column: COL * 0.5, laneAt });
  /** the lane a drop lands in: a further branch of a choice stays with the choice */
  const laneFor = (slot: Slot | null, y: number) => {
    const from = slot?.stacked ? steps.find(s => s.code === slot.from) : null;
    return from ? Math.max(0, lay.lanes.indexOf(from.func || "")) : laneAt(y);
  };
  /** barely moved: nothing is meant, not even a change of lane */
  const barelyMoved = (x: number, y: number, code: string | null) => { const o = originOf(code); return !!o && Math.hypot(x - o.x, y - o.y) < MIN_MOVE; };
  const hover = (x: number, y: number, code: string | null, type: number | null) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const o = originOf(code);
    const slot = barelyMoved(x, y, code) ? null : pick(x, y, code);
    setDrag({ code, type, slot, lane: barelyMoved(x, y, code) && o ? laneAt(o.y) : laneFor(slot, y) });
  };

  const build = React.useCallback((): Node[] => [
    ...lay.lanes.map((name, i) => ({ id: "lane:" + i, type: "lane", position: { x: 0, y: lay.laneTop[i] }, draggable: false, selectable: false, connectable: false, zIndex: -1,
      data: { name, colour: laneColour(name), width: lay.width, height: lay.laneH[i], odd: i % 2 === 1 } } as Node)),
    ...steps.map(s => ({ id: s.code, type: "step", draggable: editable && s.type !== STEP_TYPE.start, connectable: false, position: lay.pos.get(s.code)!,
      data: { st: s, laneColour: laneColour(s.func), selected: selected === s.code, accent: colour } } as Node)),
  ], [steps, lay, selected, colour, editable]);
  const [nodes, setNodes] = React.useState<Node[]>(build);
  /** back to the drawn positions; sizes already measured are kept */
  const redraw = React.useCallback(() => setNodes(ns => { const size = new Map(ns.map(n => [n.id, n.measured])); return build().map(n => (size.get(n.id) ? { ...n, measured: size.get(n.id) } : n)); }), [build]);
  React.useEffect(() => { redraw(); }, [redraw]);
  // drag feedback: the lane the step would land in, and the slots
  const shown: Node[] = React.useMemo(() => {
    if (!drag) return nodes;
    const lanes = nodes.map(n => (n.type === "lane" ? { ...n, data: { ...n.data, hot: n.id === "lane:" + drag.lane } } : n));
    const dots: Node[] = allSlots.map(sl => ({ id: "slot:" + sl.id, type: "slot", position: { x: sl.x - 13, y: sl.y - 13 }, draggable: false, selectable: false, zIndex: 5, measured: { width: 26, height: 26 },
      data: { hot: !!drag.slot && drag.slot.id === sl.id, label: sl.label ? "on " + sl.label : "" } } as Node));
    return [...lanes, ...dots];
  }, [nodes, drag, allSlots]);

  const edges: Edge[] = React.useMemo(() => {
    const codes = new Set(steps.map(s => s.code));
    return steps.flatMap(s => s.next.filter(l => codes.has(l.to)).map((l, i) => {
      const hot = selected === s.code, loop = lay.back.has(s.code + ">" + l.to);
      return { id: s.code + ">" + l.to + ">" + i, source: s.code, target: l.to, label: l.label || undefined, type: "smoothstep",
        animated: hot, deletable: false, focusable: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: hot ? colour : "#605E5C" },
        style: { stroke: hot ? colour : "#8A8886", strokeWidth: hot ? 2.4 : 1.6, strokeDasharray: loop ? "6 4" : undefined, cursor: "pointer" },
        labelStyle: { fontSize: 11, fill: "#323130", fontWeight: 600 }, labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 6, labelBgStyle: { fill: "#FFFFFF", stroke: "#E0E0E0" } } as Edge;
    }));
  }, [steps, selected, colour, lay]);

  // Open at a readable size: fit the whole flow if it stays legible, otherwise start at the first steps.
  const ready = useNodesInitialized();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const t = setTimeout(() => setTick(x => x + 1), 180); return () => clearTimeout(t); }, [steps.length]);
  const fitted = React.useRef("");
  const wrap = React.useRef<HTMLDivElement>(null);
  const key = steps.map(s => s.code).join("|");
  React.useEffect(() => {
    if ((!ready && !tick) || fitted.current === key || !rf.getNodes().length) return;
    fitted.current = key;
    const box = wrap.current?.getBoundingClientRect() || { width: 900, height: 460 };
    const h = lay.height + (editable ? LANE : 0);
    const zoom = Math.max(0.75, Math.min(1, box.width / lay.width, (box.height - 10) / h));
    rf.setViewport({ x: lay.width * zoom <= box.width ? (box.width - lay.width * zoom) / 2 : 0, y: Math.max(0, (box.height - h * zoom) / 2), zoom }, { duration: 250 });
  }, [ready, key, tick]);

  // keeps React Flow's measurements as well as positions: without them a re-render during a drag makes its coordinates NaN
  const onNodesChange = (ch: NodeChange[]) => setNodes(ns => applyNodeChanges(ch, ns));

  const finish = (what: { code: string } | { type: number }, x: number, y: number) => {
    const code = "code" in what ? what.code : null;
    setDrag(null);
    if (!onPlace || !Number.isFinite(x) || !Number.isFinite(y) || barelyMoved(x, y, code)) { redraw(); return; }
    const sl = pick(x, y, code);
    const lane = lay.lanes[laneFor(sl, y)] ?? "";
    const res = "code" in what ? place(steps, what, lane, sl, lay.back) : newStep ? place(steps, { type: what.type, ...newStep() }, lane, sl, lay.back) : null;
    if (!res) { redraw(); return; }
    const lost = cutOff(steps, res.steps);
    if (lost.length) {
      redraw();
      onRefuse?.("Not placed: this would cut off \"" + lost[0] + "\"" + (lost.length > 1 ? " and " + (lost.length - 1) + " more" : "") + " from the start of the flow. An End fits on a branch of a choice whose other branch carries on.");
      return;
    }
    onPlace(res);
  };
  // palette: HTML drag from the toolbar onto the canvas
  const flowPoint = (e: React.DragEvent) => rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
  const paletteType = (e: React.DragEvent) => { const t = e.dataTransfer.types.includes(DRAG_TYPE) ? Number(e.dataTransfer.getData(DRAG_TYPE) || (window as any).__emphDragType) : NaN; return isNaN(t) ? null : t; };

  return (
    <div ref={wrap} style={{ width: "100%", height: "100%" }}
      onDragOver={e => { const t = paletteType(e); if (t == null || !editable) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; const p = flowPoint(e); hover(p.x, p.y, null, t); }}
      onDragLeave={e => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as any)) setDrag(null); }}
      onDrop={e => { const t = paletteType(e); if (t == null || !editable) return; e.preventDefault(); const p = flowPoint(e); finish({ type: t }, p.x, p.y); }}>
      <ReactFlow nodes={shown} edges={edges} nodeTypes={nodeTypes} minZoom={0.3} maxZoom={1.6} proOptions={{ hideAttribution: true }}
        translateExtent={[[-120, -240], [lay.width + 120, lay.height + 240]]}
        nodesDraggable={editable} nodesConnectable={false} elementsSelectable
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => { if (n.type === "step") onSelect(n.id); }}
        onEdgeClick={(_, e) => onSelect(e.source, e.target)}
        onNodeDragStart={(e, n) => { if (n.type === "step") dragStart.current = pointer(e); }}
        onNodeDrag={(e, n) => { if (n.type === "step") { const p = pointer(e); hover(p.x, p.y, n.id, null); } }}
        onNodeDragStop={(e, n) => { if (n.type === "step") { const p = pointer(e); finish({ code: n.id }, p.x, p.y); } }}
        deleteKeyCode={null}>
        <Background gap={18} color="#EDEDED" />
        <Controls showInteractive={false} position="bottom-left" fitViewOptions={{ padding: 0.08, duration: 300 }} />
        <MiniMap pannable zoomable position="bottom-right" nodeColor={n => (n.type === "lane" || n.type === "slot" ? "transparent" : (n.data as StepData)?.laneColour || "#ccc")} style={{ width: 150, height: 90 }} />
      </ReactFlow>
    </div>
  );
}

function Palette({ onUndo, canUndo, addable, empty, onAddLane, onDropLane }: { onUndo?: () => void; canUndo?: boolean; addable: string[]; empty: string[]; onAddLane: (role: string) => void; onDropLane: (role: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontFamily: tokens.fontFamilyBase, fontSize: 12 }}>
      <span style={{ color: "#616161" }}>Drag in:</span>
      {PALETTE.map(p => (
        <div key={p.type} draggable title={"Drag a new " + p.label.toLowerCase() + " onto the flow"}
          onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, String(p.type)); (window as any).__emphDragType = p.type; e.dataTransfer.effectAllowed = "copy"; }}
          style={{ cursor: "grab", padding: "4px 12px", border: "1px solid #D1D1D1", boxShadow: "0 1px 3px rgba(0,0,0,.08)", fontWeight: 600, color: "#242424", userSelect: "none", ...p.style }}>{p.label}</div>
      ))}
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button size="small" icon={<Add16Regular />} disabled={!addable.length} title={addable.length ? "Add a lane for a predefined role" : "Every predefined role already has a lane"}>Add swimlane</Button>
        </MenuTrigger>
        <MenuPopover><MenuList>{addable.map(r => <MenuItem key={r} onClick={() => onAddLane(r)}>{r}</MenuItem>)}</MenuList></MenuPopover>
      </Menu>
      {empty.map(r => <Tag key={r} size="small" appearance="outline" dismissible dismissIcon={{ "aria-label": "Remove the empty lane " + r, onClick: () => onDropLane(r) } as any}>{r}</Tag>)}
      <span style={{ color: "#616161", flex: 1, minWidth: 220 }}>Drop a step on a dot to place it; the lane sets the role. Straight up or down changes the role only. Click a line or a choice to edit its branches.</span>
      {onUndo && <button disabled={!canUndo} onClick={onUndo} style={{ border: "1px solid #D1D1D1", background: "#fff", borderRadius: 6, padding: "3px 10px", cursor: canUndo ? "pointer" : "default", opacity: canUndo ? 1 : 0.5 }}>↶ Undo</button>}
    </div>
  );
}

export function FlowCanvas(p: Props) {
  // lanes asked for with "Add swimlane" that have no step yet; they exist only here until a step lands in them
  const [added, setAdded] = React.useState<string[]>([]);
  const used = React.useMemo(() => Array.from(new Set(p.steps.map(s => s.func || ""))), [p.steps]);
  const empty = React.useMemo(() => added.filter(l => !used.includes(l)), [added, used]);
  const addable = (p.roles || []).filter(r => !used.includes(r) && !empty.includes(r));
  // extra room when a lane has branch rows (so the mini-map does not cover the lower row) and for the branch dots below the last lane
  const lay = React.useMemo(() => swimlaneLayout(p.steps, empty), [p.steps, empty]);
  const h = Math.max(190, Math.min(640, lay.height + (lay.laneH.some(x => x > LANE) ? 120 : 70) + (p.editable ? 60 : 0)));
  return (<>
    {p.editable && <Palette onUndo={p.onUndo} canUndo={p.canUndo} addable={addable} empty={empty} onAddLane={r => setAdded(a => a.concat(r))} onDropLane={r => setAdded(a => a.filter(x => x !== r))} />}
    <div style={{ width: "100%", height: h, border: "1px solid #E0E0E0", borderRadius: 10, background: "#FAFAFA", position: "relative" }}>
      <style>{XYFLOW_CSS}</style>
      <ReactFlowProvider><Canvas {...p} extraLanes={empty} /></ReactFlowProvider>
    </div>
  </>);
}
