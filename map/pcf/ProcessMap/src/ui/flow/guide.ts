// The guide (Chrome or Edge extension in guide/) marks the Dynamics 365 page with data-emph-guide="<version>".
// Playing a flow: leave the id on the page and raise "emph-guide-start" (the extension stores the request), then open a new
// tab with ?emphguide=<id>, which the guide also reads on its own. The new tab plays the flow over the live app.
import * as React from "react";

const docs = (): Document[] => {
  const out: Document[] = [document];
  try { if (window.top && window.top !== window && window.top.document) out.push(window.top.document); } catch { /* another origin */ }
  return out;
};

export const guideVersion = (): string | null => {
  for (const d of docs()) { const v = d.documentElement.getAttribute("data-emph-guide"); if (v) return v; }
  return null;
};

export function useGuide(): string | null {
  const [v, setV] = React.useState<string | null>(guideVersion);
  React.useEffect(() => {
    if (v) return;
    const obs = docs().map(d => { const o = new MutationObserver(() => { const x = guideVersion(); if (x) setV(x); }); o.observe(d.documentElement, { attributes: true, attributeFilter: ["data-emph-guide"] }); return o; });
    return () => obs.forEach(o => o.disconnect());
  }, [v]);
  return v;
}

export function guideUrl(flowId: string, loc: { origin: string; pathname: string; search: string } = location): string {
  const app = new URLSearchParams(loc.search).get("appid");
  const q = new URLSearchParams();
  if (app) q.set("appid", app);
  q.set("emphguide", flowId);
  return loc.origin + "/main.aspx?" + q.toString();
}

export function playInGuide(flowId: string, code?: string): void {
  for (const d of docs()) {
    d.documentElement.setAttribute("data-emph-guide-start", flowId);
    d.defaultView?.dispatchEvent(new CustomEvent("emph-guide-start", { detail: { flowId, code: code || null } }));
  }
  let loc: Location = location;
  try { if (window.top && window.top.location.origin === location.origin) loc = window.top.location; } catch { /* keep ours */ }
  window.open(guideUrl(flowId, loc), "_blank", "noopener");
}
