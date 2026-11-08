// The app frame: navigation rail on the left, one page on the right.
import * as React from "react";
import { FluentProvider, Spinner, Button, Tooltip } from "@fluentui/react-components";
import {
  Board20Regular, BranchFork20Regular, TaskListLtr20Regular, PeopleTeam20Regular, Signature20Regular, Apps20Regular, Settings20Regular,
  FullScreenMaximize20Regular, FullScreenMinimize20Regular, ArrowSync20Regular,
} from "@fluentui/react-icons";
import { theme, useLook } from "./look";
import { Problem } from "./kit";
import type { Model } from "../domain/types";
import { loadModel, Repository } from "../domain/repository";
import type { Gateway } from "../data/api";
import { Overview } from "./pages/Overview";
import { Processes } from "./pages/Processes";
import { Requirements } from "./pages/Requirements";
import { Workshops } from "./pages/Workshops";
import { SignOffs } from "./pages/SignOffs";
import { Applications } from "./pages/Applications";
import { Settings } from "./pages/Settings";

export type PageKey = "overview" | "processes" | "requirements" | "workshops" | "signoff" | "applications" | "settings";
export interface Nav { go: (page: PageKey, focus?: string | null) => void; focus: string | null }

const PAGES: { key: PageKey; label: string; icon: React.ReactElement; hint: string }[] = [
  { key: "overview", label: "Overview", icon: <Board20Regular />, hint: "Scope and progress across the end-to-end processes" },
  { key: "processes", label: "Processes", icon: <BranchFork20Regular />, hint: "End-to-end processes, process areas and business processes" },
  { key: "requirements", label: "Requirements", icon: <TaskListLtr20Regular />, hint: "What standard doesn't cover, with priority and coverage" },
  { key: "workshops", label: "Workshops", icon: <PeopleTeam20Regular />, hint: "Guided discovery sessions" },
  { key: "signoff", label: "Sign-off", icon: <Signature20Regular />, hint: "Frozen, approved versions of the scope and requirements" },
  { key: "applications", label: "Applications", icon: <Apps20Regular />, hint: "Current and target applications" },
  { key: "settings", label: "Settings", icon: <Settings20Regular />, hint: "Organisation and roles" },
];

export interface ShellProps { gateway: Gateway; user: { id: string | null; name: string }; fullScreen?: { supported: boolean; set: (on: boolean) => void } }

export function Shell({ gateway, user, fullScreen }: ShellProps) {
  const l = useLook();
  const repo = React.useMemo(() => new Repository(gateway), [gateway]);
  const [model, setModel] = React.useState<Model | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [page, setPage] = React.useState<PageKey>("overview");
  const [focus, setFocus] = React.useState<string | null>(null);
  const [full, setFull] = React.useState(false);
  const latest = React.useRef<Model | null>(null);
  latest.current = model;

  const reload = React.useCallback(() => { setModel(null); loadModel(gateway).then(setModel).catch(e => setProblem("Could not load: " + (e?.message || e))); }, [gateway]);
  React.useEffect(reload, [reload]);

  const apply = React.useCallback(async (fn: (m: Model) => Promise<Model>) => {
    if (!latest.current) return;
    setProblem(null);
    try { const next = await fn(latest.current); latest.current = next; setModel(next); }
    catch (e: any) { setProblem(e?.message || String(e)); }
  }, []);
  const nav: Nav = { go: (p, f = null) => { setPage(p); setFocus(f); }, focus };
  const current = PAGES.find(p => p.key === page)!;

  return (
    <FluentProvider theme={theme} style={{ background: "transparent" }}>
      <div className={l.shell} data-emph="shell">
        <nav className={l.rail} aria-label="EMPH Process Map">
          <div className={l.brand}><div className={l.brandMark}>EM</div><div><div style={{ color: "#fff", fontWeight: 600 }}>EMPH</div><div style={{ fontSize: 11 }}>Process Map</div></div></div>
          {PAGES.map(p => (
            <button key={p.key} data-emph={"nav-" + p.key} className={l.navItem + (p.key === page ? " " + l.navActive : "")} aria-current={p.key === page ? "page" : undefined} onClick={() => nav.go(p.key)}>
              {p.icon}<span>{p.label}</span>
            </button>
          ))}
          <div className={l.navFoot}>{model?.workspace.organisation || "Your organisation"}<br />Based on the Microsoft Business Process Catalog</div>
        </nav>
        <main className={l.main}>
          <header className={l.top}>
            <div style={{ flexGrow: 1 }}><h1 className={l.title}>{current.label}</h1><div className={l.sub}>{current.hint}</div></div>
            <Tooltip content="Reload" relationship="label"><Button appearance="subtle" icon={<ArrowSync20Regular />} onClick={reload} /></Tooltip>
            {fullScreen?.supported && <Tooltip content={full ? "Exit full screen" : "Full screen"} relationship="label">
              <Button appearance="subtle" icon={full ? <FullScreenMinimize20Regular /> : <FullScreenMaximize20Regular />} onClick={() => { fullScreen.set(!full); setFull(!full); }} />
            </Tooltip>}
          </header>
          <div className={l.body}>
            <Problem text={problem} onClose={() => setProblem(null)} />
            {!model ? <Spinner label="Loading" /> : (
              <>
                {page === "overview" && <Overview model={model} repo={repo} apply={apply} nav={nav} />}
                {page === "processes" && <Processes model={model} repo={repo} apply={apply} nav={nav} />}
                {page === "requirements" && <Requirements model={model} repo={repo} apply={apply} nav={nav} />}
                {page === "workshops" && <Workshops model={model} repo={repo} apply={apply} nav={nav} />}
                {page === "signoff" && <SignOffs model={model} repo={repo} apply={apply} user={user} />}
                {page === "applications" && <Applications model={model} repo={repo} apply={apply} />}
                {page === "settings" && <Settings model={model} repo={repo} apply={apply} />}
              </>
            )}
          </div>
        </main>
      </div>
    </FluentProvider>
  );
}
