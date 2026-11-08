// Look and feel: a teal brand on a slate navigation rail, card pages, 12px corners.
import { BrandVariants, createLightTheme, makeStyles, shorthands, Theme } from "@fluentui/react-components";

const teal: BrandVariants = {
  10: "#021A18", 20: "#04302C", 30: "#06433E", 40: "#085650", 50: "#0A6962", 60: "#0C7C74", 70: "#0D9488", 80: "#14A89B",
  90: "#2DBBAE", 100: "#4CCBBF", 110: "#6DD8CE", 120: "#8FE3DB", 130: "#B0ECE6", 140: "#CCF3EF", 150: "#E3F9F6", 160: "#F2FCFB",
};
export const theme: Theme = { ...createLightTheme(teal), fontFamilyBase: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif", borderRadiusMedium: "8px", borderRadiusLarge: "12px" };

export const C = {
  rail: "#0F172A", railHover: "#1E293B", railText: "#CBD5E1", railActive: "#0D9488",
  page: "#F8FAFC", card: "#FFFFFF", line: "#E2E8F0", ink: "#0F172A", muted: "#64748B",
  ok: "#16A34A", warn: "#D97706", bad: "#DC2626", info: "#2563EB",
};

export const useLook = makeStyles({
  shell: { display: "flex", minHeight: "640px", backgroundColor: C.page, color: C.ink, fontFamily: theme.fontFamilyBase, ...shorthands.borderRadius("12px"), overflow: "hidden", ...shorthands.border("1px", "solid", C.line) },
  rail: { width: "208px", flexShrink: 0, backgroundColor: C.rail, color: C.railText, display: "flex", flexDirection: "column", ...shorthands.padding("16px", "10px"), rowGap: "4px" },
  brand: { display: "flex", alignItems: "center", columnGap: "10px", ...shorthands.padding("4px", "8px", "18px") },
  brandMark: { width: "30px", height: "30px", ...shorthands.borderRadius("8px"), backgroundColor: C.railActive, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "12px", letterSpacing: "0.5px" },
  navItem: {
    display: "flex", alignItems: "center", columnGap: "10px", ...shorthands.padding("9px", "12px"), ...shorthands.borderRadius("8px"), cursor: "pointer",
    backgroundColor: "transparent", color: C.railText, ...shorthands.border("0"), fontSize: "14px", textAlign: "left", width: "100%",
    ":hover": { backgroundColor: C.railHover, color: "#fff" },
  },
  navActive: { backgroundColor: C.railActive, color: "#fff", ":hover": { backgroundColor: C.railActive } },
  navFoot: { marginTop: "auto", fontSize: "11px", color: "#64748B", ...shorthands.padding("8px", "12px") },
  main: { flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  top: { display: "flex", alignItems: "center", columnGap: "12px", ...shorthands.padding("18px", "28px", "8px") },
  title: { fontSize: "22px", fontWeight: 600, margin: 0 },
  sub: { color: C.muted, fontSize: "13px" },
  body: { ...shorthands.padding("8px", "28px", "28px"), display: "flex", flexDirection: "column", rowGap: "16px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", ...shorthands.gap("14px") },
  card: { backgroundColor: C.card, ...shorthands.border("1px", "solid", C.line), ...shorthands.borderRadius("12px"), ...shorthands.padding("16px"), boxShadow: "0 1px 2px rgba(15,23,42,.06)" },
  cardClick: { cursor: "pointer", ":hover": { boxShadow: "0 6px 18px rgba(15,23,42,.10)", ...shorthands.borderColor(C.railActive) } },
  stat: { fontSize: "28px", fontWeight: 700, lineHeight: "32px" },
  statLabel: { color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.6px" },
  row: { display: "flex", alignItems: "center", flexWrap: "wrap", ...shorthands.gap("8px") },
  split: { display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", ...shorthands.gap("16px"), alignItems: "start" },
  muted: { color: C.muted },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px", "& th": { textAlign: "left", color: C.muted, fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", ...shorthands.padding("8px"), ...shorthands.borderBottom("1px", "solid", C.line) }, "& td": { ...shorthands.padding("8px"), ...shorthands.borderBottom("1px", "solid", "#F1F5F9"), verticalAlign: "top" } },
  tr: { cursor: "pointer", ":hover": { backgroundColor: "#F0FDFA" } },
  tree: { display: "flex", flexDirection: "column", rowGap: "2px", fontSize: "13px" },
  node: { display: "flex", alignItems: "center", columnGap: "6px", ...shorthands.padding("6px", "8px"), ...shorthands.borderRadius("6px"), cursor: "pointer", ":hover": { backgroundColor: "#F1F5F9" } },
  nodeOn: { backgroundColor: "#CCF3EF", ":hover": { backgroundColor: "#CCF3EF" } },
  code: { fontFamily: "Consolas, monospace", fontSize: "11px", color: C.muted, minWidth: "54px" },
  bar: { height: "6px", ...shorthands.borderRadius("3px"), backgroundColor: "#E2E8F0", overflow: "hidden" },
  section: { fontSize: "12px", fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginTop: "6px" },
  fields: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", ...shorthands.gap("12px") },
});
