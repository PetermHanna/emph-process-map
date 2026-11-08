// EMPH Process Map Guide: guided demos over live Dynamics 365 pages, driven by the flows in the EMPH Process Map.
// Runs in the top frame of Dynamics 365 model-driven apps and of Finance and Supply Chain (operations.dynamics.com). Reads flows and guide content from the Process Map tables
// (emph_processflow, emph_flowactivity) through the org Web API with the user's own session. Nothing is stored outside Dataverse.
(() => {
  if (window.top !== window || window.__emphGuide) return;
  const IS_FO = /\.operations(\.[a-z]+)?\.dynamics\.com$/i.test(location.hostname);
  const IS_CE = location.pathname.toLowerCase() === "/main.aspx";
  if (!IS_FO && !IS_CE) return;
  window.__emphGuide = true;
  const VERSION = "1.0.0";
  document.documentElement.setAttribute("data-emph-guide", VERSION); // lets the Process Map see that the guide is installed
  // Extension storage is shared by Dynamics 365 and Finance and Supply Chain tabs; page storage is the fallback when injected for testing.
  const EXT = !!(window.chrome && chrome.storage && chrome.storage.local && chrome.runtime && chrome.runtime.id);

  const API = "/api/data/v9.2/";
  const HDR = { Accept: "application/json", "Content-Type": "application/json", "OData-Version": "4.0", "OData-MaxVersion": "4.0" };
  const KEY = "emphGuideState";
  const T = { start: 582100000, task: 582100001, decision: 582100002, end: 582100003, sub: 582100004 };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  let st; // guide state, set in main()
  let ORG = IS_CE ? location.origin : null, FO = IS_FO ? location.origin : null;
  // The guide opens only in a tab where someone opened it, and when it moves itself to another page or site. New tabs just show the small Guide button.
  const tabOn = { get: () => { try { return sessionStorage.getItem("emphGuideOn") === "1"; } catch { return false; } }, set: v => { try { v ? sessionStorage.setItem("emphGuideOn", "1") : sessionStorage.removeItem("emphGuideOn"); } catch { /* ignore */ } } };
  const save = () => { tabOn.set(st.open); const v = ({ handoff: st.handoff || 0, flowId: st.flow?.id || null, code: st.code, mode: st.mode, pos: st.pos, mins: st.mins, tuck: !!st.tuck, min: st.min, open: st.open, drawer: st.map, focus: st.focus, done: st.done, run: st.run, voice: st.voice, voiceName: st.voiceName, speed: st.speed, auto: !!st.autoReload, runNo: st.runNo || null });
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
    if (EXT) chrome.storage.local.set({ [KEY]: v }).catch(() => {}); };
  // Dataverse calls: same origin on Dynamics 365 pages; from Finance and Supply Chain through the extension's background worker.
  const api = async (u, opt = {}) => {
    if (IS_CE) { const r = await fetch(API + u, { headers: HDR, credentials: "same-origin", ...opt }); if (!r.ok) throw new Error((await r.text()).slice(0, 200)); return r.status === 204 ? null : r.json(); }
    if (!EXT) throw new Error("Not available on this page");
    if (!ORG) throw new Error("Open the Process Map or a Dynamics 365 app once, so the guide knows your Dataverse");
    const res = await chrome.runtime.sendMessage({ type: "emph-api", org: ORG, path: u, method: opt.method || "GET", body: opt.body || null });
    if (!res || !res.ok) throw new Error((res && res.error) || "Dataverse call failed");
    return res.data;
  };
  const cacheFlow = (id, f, rows) => { if (EXT) chrome.storage.local.get("emphFlowCache").then(o => { const c = o.emphFlowCache || {}; c[id] = { f, rows, at: Date.now() }; const keys = Object.keys(c).sort((a, b) => c[b].at - c[a].at).slice(0, 30); chrome.storage.local.set({ emphFlowCache: Object.fromEntries(keys.map(k => [k, c[k]])) }); }).catch(() => {}); };
  const cachedFlow = async id => { if (!EXT) return null; const o = await chrome.storage.local.get("emphFlowCache"); return (o.emphFlowCache || {})[id] || null; };
  // Timing log for demo tuning: step entered, control found, spoken, paused, done, page loads. Kept in this site's local storage only.
  const LOGK = "emphGuideLog";
  const where = () => { const q = new URLSearchParams(location.search); return IS_FO ? "fo:" + (q.get("mi") || "") : [q.get("pagetype"), q.get("etn"), q.get("id") ? "rec" : q.get("pagetype") === "entityrecord" ? "new" : ""].filter(Boolean).join(":"); };
  function tlog(e, d) { try { const a = JSON.parse(localStorage.getItem(LOGK) || "[]"); a.push({ t: Date.now(), e, f: st && st.flow ? st.flow.name.slice(0, 9) : "", c: st ? st.code : "", w: where(), ...(d || {}) }); if (a.length > 3000) a.splice(0, a.length - 3000); localStorage.setItem(LOGK, JSON.stringify(a)); } catch { /* ignore */ } }
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const boot = async () => {
    let saved = load(), launch = null;
    const qp = new URLSearchParams(location.search).get("emphguide");
    if (EXT) {
      const o = await chrome.storage.local.get([KEY, "emphLaunch", "emphOrg", "emphFo"]);
      if (o[KEY]) saved = o[KEY];
      if (IS_CE) chrome.storage.local.set({ emphOrg: location.origin }); else ORG = o.emphOrg || null;
      if (IS_FO) chrome.storage.local.set({ emphFo: location.origin }); else FO = o.emphFo || null;
      // Dataverse knows its Finance and Supply Chain site, so nobody has to open Finance once before the guide can go there.
      if (IS_CE && !FO) try { const u = (await api("RetrieveFinanceAndOperationsIntegrationDetails")).Url; if (u) { FO = new URL(u).origin; chrome.storage.local.set({ emphFo: FO }); } } catch { /* no linked Finance: the guide says so at that step */ }
      if (o.emphLaunch && Date.now() - o.emphLaunch.at < 120000) { launch = o.emphLaunch; chrome.storage.local.remove("emphLaunch"); }
    }
    if (!EXT && IS_CE) try { const l = JSON.parse(localStorage.getItem("emphLaunch") || "null"); if (l && Date.now() - l.at < 120000) { localStorage.removeItem("emphLaunch"); launch = l; } } catch { /* ignore */ }
    if (qp && /^[0-9a-f-]{36}$/i.test(qp)) launch = { flowId: qp };
    main(saved, launch);
  };
  // The Process Map's "Start guide" button raises this event; the new tab picks the request up from extension storage.
  if (IS_CE) window.addEventListener("emph-guide-start", e => {
    // the page's event detail may not cross into the extension's world, so the Process Map also leaves the id on the document
    const d = e.detail && e.detail.flowId ? e.detail : { flowId: document.documentElement.getAttribute("data-emph-guide-start") }; if (!/^[0-9a-f-]{36}$/i.test(d.flowId || "")) return;
    const req = { flowId: d.flowId, code: d.code || null, at: Date.now() };
    if (EXT) chrome.storage.local.set({ emphLaunch: req }); else try { localStorage.setItem("emphLaunch", JSON.stringify(req)); } catch { /* ignore */ }
  });
  boot();

  function main(saved, launch) {
  if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", () => { if (st && st.open && !st.focus && !st.edit) render(); });
  st = { flow: null, steps: [], code: saved.code || null, mode: saved.mode || "demo", pos: saved.pos || {}, mins: saved.mins || {}, tuck: !!saved.tuck, min: !!saved.min, open: !!saved.open && (tabOn.get() || !!saved.auto || !!launch || Date.now() - (saved.handoff || 0) < 120000), resume: saved.flowId ? { id: saved.flowId, code: saved.code } : null,
    runNo: saved.runNo || null, edit: false, picking: false, results: [], err: "", done: Array.isArray(saved.done) ? saved.done : [], map: !!saved.drawer, focus: !!saved.focus, since: Date.now(), sig: null };
  st.run = saved.run || "narrated"; st.voice = saved.voice !== false; st.voiceName = saved.voiceName || ""; st.speed = saved.speed || 1;
  const RUNS = { narrated: "Narrated", check: "Autopilot: checkpoints", full: "Autopilot: full" };
  const NEXT_AFTER = 6000; // ms before the Next button shows on a guided step

  // ---------- host + shadow DOM ----------
  const host = document.createElement("div");
  host.id = "emph-guide-host";
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483000";
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    *{box-sizing:border-box;font-family:"Segoe UI",system-ui,sans-serif}
    .fab{position:fixed;right:16px;bottom:16px;pointer-events:auto;border:none;border-radius:12px;padding:10px 16px;background:#0F6CBD;color:#fff;font-weight:600;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}
    .panel{position:fixed;right:16px;bottom:16px;width:330px;max-height:calc(100vh - 76px);display:flex;flex-direction:column;pointer-events:auto;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.24);border:none;overflow:hidden;font-size:13.5px;color:#242424}
    .glass{background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.24);border:none}
    .strip{position:fixed;right:16px;bottom:16px;pointer-events:auto;border-radius:12px;padding:8px;max-width:72vw}
    .strip .dg{background:transparent}
    .stages{position:fixed;top:5px;left:calc(50% - 60px);transform:translateX(-50%);pointer-events:auto;display:flex;align-items:center;max-width:62vw;font-family:inherit}
    .stages .ti{color:#fff;font-size:11px;font-weight:600;white-space:nowrap;padding:0 14px 0 6px;text-shadow:0 1px 2px rgba(0,0,0,.6)}
    .stg{border:none;cursor:pointer;color:#fff;height:38px;flex:1 1 auto;min-width:0;padding:0 16px 0 15px;margin-left:-5px;clip-path:polygon(0 0,calc(100% - 9px) 0,100% 50%,calc(100% - 9px) 100%,0 100%,9px 50%);font-size:11px;line-height:1.15;text-align:left;font-family:inherit;background:#2b4250;white-space:nowrap}
    .stg small{display:block;font-size:9.5px;font-weight:400}
    .stg b{font-weight:600}
    .stg.tech{background:#2f96cf}
    .stg.on{background:#9dc73a;color:#1c2b12}
    .stg:hover{filter:brightness(1.12)}
    .stg i{font-style:normal;font-size:9px;font-weight:700;margin-left:4px}
    .fi{position:fixed;pointer-events:auto;width:30px;height:30px;border-radius:8px;border:2px solid #fff;background:#0F6CBD;color:#fff;font:700 15px "Segoe UI",sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer;display:flex;align-items:center;justify-content:center}
    .fc{position:fixed;pointer-events:auto;width:260px;background:#fff;color:#242424;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.24);padding:10px 12px;font-size:12.5px;display:none;flex-direction:column;gap:6px}
    .fw:hover .fc,.fc:hover{display:flex}
    .cap{position:fixed;left:16px;bottom:16px;max-width:44vw;pointer-events:auto;background:#242424;color:#fff;padding:10px 16px;border-radius:12px;font-size:15px;line-height:1.35;box-shadow:0 6px 20px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center}
    .cap .k{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9cc7f0;white-space:nowrap}
    .cap button{border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12.5px;background:#fff;color:#242424}
    .cap button.p{background:#0F6CBD;color:#fff}
    select{border:1px solid #d1d1d1;border-radius:8px;padding:5px 8px;font-size:12.5px;background:#fff;width:100%}
    .hd{display:flex;align-items:center;gap:2px;padding:8px 8px 4px 14px;color:#616161;cursor:move;user-select:none;touch-action:none;font-size:12px}
    .hd b{flex:1;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hd button{background:transparent;border:none;color:#424242;cursor:pointer;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0}
    .hd button:hover,.hd button.on{background:#f0f0f0}
    .hd svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .menu{display:flex;flex-direction:column;gap:6px;padding:8px 14px 10px;border-top:1px solid #eee;border-bottom:1px solid #eee;background:#fafafa}
    .menu .mi{border:none;background:transparent;text-align:left;padding:6px 8px;border-radius:8px;cursor:pointer;font-size:13px;color:#242424;width:100%}
    .menu .mi:hover{background:#eee}
    .menu label{display:block;font-size:11px;color:#616161;margin-bottom:2px}
    .body{overflow:auto;padding:4px 14px 12px;display:flex;flex-direction:column;gap:10px}
    .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .acts{display:flex;gap:8px;align-items:center;margin-top:2px}
    .acts .grow{flex:1}
    input,textarea{width:100%;border:1px solid #d1d1d1;border-radius:8px;padding:6px 8px;font-size:12.5px}
    textarea{resize:vertical;min-height:54px}
    .btn{border:1px solid #d1d1d1;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:#242424}
    .btn:hover{background:#f5f5f5}
    .btn.p{background:#0F6CBD;border-color:#0F6CBD;color:#fff;font-weight:600}
    .btn.p:hover{background:#0c5da3}
    .btn:disabled{opacity:.5;cursor:default}
    .seg{display:flex;border:1px solid #d1d1d1;border-radius:8px;overflow:hidden}
    .seg button{flex:1;border:none;background:#fff;color:#242424;padding:5px 8px;cursor:pointer;font-size:12.5px}
    .seg button.on{background:#EBF3FC;color:#0F6CBD;font-weight:600}
    .list{display:flex;flex-direction:column;gap:2px;max-height:220px;overflow:auto}
    .list button{text-align:left;border:none;background:#f5f5f5;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:12.5px}
    .list button:hover{background:#EBF3FC}
    .card{border:none;padding:0;display:flex;flex-direction:column;gap:8px}
    .card .name{font-size:15px;font-weight:600;line-height:1.25}
    .lbl{font-size:11px;color:#616161;font-weight:600}
    .say{color:#616161;font-size:12.5px;padding:0 0 0 16px;margin:0}
    .say li{margin:2px 0}
    .do{line-height:1.4}
    .muted{color:#616161;font-size:11.5px}
    .warn{color:#8a5a00;font-size:12px}
    .err{color:#C50F1F;font-size:12px}
    .dg{overflow-x:auto;border-radius:8px;background:#fafafa;scrollbar-width:thin;--fl:0px;--fr:0px;-webkit-mask-image:linear-gradient(to right,transparent 0,#000 var(--fl),#000 calc(100% - var(--fr)),transparent 100%);mask-image:linear-gradient(to right,transparent 0,#000 var(--fl),#000 calc(100% - var(--fr)),transparent 100%)}
    svg{height:auto;display:block}
    .hl.heal{border-color:#C19C00;border-style:dashed}
    .hl{position:fixed;pointer-events:none;border:3px solid #0F6CBD;border-radius:8px;box-shadow:0 0 0 4000px rgba(0,0,0,.18);transition:all .15s}
    .tip{position:fixed;pointer-events:none;max-width:280px;background:#0F6CBD;color:#fff;padding:6px 10px;border-radius:8px;font-size:12.5px;box-shadow:0 4px 12px rgba(0,0,0,.25)}
    .pick{position:fixed;left:50%;top:12px;transform:translateX(-50%);pointer-events:none;background:#C19C00;color:#fff;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600}
    .fab{touch-action:none}
    .sh{display:flex;align-items:center;gap:6px;padding:0 2px 4px;font-size:11px;color:#616161;font-weight:600}
    .sh span.t{flex:1}
    .sh button{border:none;background:transparent;cursor:pointer;color:#616161;border-radius:8px;padding:0 6px}
    .sh button:hover{background:#f0f0f0}
    .chip{position:fixed;right:16px;bottom:16px;pointer-events:auto;display:flex;align-items:center;gap:4px;border-radius:12px;padding:6px 8px;font-size:12.5px;color:#242424}
    .chip button{border:none;background:transparent;cursor:pointer;border-radius:8px;padding:4px 8px;font-size:12.5px;color:#242424}
    .chip button:hover{background:#f0f0f0}
    .chip .open{font-weight:600;color:#0F6CBD}
    .grip{cursor:grab;touch-action:none;user-select:none;color:#8a8a8a;font-size:13px;line-height:1;padding:2px 3px;border-radius:8px;flex:none}
    .intro{position:fixed;left:50%;top:14vh;transform:translateX(-50%);width:min(600px,92vw);max-height:74vh;overflow:auto;pointer-events:auto;border-radius:12px;padding:16px 20px;color:#242424;font-size:14px;line-height:1.4;background:#fff;box-shadow:0 14px 44px rgba(0,0,0,.32)}
    .intro h3{margin:2px 0 8px;font-size:18px;font-weight:600}
    .intro .what{margin-bottom:10px}
    .intro ul{margin:0 0 8px;padding-left:20px}
    .intro ol{margin:2px 0 8px;padding-left:22px;font-size:13px}
    .intro li{margin:2px 0}
    .intro .tag{color:#616161;font-size:11.5px}
    .intro a{color:#0F6CBD;font-size:12.5px}
    .intro .acts{display:flex;gap:8px;align-items:center;margin-top:10px}
  </style><div id="ui"></div><div id="ov"></div>`;
  const ui = root.getElementById("ui");
  const ov = root.getElementById("ov");

  // ---------- data ----------
  // All flows once, then filtered here: pick a process, or search across everything.
  const PROCESSES = { "00": "EMPH Process Map", 10: "Acquire to dispose", 20: "Case to resolution", 30: "Concept to market", 40: "Design to retire", 50: "Forecast to plan", 55: "Hire to retire", 60: "Inventory to deliver", 65: "Order to cash", 70: "Plan to produce", 75: "Source to pay", 80: "Project to profit", 85: "Prospect to quote", 90: "Record to report", 93: "Rent to return", 95: "Service to deliver (Field Service)", 96: "Field Service demo: repair and maintenance", 99: "Administer to operate" };
  // A staged process: the flows of one group (96.10.x) are the stages of a slide, drawn as chevrons in the top bar while one of them runs.
  // Everything comes from the data: label = flow name after ": ", role = the Start step's function, "F&O" mark = the Start step's description.
  const STAGED = /^(96\.\d\d)\./;
  async function loadStages(catalog) {
    const m = STAGED.exec(catalog || ""); if (!m) { st.stages = null; return; }
    if (st.stages && st.stages.group === m[1]) return;
    const fl = (await api(`emph_processflows?$select=emph_processflowid,emph_name,emph_catalogcode&$filter=startswith(emph_catalogcode,'${m[1]}.')&$orderby=emph_catalogcode`)).value;
    if (!fl.length) { st.stages = null; return; }
    const starts = (await api(`emph_flowactivities?$select=_emph_processflow_value,emph_lane,emph_summary&$filter=emph_activitycode eq 'P100' and (${fl.map(f => `_emph_processflow_value eq ${f.emph_processflowid}`).join(" or ")})`)).value;
    const of = id => starts.find(s => s._emph_processflow_value === id) || {}, nm = f => String(f.emph_name || "");
    st.stages = { group: m[1], title: nm(fl[0]).replace(/^[\d.]+\s*/, "").split(":")[0], list: fl.map(f => ({ id: f.emph_processflowid, label: nm(f).split(": ").pop(), role: of(f.emph_processflowid).emph_lane || "", mark: of(f.emph_processflowid).emph_summary || "" })) };
  }
  function stagesHtml() {
    const g = st.stages; if (!g || !st.flow) return "";
    const at = g.list.findIndex(x => x.id === st.flow.id); if (at < 0) return "";
    return `<div class="stages" data-part="stages" aria-label="Process stages"><span class="ti">${esc(g.title)}</span>${g.list.map((x, i) => `<button class="stg${/technician/i.test(x.role) ? " tech" : ""}${i === at ? " on" : ""}" data-stage="${x.id}" title="${esc(x.label)}"><small>${esc(x.role)}</small><b>${i < at ? "✓ " : ""}${esc(x.label)}</b>${x.mark ? `<i>${esc(x.mark)}</i>` : ""}</button>`).join("")}</div>`;
  }
  const procOf = r => String(r.emph_catalogcode || r.emph_name || "").slice(0, 2);
  async function searchFlows() {
    if (st.allFlows) return;
    const r = await api("emph_processflows?$select=emph_processflowid,emph_name,emph_catalogcode,emph_flowtype&$orderby=emph_catalogcode&$top=2000");
    st.allFlows = r.value;
  }
  function flowMatches() {
    const q = (st.q || "").trim().toLowerCase(), all = st.allFlows || [];
    if (q) return all.filter(r => (r.emph_name || "").toLowerCase().includes(q)).slice(0, 60);
    return st.proc ? all.filter(r => procOf(r) === st.proc && r.emph_flowtype !== 582100001) : [];
  }
  const flowListHtml = () => { const m = flowMatches(); return m.map(r => `<button data-flow="${r.emph_processflowid}">${esc(r.emph_name)}${r.emph_flowtype === 582100001 ? " (ours)" : ""}</button>`).join("") || `<span class="muted">${st.q || st.proc ? "No flows found" : "Pick a process above, or type to search"}</span>`; };
  function pickerHtml() {
    const present = [...new Set((st.allFlows || []).map(procOf))].filter(k => PROCESSES[k]).sort();
    return `${st.flow ? `<button class="btn" id="pick-back">← Back to ${esc(st.flow.name)}</button>` : st.resume ? `<button class="btn" id="pick-resume">Continue the last flow</button>` : ""}
      <select id="proc" title="Process" style="width:100%"><option value="">Choose a process…</option>${present.map(k => `<option value="${k}" ${st.proc === k ? "selected" : ""}>${esc(k + " " + PROCESSES[k])}</option>`).join("")}</select>
      <input id="q" placeholder="Or search all flows, e.g. opportunity" value="${esc(st.q || "")}"/><div class="list" id="flist">${flowListHtml()}</div>`;
  }
  async function openFlow(id, code, keep) {
    const cols = "emph_flowactivityid,emph_activitycode,emph_name,emph_shape,emph_lane,emph_links,emph_summary,emph_rank,emph_delta,emph_screentarget,emph_screenpath,emph_instruction,emph_narration,emph_completion,emph_nextaction,emph_samplevalue";
    const q = c => api(`emph_flowactivities?$select=${c}&$filter=_emph_processflow_value eq ${id}&$orderby=emph_rank`);
    // the fingerprint column is optional: older Process Map versions run without self-healing
    let s, f;
    try {
      f = await api(`emph_processflows(${id})?$select=emph_processflowid,emph_name,emph_catalogcode,emph_flowtype,emph_sourcelink`);
      try { s = await q(cols + ",emph_screensignature"); st.hasFp = true; } catch { s = await q(cols); st.hasFp = false; }
      cacheFlow(id, f, s);
    } catch (e) {
      const c = await cachedFlow(id); if (!c) throw e;
      f = c.f; s = c.rows; st.hasFp = true; st.err = "Using the copy of this flow saved earlier (Dataverse not reachable from here).";
    }
    st.flow = { id: f.emph_processflowid, name: f.emph_name, kind: f.emph_flowtype, source: f.emph_sourcelink || "" };
    loadStages(f.emph_catalogcode).then(render).catch(() => { st.stages = null; }); // only decoration: a failure must not stop the flow
    st.steps = s.value.filter(x => x.emph_delta !== 582100003).map(x => ({ id: x.emph_flowactivityid, code: x.emph_activitycode, name: x.emph_name, type: x.emph_shape, func: x.emph_lane || "", next: parseNext(x.emph_links), desc: x.emph_summary || "",
      selector: x.emph_screentarget || "", page: x.emph_screenpath || "", instruction: x.emph_instruction || "", talk: x.emph_narration || "", doneWhen: x.emph_completion || "", cont: x.emph_nextaction || "", demo: x.emph_samplevalue || "", fp: parseFp(x.emph_screensignature) }));
    const first = st.steps.find(x => x.type === T.start) || st.steps[0];
    st.code = code && st.steps.some(x => x.code === code) ? code : first?.code || null;
    if (!keep) st.done = []; reset(); save(); render();
  }
  const parseFp = v => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
  const points = t => String(t || "").split(/\r?\n/).map(x => x.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  const parseNext = v => { try { const j = JSON.parse(v || "[]"); return Array.isArray(j) ? j : []; } catch { return []; } };
  const cur = () => st.steps.find(x => x.code === st.code) || null;
  async function saveStep(s, patch) {
    Object.assign(s, patch);
    await api(`emph_flowactivities(${s.id})`, { method: "PATCH", body: JSON.stringify({ emph_screentarget: s.selector || null, emph_screenpath: s.page || null, emph_instruction: s.instruction || null, emph_narration: s.talk || null, emph_completion: s.doneWhen || null, emph_nextaction: s.cont || null, emph_samplevalue: s.demo || null, ...(st.hasFp ? { emph_screensignature: s.fp ? JSON.stringify(s.fp) : null } : {}) }) });
  }

  // ---------- navigation through the flow ----------
  const active = () => document.visibilityState === "visible";
  function reset() { st.since = Date.now(); st.touched = false; st.scrolled = null; st.foundFor = st.bridgeFor = null; tlog("enter"); setTimeout(onStep, 0); }
  // "Continue with" stitches flows together: "85.45.200:P400", or per decision answer "Yes=85.45.300:P400; No=85.45.200:P1000".
  function contFor(s, label) {
    if (!s?.cont) return null;
    const parts = s.cont.split(";").map(x => x.trim()).filter(Boolean);
    for (const p of parts) { const m = p.match(/^(.+?)=(.+)$/); if (m && label && m[1].trim().toLowerCase() === label.toLowerCase()) return m[2].trim(); }
    const plain = parts.find(p => !p.includes("=")); return plain && (s.next.length <= 1 || !label) ? plain : null;
  }
  async function cross(ref) {
    const [flowName, code] = ref.split(":").map(x => x.trim());
    const r = await api(`emph_processflows?$select=emph_processflowid&$filter=startswith(emph_name,'${flowName.replace(/'/g, "''")}')&$orderby=emph_flowtype&$top=1`);
    if (!r.value.length) { st.err = "Flow not found: " + flowName; render(); return; }
    await openFlow(r.value[0].emph_processflowid, code, true);
  }
  function go(code, label) {
    const s = cur(); tlog("done", { to: code, how: st.how || "next", label: label || "" }); st.lastHow = st.how; st.how = null; if (st.flow && st.code) st.done.push(st.flow.id + "|" + st.code);
    const c = contFor(s, label);
    if (c) { cross(c).catch(e => { st.err = e.message; render(); }); return; }
    st.code = code; reset(); save(); render();
  }
  function back() {
    const p = st.done.pop(); if (!p) return; const [fid, code] = p.includes("|") ? p.split("|") : [st.flow.id, p];
    if (fid !== st.flow.id) { openFlow(fid, code, true).catch(e => { st.err = e.message; render(); }); return; }
    st.code = code; reset(); save(); render();
  }

  // ---------- diagram: lanes = roles, columns = longest path from the start ----------
  function diagram() {
    const S = st.steps; if (!S.length) return "";
    const by = Object.fromEntries(S.map(s => [s.code, s]));
    const start = S.find(s => s.type === T.start) || S[0];
    const col = {}, onPath = new Set(), back = new Set();
    const dfs = (c, d) => { if (onPath.has(c)) return; onPath.add(c); col[c] = Math.max(col[c] ?? 0, d);
      (by[c]?.next || []).forEach(l => { if (!by[l.to]) return; if (onPath.has(l.to)) back.add(c + ">" + l.to); else dfs(l.to, d + 1); }); onPath.delete(c); };
    dfs(start.code, 0); S.forEach(s => { if (col[s.code] == null) col[s.code] = 0; });
    const lanes = [...new Set(S.map(s => s.func || "-"))];
    const W = 92, H = 34, CW = 104, RH = 50, LW = 64, P = 6;
    const ncol = Math.max(...Object.values(col)) + 1;
    // Steps never share a cell: the branches of a choice in the same lane and column go on rows below each other, and the lane grows.
    const taken = new Set(), row = {}, rows = lanes.map(() => 1), laneOf = c => lanes.indexOf(by[c].func || "-");
    S.slice().sort((a, b) => col[a.code] - col[b.code]).forEach(s => { const li = laneOf(s.code); let r = 0; while (taken.has(li + ":" + col[s.code] + ":" + r)) r++; taken.add(li + ":" + col[s.code] + ":" + r); row[s.code] = r; rows[li] = Math.max(rows[li], r + 1); });
    const laneTop = []; rows.reduce((y, n, i) => { laneTop[i] = y; return y + n * RH; }, P);
    const X = c => LW + P + col[c] * CW, Y = c => laneTop[laneOf(c)] + row[c] * RH + (RH - H) / 2;
    const width = LW + P * 2 + ncol * CW, height = rows.reduce((a, n) => a + n * RH, 0) + P * 2;
    let out = `<div class="dg" id="dg"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-w="${width}" data-h="${height}" role="img" aria-label="Flow diagram">`;
    lanes.forEach((l, i) => { const h = rows[i] * RH; out += `<rect x="0" y="${laneTop[i]}" width="${width}" height="${h}" fill="${i % 2 ? "#f3f3f3" : "#fafafa"}"/><text x="4" y="${laneTop[i] + h / 2 + 3}" font-size="8.5" fill="#616161">${esc(l.slice(0, 14))}</text>`; });
    S.forEach(s => s.next.forEach(l => { const t = by[l.to]; if (!t) return; const x1 = X(s.code) + W, y1 = Y(s.code) + H / 2, x2 = X(t.code), y2 = Y(t.code) + H / 2;
      const isBack = back.has(s.code + ">" + t.code);
      const d = isBack ? `M${X(s.code) + W / 2} ${Y(s.code) + H} C${X(s.code) + W / 2} ${height} ${X(t.code) + W / 2} ${height} ${X(t.code) + W / 2} ${Y(t.code) + H}` : `M${x1} ${y1} C${x1 + 12} ${y1} ${x2 - 12} ${y2} ${x2} ${y2}`;
      out += `<path d="${d}" fill="none" stroke="#8a8a8a" stroke-width="1" ${isBack ? 'stroke-dasharray="3 3"' : ""}/>`;
      if (l.label) out += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 3}" font-size="8" fill="#616161" text-anchor="middle">${esc(l.label)}</text>`; }));
    S.forEach(s => { const on = s.code === st.code, done = st.done.includes(st.flow.id + "|" + s.code); const x = X(s.code), y = Y(s.code);
      const fill = on ? "#0F6CBD" : done ? "#DFF6DD" : "#fff", stroke = on ? "#0F6CBD" : s.selector ? "#107C10" : "#bdbdbd", color = on ? "#fff" : "#242424";
      const shape = s.type === T.decision ? `<polygon points="${x + W / 2},${y} ${x + W},${y + H / 2} ${x + W / 2},${y + H} ${x},${y + H / 2}" fill="${fill}" stroke="${stroke}"/>`
        : `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="${s.type === T.start || s.type === T.end ? H / 2 : 5}" fill="${fill}" stroke="${stroke}" stroke-width="${on ? 2 : 1}"/>`;
      const words = s.name.split(" "); const l1 = [], l2 = []; words.forEach(w => ((l1.join(" ") + " " + w).length < 17 && !l2.length ? l1 : l2).push(w));
      out += `<g data-code="${esc(s.code)}" style="cursor:pointer">${shape}<text x="${x + W / 2}" y="${y + (l2.length ? 14 : 20)}" font-size="9" fill="${color}" text-anchor="middle">${esc(l1.join(" "))}</text>${l2.length ? `<text x="${x + W / 2}" y="${y + 25}" font-size="9" fill="${color}" text-anchor="middle">${esc(l2.join(" ").slice(0, 18))}</text>` : ""}</g>`; });
    return out + "</svg></div>";
  }

  // Open a page: inside the same model-driven app through Xrm.Navigation (no reload, the guide and the voice keep going),
  // otherwise by a normal page load.
  let navSeq = 0;
  function softNav(url) {
    st.handoff = Date.now(); save(); // a full page load on the way stays in the flow
    return new Promise(res => {
      const u = new URL(url, location.origin), here = new URLSearchParams(location.search);
      const same = IS_CE && u.origin === location.origin && (u.searchParams.get("appid") || "") === (here.get("appid") || "");
      const pt = u.searchParams.get("pagetype");
      if (!same || !/^(entityrecord|entitylist)$/.test(pt || "")) { tlog("reload", { why: same ? "page type" : "other app" }); location.href = url; return res("reload"); }
      const req = { pageType: pt, entityName: u.searchParams.get("etn") };
      if (pt === "entityrecord" && u.searchParams.get("id")) req.entityId = u.searchParams.get("id");
      if (pt === "entitylist" && u.searchParams.get("viewid")) { req.viewId = u.searchParams.get("viewid"); req.viewType = "savedquery"; }
      const id = ++navSeq, t0 = Date.now();
      // navigateTo's promise can settle late (it follows the form, not the navigation): the address bar decides
      const arrived = () => { const h = new URLSearchParams(location.search); return h.get("pagetype") === pt && (h.get("etn") || "").toLowerCase() === (req.entityName || "").toLowerCase() && (!req.entityId || (h.get("id") || "").toLowerCase().includes(req.entityId.toLowerCase())); };
      let done = false;
      const fin = (ok, why) => { if (done) return; done = true; window.removeEventListener("message", on); clearTimeout(t); clearInterval(poll); tlog("softNav", { ok, ms: Date.now() - t0, why }); if (!ok) location.href = url; res(ok ? "soft" : "reload"); };
      const on = e => { if (e.source === window && e.data && e.data.type === "emph-nav-done" && e.data.id === id && !e.data.ok) fin(false, e.data.error); };
      window.addEventListener("message", on);
      const poll = setInterval(() => { if (arrived()) fin(true); }, 150);
      const t = setTimeout(() => fin(arrived(), "timeout"), 8000);
      // injected for testing the guide runs in the page itself and can call Xrm directly
      if (window.Xrm && window.Xrm.Navigation) { try { window.Xrm.Navigation.navigateTo(req).then(() => {}, err => fin(false, String((err && err.message) || err))); } catch (err) { fin(false, String(err)); } }
      else window.postMessage({ type: "emph-nav", id, req }, location.origin);
    });
  }

  // ---------- page check: the step's page parameters must match the current URL ----------
  const isFoPage = p => /^\/?\?(.*&)?mi=/i.test(p || "");
  // Page "...&from=list" with demo line "open:<text>": the record is opened from its list (the row with that text).
  const fromList = s => /[?&]from=list\b/.test(s?.page || "");
  const demoArg = (s, k) => { const m = String(s?.demo || "").match(new RegExp("^" + k + ":(.*)$", "im")); return m ? m[1].trim() : null; };
  const onListOf = s => { const etn = (new URL(s.page, location.origin).searchParams.get("etn") || "").toLowerCase(), h = new URLSearchParams(location.search); return IS_CE && h.get("pagetype") === "entitylist" && (h.get("etn") || "").toLowerCase() === etn; };
  // Grid rows in the page and in same-origin iframes whose text (and field values) contain every ";"-separated term.
  function rowsWith(text) {
    const terms = tokens(text).toLowerCase().split(";").map(x => x.trim()).filter(Boolean);
    const docs = [document, ...[...document.querySelectorAll("iframe")].map(frameDoc).filter(Boolean)], out = [];
    for (const d of docs) for (const r of d.querySelectorAll('[role=row],.wj-row')) {
      // some grids give the row itself no height, only its cells
      if ((!r.getBoundingClientRect().height && !r.querySelector("[role=gridcell]")?.getBoundingClientRect().height) || r.querySelector("[role=columnheader]") || r.closest('[class*="colheaders"],[class*="ag-header"],[class*="headerWrapper"]')) continue;
      const t = (r.innerText + " " + [...r.querySelectorAll("input")].map(i => i.value).join(" ")).toLowerCase();
      if (terms.every(x => t.includes(x))) out.push(r);
    }
    return out;
  }
  // ag-grid splits one row over several containers with the same row-index
  const rowParts = r => { const ri = r.getAttribute("row-index"), g = r.closest("[role=treegrid],[role=grid]"); return ri != null && g ? [...g.querySelectorAll(`[row-index="${ri}"]`)] : [r]; };
  const isSelected = r => rowParts(r).some(x => x.getAttribute("aria-selected") === "true" || /selected/i.test(x.className) || !!x.querySelector('input[type=checkbox]:checked,[role=checkbox][aria-checked=true]'));
  // last: several rows can match, and the newest is the last one in lists sorted by number (invoice proposals)
  async function selectRow(text, last) {
    const r = await waitFor(() => { const a = rowsWith(text); return last ? a[a.length - 1] : a[0]; }, 12000); if (!r) return false;
    return selectEl(r);
  }
  // selectall: every row that matches, such as all of one project's lines in a billing backlog
  async function selectAll(text) {
    const first = await waitFor(() => rowsWith(text)[0], 12000); if (!first) return false;
    const rows = rowsWith(text); for (const r of rows) await selectEl(r);
    tlog("selectAll", { rows: rows.length }); return true;
  }
  async function selectEl(r) {
    if (isSelected(r)) return true;
    const parts = rowParts(r), pick = sel => parts.map(x => x.querySelector(sel)).find(Boolean);
    const c = IS_FO ? r.querySelector("input") : pick('input[aria-label^="select or deselect" i],[role=checkbox],input[type=checkbox],button[aria-label*="Select all values in a row"],button[aria-label*="select" i],[class*="rowbtn"],[class*="row-select"]') || pick("[role=gridcell]") || r;
    c.click(); await new Promise(z => setTimeout(z, 700));
    if (!isSelected(r)) { // some grids only react to the whole pointer sequence
      const b = (c.getBoundingClientRect().height ? c : c.closest("[role=gridcell]") || c).getBoundingClientRect(), o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 };
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(t => c.dispatchEvent(t.startsWith("pointer") ? new PointerEvent(t, { ...o, pointerId: 1 }) : new MouseEvent(t, o)));
      await new Promise(z => setTimeout(z, 1200));
    }
    tlog("select", { ok: isSelected(r) });
    return true;
  }
  // Opens a grid row by double click: sub-grids such as contract lines have no link to follow.
  async function openRow(text) {
    const r = await waitFor(() => rowsWith(text)[0], 12000); if (!r) return false;
    const cell = rowParts(r).flatMap(x => [...x.querySelectorAll("[role=gridcell]")]).find(c => c.innerText.trim() && !c.querySelector("input,[role=checkbox]")) || r, b = cell.getBoundingClientRect(), o = { bubbles: true, cancelable: true, view: window, button: 0, clientX: b.left + 8, clientY: b.top + b.height / 2 };
    ["mousedown", "mouseup", "click", "mousedown", "mouseup", "click", "dblclick"].forEach(t => cell.dispatchEvent(new MouseEvent(t, { ...o, detail: t === "dblclick" ? 2 : 1 })));
    return true;
  }
  // the link of the record itself: a row also links to its customer, owner and so on
  const rowLink = s => {
    const text = demoArg(s, "open") || "", r = rowsWith(text)[0]; if (!r) return null;
    const links = rowParts(r).flatMap(x => [...x.querySelectorAll("a[role=link],a[href]")]), terms = tokens(text).toLowerCase().split(";").map(x => x.trim()).filter(Boolean);
    return links.find(a => terms.some(t => ((a.innerText || "") + " " + (a.getAttribute("aria-label") || "") + " " + (a.title || "")).toLowerCase().includes(t))) || links[0] || null;
  };
  // absolute address of a step's page, in Dynamics 365 or in Finance and Supply Chain
  function pageUrl(s) {
    let p = (s.page || "").replace(/&new=1/, "");
    if (fromList(s)) p = p.replace(/pagetype=entityrecord/, "pagetype=entitylist").replace(/&from=list/, "");
    if (isFoPage(p)) { if (!FO) return null; const u = new URL(p.replace(/^\/?/, "/"), FO); if (IS_FO && !u.searchParams.get("cmp")) { const c = new URLSearchParams(location.search).get("cmp"); if (c) u.searchParams.set("cmp", c); } return u.href; }
    const base = IS_CE ? location.origin : ORG; return base ? new URL(p, base).href : null;
  }
  const TABLE_NAMES = { salesorder: "project contract", salesorderdetail: "contract line", quotedetail: "quote line", msdyn_actual: "billing backlog", msdyn_project: "project", msdyn_timeentry: "time entry", msdyn_projectapproval: "approval", msdyn_expense: "expense", invoice: "invoice", opportunity: "opportunity", lead: "lead", quote: "quote" };
  function pageState(s) {
    if (!s?.page) return { ok: true };
    if (isFoPage(s.page)) {
      const mi = new URLSearchParams(s.page.replace(/^\/?\?/, "")).get("mi") || "";
      const ok = IS_FO && (new URLSearchParams(location.search).get("mi") || "").toLowerCase() === mi.toLowerCase();
      return { ok, canGo: !!FO, what: `the ${mi.replace(/ListPage$/, "").replace(/^Proj(?=[A-Z])/, "Project").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()} page in Finance` };
    }
    if (IS_FO) return { ok: false, canGo: !!ORG, what: "a Dynamics 365 page" };
    const want = new URL(s.page, location.origin).searchParams, have = new URL(location.href).searchParams;
    const keys = ["appid", "pagetype", "etn", "viewid"].filter(k => want.get(k) && !(k === "viewid" && want.get("from") === "list")); // a record opened from a list has no view in its address
    const ok = keys.every(k => (have.get(k) || "").toLowerCase() === want.get(k).toLowerCase()) && !(want.get("new") && have.get("id"));
    const canGo = !want.get("via") && (want.get("pagetype") !== "entityrecord" || !!want.get("id") || !!want.get("new") || want.get("from") === "list");
    return { ok, canGo, what: (n => (want.get("pagetype") === "entityrecord" ? `${/^[aeiou]/i.test(n) ? "an" : "a"} ${n} record` : `the ${n} list`))(TABLE_NAMES[(want.get("etn") || "").toLowerCase()] || (want.get("etn") || "").replace(/^msdyn_/, "")) };
  }

  // ---------- render ----------
  function stepLabel(s) {
    if (!st.flow || st.pickFlow) return "Process Map Guide";
    const n0 = st.steps.filter(z => z.type !== T.start && z.type !== T.end), i0 = n0.findIndex(z => z.code === st.code);
    return s?.type === T.end ? "Finished" : i0 >= 0 ? `Step ${i0 + 1} of ${n0.length}` : "Start";
  }
  const ICONS = {
    voice: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>',
    flow: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  };
  // The ⋯ menu: everything a presenter rarely needs during a demo. The ids are the ones wire() connects.
  function menuHtml(inFlow) {
    let h = `<div class="menu" id="menu">`;
    if (inFlow) {
      h += `<button class="mi" id="change">Choose another flow</button>`;
      h += `<div><label>Mode</label><span class="seg"><button data-mode="demo" class="${st.mode === "demo" ? "on" : ""}">Demo</button><button data-mode="train" class="${st.mode === "train" ? "on" : ""}">Training</button></span></div>`;
      h += `<div><label>How it runs</label><select id="run">${Object.entries(RUNS).map(([k, v]) => `<option value="${k}" ${st.run === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>`;
      if (st.run !== "narrated") h += `<div><label>Speed</label><select id="speed">${[0.75, 1, 1.5].map(v => `<option value="${v}" ${st.speed == v ? "selected" : ""}>${v}x</option>`).join("")}</select></div>`;
      if (st.voice) h += `<div><label>Voice</label><select id="vname">${voices().filter(v => v.lang.startsWith("en")).map(v => `<option value="${esc(v.name)}" ${bestVoice() && bestVoice().name === v.name ? "selected" : ""}>${esc(v.name.replace(/^Microsoft |Online \(Natural\) - |\s*\(.*?\)/g, "").slice(0, 28))}</option>`).join("")}</select></div>`;
      h += `<button class="mi" id="edit">${st.edit ? "Done editing" : "Edit this step"}</button><button class="mi" id="focus">Hide this card</button>`;
    }
    h += `<button class="mi" id="tuck">Minimize</button><button class="mi" id="home">Reset position</button>`;
    if (inFlow) h += `<button class="mi" id="exit">Exit this flow</button>`;
    return h + `<button class="mi" id="x">Close the guide</button></div>`;
  }
  function render() {
    if (dragging) { dirty = true; return; } // a redraw would drop the part being dragged
    if (!st.open) { ui.innerHTML = `<button class="fab" id="fab" data-part="fab" data-drag="fab">Guide</button>`; ui.querySelector("#fab").onclick = () => { if (justMoved) return; st.open = true; st.tuck = false; save(); render(); if (!st.flow) searchFlows("").then(render).catch(e => { st.err = e.message; render(); }); }; ov.innerHTML = ""; drawCap(); layout(); return; }
    const s = cur(), pg = pageState(s), inFlow = !!st.flow && !st.pickFlow;
    // minimized as a whole: one chip; the highlight and the narration keep going
    if (st.tuck && !st.picking) { ui.innerHTML = `${inFlow ? stagesHtml() : ""}<div class="chip glass" data-part="fab" data-drag="fab"><button class="open" id="untuck" title="Show the guide">Guide · ${esc(stepLabel(s))}</button><button id="x" title="Close">✕</button></div>`; wire(); layout(); highlight(); drawCap(); return; }
    if (st.focus && inFlow && !st.edit) { ui.innerHTML = chrome() + `<div class="chip glass" data-part="fab" data-drag="fab"><button class="open" id="unfocus" title="Show the step card">Guide · ${esc(stepLabel(s))}</button></div>`; wire(); layout(); fitStrip(); layout(); highlight(); drawCap(); return; }
    let h = `<div class="panel" data-part="dock"><div class="hd" id="drag" data-drag="dock" title="Drag to move"><b>${esc(stepLabel(s))}${inFlow && s && s.func ? ` · ${esc(s.func)}` : ""}</b>`;
    if (inFlow) h += `<button id="voice" title="${st.voice ? "Voice on" : "Voice off"} (click to change)">${st.voice ? ICONS.voice : ICONS.mute}</button><button id="map" class="${st.map ? "on" : ""}" title="${st.map ? "Hide the flow" : "Show the flow"}">${ICONS.flow}</button>`;
    h += `<button id="more" class="${st.menu ? "on" : ""}" title="More">${ICONS.more}</button></div>`;
    if (st.menu) h += menuHtml(inFlow);
    h += `<div class="body">`;
    if (st.err) h += `<div class="err">${esc(st.err)}</div>`;
    if (!inFlow) {
      h += pickerHtml();
    } else if (s) {
      h += `<div class="card"><div class="name">${esc(s.name)}</div>`;
      if (s.desc && s.type !== T.start && !s.instruction) h += `<div class="muted">${esc(s.desc)}</div>`;
      if (!pg.ok && !ap.on) h += `<div class="warn">This step happens on ${esc(pg.what)}. ${pg.canGo ? `<button class="btn" id="goto">Take me there</button>` : "Follow the pointer to open one."}</div>`;
      if (st.healedEl && !ap.on) h += `<div class="warn">The saved control was not found; the guide found it again by its label. <button class="btn" id="fix">Save fix</button></div>`;
      const said = s.instruction || (!s.selector && s.type !== T.start && s.type !== T.end ? explainFallback(s) : "");
      if (said) h += `<div class="do">${esc(said)}</div>`;
      if (s.talk) h += `<ul class="say">${points(s.talk).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
      // Back, then one main button: Stop while autopilot runs; otherwise Play, and Next once the step is done
      h += `<div class="acts">${st.done.length && !ap.on ? `<button class="btn" id="back">Back</button>` : ""}`;
      const canNext = s.type !== T.end && (s.next.length > 1 || nextReady(s));
      if (ap.on) h += `<button class="btn p grow" id="play">■ Stop</button>`;
      else if (s.type === T.end && s.cont) h += `<button class="btn p grow" id="cont">Continue: ${esc(s.cont.split(":")[0])}</button>`;
      else if (s.type === T.end) h += `<button class="btn p grow" id="restart">Start again</button>`;
      else {
        if (st.run !== "narrated") h += `<button class="btn p grow" id="play">▶ Play</button>`;
        if (canNext) s.next.forEach(l => { h += `<button class="btn${st.run === "narrated" ? " p grow" : ""}" data-next="${esc(l.to)}">${esc(l.label || "Next")}</button>`; });
      }
      h += `</div></div>`;
      if (st.edit) h += `<div class="card"><div class="lbl">What to do</div><input id="e-ins" value="${esc(s.instruction)}"/>
            <div class="lbl">Key points (one per line, keep them short)</div><textarea id="e-talk">${esc(s.talk)}</textarea>
            <div class="lbl">Page</div><div class="row"><input id="e-page" value="${esc(s.page)}" style="flex:1"/><button class="btn" id="e-here">Use this page</button></div>
            <div class="lbl">Done when (optional CSS selector; prefix filled: for a field)</div><input id="e-done" value="${esc(s.doneWhen)}"/>
            <div class="lbl">Continue with (optional: 85.45.200:P400, or Yes=…; No=… on a decision)</div><input id="e-cont" value="${esc(s.cont)}"/>
            <div class="lbl">Demo value for autopilot (text to type; several fields as field=value per line, field!=value overwrites a default; {today} and {n} = date and run number; confirm = OK the dialog; skip = narrate only; manual = presenter does it; on a decision: the answer)</div><textarea id="e-demo">${esc(s.demo)}</textarea>
            <div class="lbl">Control to point at (alternatives: A || B, first found wins)</div><div class="row"><input id="e-sel" value="${esc(s.selector)}" style="flex:1"/><button class="btn" id="e-pick">Pick on page</button></div>
            <div class="row"><button class="btn p" id="e-save">Save to Process Map</button><span class="muted" id="e-msg"></span></div></div>`;
    }
    h += `</div></div>`;
    h += chrome();
    if (st.picking) h += `<div class="pick">Click the control this step should point at (Esc to cancel)</div>`;
    ui.innerHTML = h;
    wire(); layout(); fitStrip(); layout(); highlight(); drawCap();
  }
  // What floats apart from the window: the chevrons in the top bar, and the flow as a drawer attached to the window.
  function chrome() {
    if (!st.flow || st.pickFlow) return "";
    let h = stagesHtml();
    if (st.map) h += `<div class="strip glass" data-part="strip">${diagram()}</div>`;
    return h;
  }

  // ---------- where the parts go ----------
  // One window, docked bottom right. If it would sit on the control the step points at, it moves to bottom left, then top right.
  let stripMax = 0, targetRect = null;
  // would this rectangle sit on the control the step points at?
  function coversTarget(a) { return !!targetRect && !(a.x >= targetRect.right + 8 || targetRect.left - 8 >= a.x + a.w || a.y >= targetRect.bottom + 8 || targetRect.top - 8 >= a.y + a.h); }
  function usualFree(sw, sh) { return { x: window.innerWidth - sw - 16, y: window.innerHeight - sh - 16, w: sw, h: sh }; }
  function drawerUsual(box, sw, sh) {
    const right = box.x + box.w > window.innerWidth / 2;
    return { x: right ? Math.max(8, box.x + box.w - sw) : box.x, y: box.y - sh - 8 >= 50 ? box.y - sh - 8 : Math.min(window.innerHeight - sh - 8, box.y + box.h + 8), w: sw, h: sh };
  }
  // The first place for the drawer that leaves both the window and the control free: next to the window, then the screen's corners.
  function drawerSpot(box, strip) {
    const sw = strip.offsetWidth, sh = strip.offsetHeight, W = window.innerWidth, H = window.innerHeight, PAD = 16;
    const off = a => !box || a.x >= box.x + box.w + 8 || box.x >= a.x + a.w + 8 || a.y >= box.y + box.h + 8 || box.y >= a.y + a.h + 8;
    const near = box ? [drawerUsual(box, sw, sh), { x: Math.max(8, box.x + box.w - sw), y: box.y + box.h + 8 }, { x: box.x, y: box.y - sh - 8 }] : [];
    const corners = [H - sh - PAD, 56].flatMap(y => [W - sw - PAD, PAD].map(x => ({ x, y })));
    return [...near, ...corners].map(a => ({ x: a.x, y: a.y, w: sw, h: sh })).find(a => a.x >= 0 && a.y >= 50 && a.x + sw <= W && a.y + sh <= H && off(a) && !coversTarget(a)) || null;
  }
  function clampPos(el, x, y) { const w = el.offsetWidth || 100; return { x: Math.max(60 - w, Math.min(window.innerWidth - 60, x)), y: Math.max(0, Math.min(window.innerHeight - 28, y)) }; }
  function layout() {
    const parts = [...root.querySelectorAll("[data-part]")], get = n => parts.find(p => p.dataset.part === n);
    const put = (el, x, y) => Object.assign(el.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto", transform: "none" });
    const free = el => Object.assign(el.style, { left: "", top: "", right: "", bottom: "", transform: "" });
    const dock = get("dock"), strip = get("strip"), fab = get("fab"), cap = get("cap") || root.getElementById("cap");
    const PAD = 16, W = window.innerWidth, H = window.innerHeight;
    let box = null;
    if (dock) {
      const w = dock.offsetWidth, h = dock.offsetHeight;
      const br = { x: W - w - PAD, y: H - h - PAD }, bl = { x: PAD, y: H - h - PAD }, tr = { x: W - w - PAD, y: Math.min(56, Math.max(8, H - h - PAD)) };
      // a side pane opens on the right, in Dynamics and in Finance: leave it free
      const paneOpen = [...document.querySelectorAll('button[id^="closeSidePanelButton"]')].some(b => b.getBoundingClientRect().width) || (IS_FO && [...document.querySelectorAll(".dialog-content,.sysDialog,[data-dyn-role=Dialog]")].some(d => { const r = d.getBoundingClientRect(); return r.width && r.left > W / 2; }));
      const spots = paneOpen ? [bl, br, tr] : [br, bl, tr];
      const clear = p => !coversTarget({ x: p.x, y: p.y, w, h });
      // the window keeps its place if the drawer can go somewhere free; otherwise it moves as well
      let spot = (strip && spots.find(p => clear(p) && drawerSpot({ x: p.x, y: p.y, w, h }, strip))) || spots.find(clear) || spots[0];
      if (st.pos.dock) spot = clampPos(dock, st.pos.dock.x, st.pos.dock.y);
      put(dock, spot.x, spot.y); box = { x: spot.x, y: spot.y, w, h };
    }
    if (strip) {
      const sw = strip.offsetWidth, sh = strip.offsetHeight, usual = box ? drawerUsual(box, sw, sh) : null, at = drawerSpot(box, strip);
      if (at && (box || coversTarget(usualFree(sw, sh)))) put(strip, at.x, at.y);
      else if (usual) put(strip, usual.x, usual.y);
      else free(strip);
      // nowhere free: the drawer steps aside until the step's control is out of the way, the control matters more
      const hide = !at && coversTarget(usual || usualFree(sw, sh));
      strip.style.visibility = hide ? "hidden" : ""; strip.style.pointerEvents = hide ? "none" : "";
    }
    const paneNow = [...document.querySelectorAll('button[id^="closeSidePanelButton"]')].some(b => b.getBoundingClientRect().width);
    if (fab && st.pos.fab) { const c = clampPos(fab, st.pos.fab.x, st.pos.fab.y); put(fab, c.x, c.y); } else if (fab && paneNow) put(fab, PAD, H - fab.offsetHeight - PAD); else if (fab) free(fab);
    if (cap) { if (box && box.x < W / 2 && box.y + box.h > H - 90) Object.assign(cap.style, { left: box.x + box.w + 12 + "px" }); else cap.style.left = "";
      // the caption sits above the drawer when the drawer had to take its corner
      cap.style.bottom = "";
      if (strip && strip.style.visibility !== "hidden") { const c = cap.getBoundingClientRect(), d = strip.getBoundingClientRect(); if (c.left < d.right && d.left < c.right && c.top < d.bottom && d.top < c.bottom) cap.style.bottom = H - d.top + 8 + "px"; }
    }
    const intro = get("intro"); if (intro) free(intro);
  }
  function goHome() { st.pos = {}; st.mins = {}; st.tuck = false; st.min = false; save(); render(); }
  // Dragging by the grip. Pointer capture keeps the drag going over Dynamics' iframes, which would otherwise swallow the mouse.
  let dragging = null, dirty = false, justMoved = false;
  root.addEventListener("pointerdown", e => {
    const g = e.target.closest && e.target.closest("[data-drag]"); if (!g || e.button !== 0) return;
    if (g.dataset.drag !== "fab" && e.target.closest("button,select,input,textarea")) return;
    const part = g.dataset.drag, el = g.closest("[data-part]"), r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
    let moved = false; dragging = part;
    try { g.setPointerCapture(e.pointerId); } catch { /* the document listeners below still work outside iframes */ }
    const mv = ev => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return; moved = true; ev.preventDefault(); st.pos[part] = clampPos(el, ev.clientX - ox, ev.clientY - oy); layout(); };
    const up = () => { g.removeEventListener("pointermove", mv); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up); dragging = null;
      if (moved) { justMoved = true; setTimeout(() => { justMoved = false; }, 80); save(); }
      if (dirty || (moved && !st.pickFlow && part === "panel")) { dirty = false; render(); } };
    g.addEventListener("pointermove", mv); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
  });
  setInterval(() => { if (!dragging && !document.hidden) layout(); }, 500); // the form header arrives after the page, and moves with it
  window.addEventListener("resize", () => { if (!dragging) { layout(); fitStrip(); layout(); } });
  // The strip is as wide as the flow; a flow wider than 72% of the window scrolls with faded ends.
  function fitStrip() {
    const dg = ui.querySelector("#dg"); if (!dg) return;
    const docked = stripMax > 0, svg = dg.querySelector("svg"), w0 = +svg.getAttribute("data-w"), h0 = +svg.getAttribute("data-h"), max = docked ? stripMax - 16 : window.innerWidth * 0.72 - 16;
    const k = docked ? Math.max(0.75, Math.min(1, max / w0)) : Math.max(0.9, Math.min(1.35, max / w0));
    svg.setAttribute("width", Math.round(w0 * k)); svg.setAttribute("height", Math.round(h0 * k));
    dg.style.width = Math.min(Math.round(w0 * k), Math.round(max)) + "px";
    const g = dg.querySelector(`[data-code="${CSS.escape(st.code || "")}"]`);
    if (g) { const b = g.getBBox(); dg.scrollLeft = Math.max(0, b.x * k - dg.clientWidth / 2 + b.width * k / 2); dg.scrollTop = Math.max(0, b.y * k - dg.clientHeight / 2 + b.height * k / 2); }
    const fade = () => { const more = dg.scrollWidth - dg.clientWidth; dg.style.setProperty("--fl", dg.scrollLeft > 2 ? "40px" : "0px"); dg.style.setProperty("--fr", dg.scrollLeft < more - 2 ? "40px" : "0px"); }; dg.onscroll = fade; fade();
  }

  function wire() {
    const $ = s => ui.querySelector(s);
    if ($("#more")) $("#more").onclick = () => { st.menu = !st.menu; render(); };
    if ($("#menu")) $("#menu").addEventListener("click", e => { if (e.target.closest("button")) st.menu = false; }, true);
    if ($("#x")) $("#x").onclick = () => { st.open = false; save(); render(); };
    if ($("#unfocus")) $("#unfocus").onclick = () => { st.focus = false; save(); render(); };
    if ($("#focus")) $("#focus").onclick = () => { st.focus = true; save(); render(); };
    if ($("#run")) $("#run").onchange = e => { st.run = e.target.value; stopAuto(); save(); render(); };
    if ($("#vname")) $("#vname").onchange = e => { st.voiceName = e.target.value; save(); say("This is the selected voice.", { now: true }); };
    if ($("#voice")) $("#voice").onclick = () => { st.voice = !st.voice; if (!st.voice) hush(); save(); render(); };
    if ($("#play")) $("#play").onclick = () => { ap.on ? stopAuto() : startAuto(); };
    if ($("#speed")) $("#speed").onchange = e => { st.speed = +e.target.value; save(); };
    if ($("#fix")) $("#fix").onclick = async () => { const s = cur(), el = st.healedEl; if (!el) return; s.selector = selectorFor(el); s.fp = fingerprint(actOf(el)); try { await saveStep(s, {}); st.err = ""; } catch (e) { st.err = "Fix not saved: " + e.message; } render(); };
    if ($("#map")) $("#map").onclick = () => { st.map = !st.map; save(); render(); };
                if ($("#tuck")) $("#tuck").onclick = () => { st.tuck = true; save(); render(); };
    if ($("#untuck")) $("#untuck").onclick = () => { if (justMoved) return; st.tuck = false; save(); render(); };
    ui.querySelectorAll("#home").forEach(b => b.onclick = goHome);
        ui.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { st.mode = b.dataset.mode; save(); render(); });
    const wireFlows = () => ui.querySelectorAll("[data-flow]").forEach(b => b.onclick = () => { stopAuto(); st.pickFlow = false; st.err = ""; introSeen.delete(b.dataset.flow); openFlow(b.dataset.flow).catch(e => { st.err = e.message; render(); }); });
    const q = $("#q"); if (q) { q.oninput = () => { st.q = q.value; $("#flist").innerHTML = flowListHtml(); wireFlows(); }; }
    if ($("#proc")) $("#proc").onchange = e => { st.proc = e.target.value; st.q = ""; if (q) q.value = ""; $("#flist").innerHTML = flowListHtml(); wireFlows(); };
    wireFlows();
    if ($("#pick-back")) $("#pick-back").onclick = () => { st.pickFlow = false; render(); };
    if ($("#pick-resume")) $("#pick-resume").onclick = () => { const r = st.resume; st.resume = null; openFlow(r.id, r.code, true).catch(e => { st.err = e.message; render(); }); };
    const showPicker = () => { stopAuto(); closeIntro(); st.pickFlow = true; st.edit = false; const c = cur(); if (c) st.proc = st.proc || procOf({ emph_name: st.flow.name }); searchFlows().then(render).catch(e => { st.err = e.message; render(); }); render(); };
    ui.querySelectorAll("#change,#change2").forEach(b => b.onclick = showPicker);
    // Exit: out of the flow, no highlight left on the page; the guide stays open on the list of flows.
    ui.querySelectorAll("#exit").forEach(b => b.onclick = () => { stopAuto(); closeIntro(); st.resume = st.flow ? { id: st.flow.id, code: st.code } : null; st.proc = st.flow ? procOf({ emph_name: st.flow.name }) : ""; st.flow = null; st.steps = []; st.code = null; st.pickFlow = false; st.focus = false; st.edit = false; st.map = false; ov.innerHTML = ""; targetRect = null; save(); searchFlows().then(render).catch(e => { st.err = e.message; render(); }); render(); });
    ui.querySelectorAll("[data-next]").forEach(b => b.onclick = () => go(b.dataset.next, b.textContent));
    ui.querySelectorAll("svg [data-code]").forEach(g => g.addEventListener("click", () => { st.code = g.getAttribute("data-code"); reset(); save(); render(); }));
    ui.querySelectorAll("[data-stage]").forEach(b => b.onclick = () => { if (st.flow && b.dataset.stage === st.flow.id) return; stopAuto(); st.err = ""; introSeen.delete(b.dataset.stage); openFlow(b.dataset.stage, null, true).catch(e => { st.err = e.message; render(); }); });
    if ($("#back")) $("#back").onclick = back;
    if ($("#restart")) $("#restart").onclick = () => openFlow(st.flow.id);
    if ($("#cont")) $("#cont").onclick = () => go(null);
    if ($("#goto")) $("#goto").onclick = () => { const u = pageUrl(cur()); if (u) softNav(u); };
    if ($("#edit")) $("#edit").onclick = () => { st.edit = !st.edit; render(); };
    if ($("#e-here")) $("#e-here").onclick = () => { const u = new URL(location.href);
      if (IS_FO) { $("#e-page").value = "/?mi=" + (u.searchParams.get("mi") || ""); return; } const k = new URLSearchParams(); ["appid", "pagetype", "etn"].forEach(n => u.searchParams.get(n) && k.set(n, u.searchParams.get(n))); $("#e-page").value = "/main.aspx?" + k.toString(); };
    if ($("#e-pick")) $("#e-pick").onclick = () => { stash(); st.picking = true; render(); };
    if ($("#e-save")) $("#e-save").onclick = async () => { const s = cur(); try { stash(); await saveStep(s, {}); $("#e-msg").textContent = "Saved"; render(); } catch (e) { $("#e-msg").textContent = "Not saved: " + e.message; } };
  }
  function stash() { const s = cur(); if (!s) return; const v = id => ui.querySelector(id)?.value ?? ""; if (ui.querySelector("#e-ins")) { s.instruction = v("#e-ins"); s.talk = v("#e-talk"); s.page = v("#e-page"); s.selector = v("#e-sel"); s.doneWhen = v("#e-done"); s.cont = v("#e-cont"); s.demo = v("#e-demo"); } }

  // ---------- highlight the control of the current step ----------
  // "frame >>> control": a control inside a same-origin iframe (e.g. the time entry grid, a web resource).
  const frameDoc = f => { try { return f && f.contentDocument; } catch { return null; } };
  const q1 = sel => { try {
    if (!sel) return null;
    if (!sel.includes(">>>")) return document.querySelector(sel);
    const [fs, inner] = sel.split(">>>").map(x => x.trim()); const d = frameDoc(document.querySelector(fs));
    return d && inner ? d.querySelector(inner) : null;
  } catch { return null; } };
  // An element's box in the top page, also for elements inside an iframe.
  function rectOf(el) {
    const r = el.getBoundingClientRect(), fe = el.ownerDocument !== document && el.ownerDocument.defaultView && el.ownerDocument.defaultView.frameElement;
    if (!fe) return r; const o = fe.getBoundingClientRect();
    return { left: r.left + o.left, top: r.top + o.top, right: r.right + o.left, bottom: r.bottom + o.top, width: r.width, height: r.height };
  }
  // Clicks and typing inside same-origin iframes reach the same handlers as the page itself.
  const hooked = new WeakSet();
  function hookFrames() { for (const f of document.querySelectorAll("iframe")) { const d = frameDoc(f); if (!d || hooked.has(d) || !d.documentElement) continue; hooked.add(d);
    for (const [ev, fn] of FRAME_EVENTS) d.addEventListener(ev, fn, true); } }
  const FRAME_EVENTS = [];
  // "A || B": the first alternative found wins; only the first one counts as doing the step.
  const alts = sel => String(sel || "").split("||").map(x => x.trim()).filter(Boolean);
  function target() { const s = cur(); if (!s) return null; for (const a of alts(s.selector)) { const e = q1(a); if (e && e.getBoundingClientRect().width) return e; } return null; }
  function primary() { const s = cur(); if (!s) return null; const e = q1(alts(s.selector)[0]); if (e) return e; const h = heal(s); return h && h.el; }

  // ---------- self-healing: a fingerprint of the control finds it again when its selector stops working ----------
  const ACT = 'button,a,[role=button],[role=menuitem],[role=tab],[role=treeitem],[role=link]';
  const norm = t => String(t || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60);
  function actOf(el) { return el.closest(ACT) || el.closest("[data-dyn-controlname]") || el; }
  function fieldLabelOf(el) { const box = el.closest('[data-id$="-FieldSectionItemContainer"]') || el.closest("[data-id]") || el.closest("[data-dyn-controlname]"); const l = box && box.querySelector("label"); return norm(l && l.textContent); }
  function fingerprint(el) {
    if (!el) return null;
    return { tag: el.tagName, role: el.getAttribute("role") || "", label: norm(el.getAttribute("aria-label") || el.getAttribute("title")), text: norm(el.textContent).slice(0, 40),
      lp: el.getAttribute("data-lp-id") || "", id: el.getAttribute("data-id") || "", field: fieldLabelOf(el), dyn: el.getAttribute("data-dyn-controlname") || "" };
  }
  function score(fp, el) {
    let n = 0; const f = fingerprint(el);
    if (fp.id && f.id && (f.id === fp.id || f.id.split("|").pop() === fp.id.split("|").pop())) n += 4;
    if (fp.lp && f.lp === fp.lp) n += 3;
    if (fp.dyn && f.dyn === fp.dyn) n += 4;
    if (fp.label && f.label === fp.label) n += 3;
    if (fp.text && f.text === fp.text) n += 2;
    if (fp.field && f.field === fp.field) n += 3;
    if (fp.role && f.role === fp.role) n += 1;
    if (fp.tag === f.tag) n += 1;
    return n;
  }
  const healCache = { key: "", at: 0, res: null };
  function heal(s) {
    if (!s?.fp || !s.selector || !pageState(s).ok) return null;
    const key = (st.flow?.id || "") + s.code;
    if (healCache.key === key && Date.now() - healCache.at < 1500) return healCache.res;
    let best = null, top = 0;
    const cands = s.fp.field ? document.querySelectorAll(IS_FO ? "[data-dyn-controlname]" : '[data-id$="-FieldSectionItemContainer"]') : document.querySelectorAll(ACT + (IS_FO ? ",[data-dyn-controlname]" : ""));
    for (const c of cands) { if (!c.getBoundingClientRect().width || host.contains(c)) continue; const n = score(s.fp, c); if (n > top) { top = n; best = c; } }
    const res = best && top >= 4 ? { el: best, score: top } : null;
    Object.assign(healCache, { key, at: Date.now(), res }); return res;
  }
  function findEl(s) { const e = target(); if (e) return { el: e, healed: false }; const h = heal(s); return h ? { el: h.el, healed: true } : null; }
  const nextReady = s => !s.selector || !findEl(s) || Date.now() - st.since > NEXT_AFTER;
  // Buttons, links, menu and side-menu items are done on click; anything else (fields, grids) is done when its content changes.
  const isAction = el => !!el && (/^(BUTTON|A)$/.test(el.tagName) || /^(button|link|menuitem|treeitem|tab|option)$/.test(el.getAttribute("role") || ""));

  // When the step's control lives on another page, point at the way there.
  function bridge(s) {
    if (!s?.page || pageState(s).ok) return null;
    const want = new URL(s.page, location.origin).searchParams, have = new URL(location.href).searchParams;
    const etn = (want.get("etn") || "").toLowerCase();
    if (want.get("new") && have.get("pagetype") === "entitylist" && (have.get("etn") || "").toLowerCase() === etn) {
      const vis = e => e && e.getBoundingClientRect().width ? e : null;
      const el = vis(q1(`[data-id$="HomepageGrid.${etn}.NewRecord"]`)) || vis(q1(`[data-id$="Form.${etn}.NewRecord"]`));
      if (el) return { el, text: `Click New to create ${(n => (/^[aeiou]/i.test(n) ? "an " : "a ") + n)(TABLE_NAMES[etn.toLowerCase()] || etn.replace(/^msdyn_/, ""))}` };
      const more = [...document.querySelectorAll('[data-id="OverflowButton"]')].find(vis);
      if (more) return { el: more, text: "Open More commands, then New" };
    }
    if (fromList(s) && demoArg(s, "open") && onListOf(s)) { const el = rowLink(s); if (el) return { el, text: `Open ${tokens(demoArg(s, "open"))}` }; }
    if (want.get("pagetype") === "entityrecord" && have.get("pagetype") === "entitylist" && (have.get("etn") || "").toLowerCase() === etn) {
      const el = q1('[role=treegrid] [role=row][row-index="0"] a[role=link]') || q1("[role=grid] [role=row] a[role=link]");
      if (el) return { el, text: `Open ${/^[aeiou]/.test(etn) ? "an" : "a"} ${etn} record to continue` };
    }
    const nav = [...document.querySelectorAll('[data-id^="sitemap-entity-"]')].find(n => n.getAttribute("data-id").slice(15).toLowerCase() === etn);
    if (nav) return { el: nav, text: `Go to ${nav.innerText.trim() || etn} first` };
    return null;
  }

  let ovKey = "";
  function highlight() {
    const s = cur();
    if (!st.open || !s || st.picking || !st.flow) { ov.innerHTML = ""; ovKey = ""; return; }
    const found = pageState(s).ok ? findEl(s) : null;
    let el = found && found.el, text = s.instruction || "Click here", br = null;
    const healed = !!(found && found.healed); st.healedEl = healed ? el : null;
    if (healed !== !!st.wasHealed) { st.wasHealed = healed; if (!st.focus && !st.edit) setTimeout(render, 0); }
    if (healed) text = "Found by its label (the page changed): " + text;
    if (el && !healed && !s.fp && s.id && st.hasFp && el === q1(alts(s.selector)[0])) { s.fp = fingerprint(actOf(el)); api(`emph_flowactivities(${s.id})`, { method: "PATCH", body: JSON.stringify({ emph_screensignature: JSON.stringify(s.fp) }) }).catch(() => {}); }
    if (el && st.foundFor !== st.code) { st.foundFor = st.code; tlog("found", { healed }); }
    if (!el) { br = bridge(s); if (br) { el = br.el; text = br.text; if (st.bridgeFor !== st.code + br.text) { st.bridgeFor = st.code + br.text; tlog("bridge", { text: br.text }); } } }
    let r = el && rectOf(el);
    if (r && !r.width && !r.height) { el = null; r = null; }
    const movedTarget = !!r !== !!targetRect || (r && (Math.abs(r.left - targetRect.left) > 4 || Math.abs(r.top - targetRect.top) > 4));
    targetRect = r || null; if (movedTarget && !dragging) layout();
    if (el && st.scrolled !== st.code + !!br) { st.scrolled = st.code + !!br; if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    const ready = nextReady(s), key = [st.code, st.focus, ready, !!el, !!br, text, st.mode, healed].join("|");
    if (key !== ovKey) {
      ovKey = key;
      let h = el ? `<div class="hl${healed ? " heal" : ""}"></div>` : "";
      if (st.focus) {
        const btns = s.type === T.end && s.cont ? `<button class="btn p" id="f-cont">Continue</button>` : s.type === T.end ? `<button class="btn p" id="f-restart">Start again</button>` : (s.next.length > 1 || ready) ? s.next.map(l => `<button class="btn p" data-fnext="${esc(l.to)}">${esc(l.label || "Next")}</button>`).join("") : `<span class="muted">Moves on when done…</span>`;
        h += `<div class="fw"><div class="fi" id="f-open" title="Open the guide panel">i</div><div class="fc"><b>${esc(s.name)}</b><div class="do">${esc(text)}</div>${s.talk ? `<ul class="say">${points(s.talk).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<div class="row">${btns}<button class="btn" id="f-panel" style="margin-left:auto">Panel</button></div></div></div>`;
      } else if (el) h += `<div class="tip">${esc(br || healed ? text : s.name || text)}</div>`;
      ov.innerHTML = h;
      const $ = q => ov.querySelector(q), open = () => { st.focus = false; save(); render(); };
      if ($("#f-open")) $("#f-open").onclick = open;
      if ($("#f-panel")) $("#f-panel").onclick = open;
      if ($("#f-restart")) $("#f-restart").onclick = () => openFlow(st.flow.id);
      if ($("#f-cont")) $("#f-cont").onclick = () => go(null);
      ov.querySelectorAll("[data-fnext]").forEach(b => b.onclick = () => go(b.dataset.fnext, b.textContent));
    }
    const hl = ov.querySelector(".hl"), tip = ov.querySelector(".tip"), fi = ov.querySelector(".fi"), fc = ov.querySelector(".fc");
    if (hl && r) Object.assign(hl.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
    if (tip && r) Object.assign(tip.style, { left: Math.min(Math.max(8, r.left), window.innerWidth - 290) + "px", top: (r.bottom + 50 < window.innerHeight ? r.bottom + 10 : Math.max(8, r.top - 46)) + "px" });
    if (fi) {
      const ix = r ? Math.min(window.innerWidth - 38, r.right - 8) : window.innerWidth - 50, iy = r ? Math.max(4, r.top - 22) : window.innerHeight - 60;
      Object.assign(fi.style, { left: ix + "px", top: iy + "px" });
      Object.assign(fc.style, { left: Math.max(8, Math.min(ix - 230, window.innerWidth - 270)) + "px", top: (iy + 200 < window.innerHeight ? iy + 30 : Math.max(8, iy - 190)) + "px" });
    }
  }

  // ---------- step done? (field changed, done-when rule, or a click on the control) ----------
  function checkDone() {
    const s = cur(); if (!s || s.next.length !== 1 || s.type === T.end || st.edit || st.picking) return;
    if (s.doneWhen) {
      const filled = s.doneWhen.startsWith("filled:"), el = q1(filled ? s.doneWhen.slice(7) : s.doneWhen);
      if (el && (!filled || [...el.querySelectorAll("input,textarea,select")].some(i => i.value && i.value !== "---"))) { st.how = st.how || "doneWhen"; return go(s.next[0].to); }
      return;
    }
    const el = pageState(s).ok ? primary() : null;
    if (!el || isAction(el)) { st.sig = null; return; }
    // a field or grid counts as done only after the user typed or picked something in it and moved on
    if (st.touched && !el.contains(el.ownerDocument.activeElement) && !(ap.on && ap.filling === st.flow.id + st.code)) { st.how = st.how || "field"; go(s.next[0].to); }
  }
  let shownReady = false, lastHref = location.href;
  setInterval(() => {
    if (!st.open || st.picking || !active()) return;
    if (location.href !== lastHref) { lastHref = location.href; tlog("page"); }
    hookFrames(); checkDone(); highlight();
    const s = cur(), ready = !!s && nextReady(s);
    if (ready !== shownReady) { shownReady = ready; if (ready) tlog("nextShown"); if (!st.focus && !st.edit) render(); }
  }, 400);
  window.addEventListener("resize", highlight); window.addEventListener("scroll", highlight, true);

  const onDocClick = e => {
    if (st.picking) {
      if (host.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      const s = cur(); s.selector = selectorFor(e.target); s.fp = fingerprint(actOf(e.target)); st.picking = false; st.edit = true; render();
      return;
    }
    if (!st.open || !st.flow || host.contains(e.target) || !e.isTrusted && !ap.on) return;
    const s = cur(), el = primary();
    if (ap.on) return; // autopilot moves on by itself once its own click has finished
    if (s && el && el.contains(e.target) && isAction(el) && s.next.length === 1) { const here = st.code; tlog("click", { auto: !e.isTrusted }); const sel0 = alts(s.selector)[0] || "", saving = SAVES.test(sel0), slow = SLOW.test(sel0), before = location.href;
      (async () => { await new Promise(r => setTimeout(r, 1200)); if (saving || slow) await waitSaving(() => errorShown() || location.href !== before || !el.isConnected || (slow && infoDialog())); if (st.code !== here) return; const err = errorShown(); if (err) { tlog("error", { text: err }); caption("Problem", err); return; } st.how = e.isTrusted ? "click" : "autoclick"; go(s.next[0].to); })(); }
  };
  document.addEventListener("click", onDocClick, true); FRAME_EVENTS.push(["click", onDocClick]);
  const touch = e => { const el = primary(); if (el && el.contains(e.target)) st.touched = true; };
  document.addEventListener("input", touch, true); document.addEventListener("change", touch, true); FRAME_EVENTS.push(["input", touch], ["change", touch]);
  // Interacting with the page shrinks the guide to one icon at the control.
  document.addEventListener("pointerdown", e => {
    if (!st.open || !st.flow || st.picking || st.edit || st.pickFlow || st.focus || ap.on || host.contains(e.target)) return;
    st.focus = true; save(); render();
  }, true);
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (st.picking) { st.picking = false; render(); } else if (st.focus) { st.focus = false; save(); render(); } }, true);

  // A stable CSS selector for a clicked element: prefer data-id, then aria-label, then id.
  function selectorFor(el) {
    const fe = el.ownerDocument !== document && el.ownerDocument.defaultView && el.ownerDocument.defaultView.frameElement;
    if (fe) { const fa = fe.getAttribute("aria-label") ? "aria-label" : "title", fl = fe.getAttribute(fa), fid = fe.id && !/\d{6,}/.test(fe.id) ? fe.id : "";
      const fsel = fl ? `iframe[${fa}="${fl.replace(/"/g, '\\"')}"]` : fid ? `iframe#${CSS.escape(fid)}` : "iframe";
      return fsel + " >>> " + selectorIn(el); }
    return selectorIn(el);
  }
  function selectorIn(el) {
    const dyn = el.closest && el.closest("[data-dyn-controlname]");
    if (dyn) { const form = dyn.closest("[data-dyn-form-name]"); const c = dyn.getAttribute("data-dyn-controlname").replace(/"/g, '\\"');
      return form ? `[data-dyn-form-name="${form.getAttribute("data-dyn-form-name")}"] [data-dyn-controlname="${c}"]` : `[data-dyn-controlname="${c}"]`; }
    const bad = v => !v || /\d{9,}|_[0-9]+_[0-9]{6,}/.test(v);
    for (let n = el, i = 0; n && n !== document.body && i < 8; n = n.parentElement, i++) {
      const d = n.getAttribute && n.getAttribute("data-id");
      if (d && !bad(d)) return `[data-id="${d.replace(/"/g, '\\"')}"]`;
    }
    for (let n = el, i = 0; n && n !== document.body && i < 5; n = n.parentElement, i++) {
      const a = n.getAttribute && n.getAttribute("aria-label");
      if (a) return `${n.tagName.toLowerCase()}[aria-label="${a.replace(/"/g, '\\"')}"]`;
      if (n.id && !bad(n.id)) return `#${CSS.escape(n.id)}`;
    }
    return el.tagName.toLowerCase();
  }

  // ---------- narration and autopilot ----------
  // Voice: the browser's built-in Web Speech API (no service, no cost). Captions always show; voice can be switched off.
  const ap = { on: false, paused: false, resume: null, token: 0, cap: null };
  let lastSpoken = "";
  const sleep = ms => new Promise(r => setTimeout(r, ms / (st.speed || 1)));
  function caption(kind, text, buttons) {
    ap.cap = text ? { kind, text, buttons: buttons || [] } : null; drawCap();
  }
  function drawCap() {
    if (dragging === "cap") return; // redrawn when the drag ends
    let c = root.getElementById("cap");
    const asks0 = !!ap.cap && (ap.cap.buttons || []).some(b => b.label !== "Stop");
    if (!ap.cap || !st.open || (st.voice && !asks0)) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement("div"); c.id = "cap"; c.className = "cap"; c.dataset.part = "cap"; root.appendChild(c); }
        c.innerHTML = `<span class="k">${esc(ap.cap.kind)}</span><span>${esc(ap.cap.text)}</span>${ap.cap.buttons.map((b, i) => `<button data-cb="${i}" class="${i === 0 ? "p" : ""}">${esc(b.label)}</button>`).join("")}`;
    c.querySelectorAll("[data-cb]").forEach(b => b.onclick = () => ap.cap.buttons[+b.dataset.cb].fn());
  }
  // Best voice first: Edge's neural "Online (Natural)" voices, then Google's online voices, then any voice for the language.
  const voices = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => v.name && !/undefined/i.test(v.name));
  function bestVoice() {
    const v = voices(), lang = "en";
    return v.find(x => x.name === st.voiceName) || v.find(x => x.lang.startsWith(lang) && /natural/i.test(x.name)) || v.find(x => x.lang.startsWith(lang) && /online|google/i.test(x.name)) || v.find(x => x.lang.startsWith(lang)) || null;
  }
  // Text the voice should read: no bullets, arrows, codes, brackets or symbols; common abbreviations spoken out.
  const ABBR = [[/\be\.g\./gi, "for example"], [/\bi\.e\./gi, "that is"], [/\betc\./gi, "and so on"], [/\bF&O\b/g, "Finance and Operations"], [/\bCE\b/g, "Customer Engagement"], [/\bBPF\b/g, "business process flow"], [/\bBoQ\b/g, "bill of quantities"], [/\bvs\.?\b/gi, "versus"], [/\bno\.\s?(?=\d)/gi, "number "]];
  function speakable(t) {
    let x = String(t || "");
    ABBR.forEach(([re, w]) => { x = x.replace(re, w); });
    x = x.replace(/\bP\d{3,4}\b/g, "").replace(/\b\d{2}\.\d{2}(\.\d{3})?\b/g, "")
      .replace(/[→⇒➔>]+/g, ", then ").replace(/&/g, " and ").replace(/\s\/\s|\//g, " or ")
      .replace(/[•·▪◦*_#|~^`"“”„«»\[\]{}()<>]/g, " ").replace(/[:;]/g, ",").replace(/\s*-\s+/g, ", ")
      .replace(/[^\p{L}\p{N}\s.,!?'%€$]/gu, " ").replace(/\s+([.,!?])/g, "$1").replace(/([.,!?]){2,}/g, "$1").replace(/\s{2,}/g, " ").trim();
    return x;
  }
  // Speech is never cut by the next step: a new sentence waits for the one being spoken. Only the presenter's own click (now) or Stop cuts it.
  // Chrome's speech is shared by all tabs. If it never reports the end (it can hang), the deadline releases the demo.
  let speakEnd = Promise.resolve(), speakGen = 0, speechStuck = false;
  const hush = () => { speakGen++; if (window.speechSynthesis) speechSynthesis.cancel(); };
  function speakNow(text) {
    return new Promise(res => {
      if (speechStuck) { speechStuck = false; speechSynthesis.cancel(); }
      const u = new SpeechSynthesisUtterance(text), t0 = Date.now(); tlog("speak", { chars: text.length, voice: (bestVoice() || {}).name || "" });
      u.voice = bestVoice(); u.lang = (u.voice && u.voice.lang) || "en-US";
      try { if (localStorage.getItem("emphMute")) u.volume = 0; } catch { /* ignore */ } // silent test runs keep the timing
      u.rate = Math.min(1.3, (u.voice && /natural/i.test(u.voice.name) ? 1 : 0.95) * (st.speed || 1));
      let over = false; const deadline = t0 + 6000 + text.length * 200;
      const finish = extra => { if (over) return; over = true; clearInterval(poll); tlog("spoke", { ms: Date.now() - t0, ...extra }); res(); };
      const poll = setInterval(() => { if (Date.now() > deadline) { speechStuck = true; finish({ timeout: true }); } else if (Date.now() - t0 > 3000 && !speechSynthesis.speaking && !speechSynthesis.pending) finish({ quiet: true }); }, 500);
      u.onend = () => finish(); u.onerror = ev => finish({ err: ev.error || "error" });
      speechSynthesis.speak(u);
    });
  }
  function say(text, opt = {}) {
    text = speakable(text);
    if (!st.voice || !text || !window.speechSynthesis || !active()) return Promise.resolve();
    if (opt.now) { if (speechSynthesis.speaking) tlog("speakCut"); hush(); speakEnd = speakNow(text); return speakEnd; }
    const gen = ++speakGen; // when several wait, only the newest is still worth saying
    speakEnd = speakEnd.then(() => (gen === speakGen ? speakNow(text) : undefined));
    return speakEnd;
  }
  const spoken = s => [s.name, s.instruction || (s.type === T.task || s.type === T.decision ? explainFallback(s) : ""), ...points(s.talk)].filter(Boolean).map(x => x.replace(/[.\s]+$/, "")).join(". ") + ".";
  // A step without guide content still says what it is, so nothing is skipped in silence.
  function explainFallback(s) { const who = s.func ? ` The ${s.func} does this.` : ""; return s.type === T.decision ? `A decision: ${s.name}.${who}` : `${s.name}.${who} It is not shown on screen in this demo.`; }
  // Time a beginner needs to read a step, used when the voice is off and as the shortest stay on any step.
  const wordsIn = t => String(t || "").trim().split(/\s+/).filter(Boolean).length;
  const readMs = s => Math.max(3500, wordsIn([s.name, s.instruction, s.talk, s.desc].join(" ")) * 60000 / 150) / (st.speed || 1);
  // ---------- the pause at the start of a flow: what it does, why, who, what you will see, Microsoft's page ----------
  const introSeen = new Set();
  function closeIntro() { const n = root.getElementById("intro"); if (n) n.remove(); ui.style.visibility = ""; if (ap.introTimer) { clearInterval(ap.introTimer); ap.introTimer = null; } }
  function showIntro(s) {
    return new Promise(res => {
      closeIntro();
      const steps = st.steps.filter(x => x.type !== T.start && x.type !== T.end);
      const n = document.createElement("div"); n.id = "intro"; n.className = "intro"; n.dataset.part = "intro";
      const what = s.instruction || s.desc || `This flow has ${steps.length} steps. Each one is explained as we go.`;
      n.innerHTML = `<div class="sh"><span class="grip" data-drag="intro" title="Drag to move">⠿</span><span class="t">New flow</span></div><h3>${esc(st.flow.name)}</h3><div class="what">${esc(what)}</div>
        ${s.talk ? `<ul>${points(s.talk).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <div class="lbl">What you will see (${steps.length} steps)</div><ol${steps.length > 8 ? ' style="columns:2;column-gap:24px"' : ""}>${steps.map(x => `<li>${esc(x.name)}</li>`).join("")}</ol>
        ${st.flow.source ? `<a href="${esc(st.flow.source)}" target="_blank" rel="noreferrer">Microsoft's description of this process</a>` : ""}
        <div class="acts"><button class="btn p" id="intro-go">Continue${ap.on ? " (Space)" : ""}</button><button class="btn" id="intro-other">Other flows</button>${ap.on && st.run === "full" ? `<button class="btn" id="intro-hold">Stay here</button>` : ""}${ap.on ? `<button class="btn" id="intro-stop">Stop</button>` : ""}</div>`;
      root.appendChild(n); ui.style.visibility = "hidden"; ov.innerHTML = ""; ovKey = ""; caption(null); layout(); // the card would only repeat the intro
      const done = (v, auto) => { const was = ap.resume; closeIntro(); ap.paused = false; ap.resume = null; if (!auto) hush(); res(v); return was; };
      n.querySelector("#intro-go").onclick = () => done(true);
      n.querySelector("#intro-other").onclick = () => { done(false); stopAuto(); st.pickFlow = true; searchFlows().then(render).catch(e => { st.err = e.message; render(); }); render(); };
      ap.paused = true; ap.resume = () => done(true);
      const stop = n.querySelector("#intro-stop"); if (stop) stop.onclick = () => { done(false); stopAuto(); };
      const hold = n.querySelector("#intro-hold");
      tlog("intro", { words: wordsIn(what + " " + s.talk) });
      const line = say([st.flow.name.replace(/^[\d.]+\s*/, ""), what, ...points(s.talk)].join(". "));
      // full autopilot goes on by itself once the intro was read out and there was time to read it; the others wait for Continue
      if (ap.on && st.run === "full") {
        const earliest = Date.now() + readMs({ name: st.flow.name, instruction: what, talk: s.talk, desc: "" });
        let held = false; if (hold) hold.onclick = () => { held = true; clearInterval(ap.introTimer); ap.introTimer = null; hold.remove(); n.querySelector("#intro-go").textContent = "Continue (Space)"; };
        line.then(() => { if (held || !root.getElementById("intro")) return; ap.introTimer = setInterval(() => { const left = Math.ceil((earliest + 5000 - Date.now()) / 1000), b = n.querySelector("#intro-go"); if (left <= 0) done(true, true); else if (b) b.textContent = `Continue (${left})`; }, 250); });
      }
    });
  }
  // Narrated mode: read each step once when it starts; the presenter clicks.
  function onStep() {
    const s = cur(); if (!st.open || !s || !st.flow || !active()) return;
    closeIntro();
    if (s.type === T.start && !ap.on && !introSeen.has(st.flow.id)) { introSeen.add(st.flow.id); showIntro(s).then(v => { if (v && cur() === s && s.next[0]) go(s.next[0].to); }); return; }
    if (st.run === "narrated") {
      caption(s.name, s.instruction || s.desc || "", []);
      const key = st.flow.id + s.code; if (key !== lastSpoken) { lastSpoken = key; say(spoken(s), { now: !st.lastHow || st.lastHow === "next" }); }
    }
  }
  const waitFor = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 300)); } return null; };
  const visible = e => e && e.getBoundingClientRect().width ? e : null;
  // Long Dynamics saves (close as won ~17 s, project ~14 s): show a running caption and say it once, so the screen never sits silent.
  const SAVE_MAX = 45000; // a contract line took 40 s in the lab
  // Commands that save and redraw or leave the page, and slow commands that end with a message box instead.
  const SAVES = /Save|closeAs|Activate|Confirm(?!Button)|SendToCustomer/i, SLOW = /Approve|Post|CreateInvoice/i;
  const infoDialog = () => [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].some(x => x.getBoundingClientRect().width && x.querySelector('[data-id="okButton"],[data-id="confirmButton"]'));
  // a plain Save stays on the form: the form's own status says when it is done (the top-most form, a dialog can sit on another form)
  const formSaved = () => { const h = [...document.querySelectorAll('[data-id="header_saveStatus"]')].filter(visible).pop(); return !!h && /saved/i.test(h.innerText) && !/unsaved|saving/i.test(h.innerText); };
  async function waitSaving(fn) {
    const t0 = Date.now(); let said = false;
    const tick = setInterval(() => { const n = Math.round((Date.now() - t0) / 1000); if (n < 2) return;
      caption("Waiting", `Dynamics is saving (${n} s)`);
      if (!said && n >= 3) { said = true; if (!(window.speechSynthesis && speechSynthesis.speaking)) say("Dynamics is saving."); } }, 1000);
    const r = await waitFor(fn, SAVE_MAX); clearInterval(tick); tlog("saved", { ms: Date.now() - t0, ok: !!r }); return r;
  }
  // Type into a Dynamics field container (React inputs need the native setter plus input/change events).
  // Demo value tokens: {today} = today's date, {n} = a short run number so each demo record is new.
  const runNo = () => { const d = new Date(); return String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0"); };
  // {today} follows the date field's own pattern (its placeholder, e.g. M/d/yyyy), not the browser's language
  // A field still loading has no pattern yet: then any date field on the page has it. The browser's language is the last resort, and it can swap day and month.
  const DATE_PAT = /^[dMy]+([./-])[dMy]+\1[dMy]+$/, pagePat = () => [...document.querySelectorAll("input[placeholder]")].map(i => i.getAttribute("placeholder")).find(p => DATE_PAT.test(p || ""));
  const fmtDate = (pat0, d = new Date()) => { const pat = DATE_PAT.test(pat0 || "") ? pat0 : pagePat(); return pat ? pat.replace(/yyyy|yy|MM|M|dd|d/g, t => ({ yyyy: d.getFullYear(), yy: String(d.getFullYear()).slice(2), MM: String(d.getMonth() + 1).padStart(2, "0"), M: d.getMonth() + 1, dd: String(d.getDate()).padStart(2, "0"), d: d.getDate() }[t])) : d.toLocaleDateString(); };
  let lastWo = ""; // {lastwo}: the newest work order this user created, read before the step's fields are typed
  const tokens = (v, pat) => String(v).replace(/\{today\}/g, fmtDate(pat)).replace(/\{n\}/g, st.runNo || (st.runNo = runNo())).replace(/\{lastwo\}/g, lastWo);
  // A field by name: Dynamics' data-id, or in Finance the visible control of that name (a list page behind can hold the same names)
  const fieldBox = n => q1(`[data-id="${n}-FieldSectionItemContainer"]`) || q1(`[data-id="${n}"]`) || (IS_FO ? [...document.querySelectorAll(`[data-dyn-controlname="${n}"]`)].filter(e => e.getBoundingClientRect().width).pop() : null);
  // Finance dropdowns ignore typed text: open the list and click the option
  async function foPick(box, text) {
    const inp = box.querySelector("input"); if (!inp) return false;
    const option = () => [...document.querySelectorAll('[role=option],li')].filter(o => o.getBoundingClientRect().width && o.textContent.trim().toLowerCase() === text.toLowerCase() && !o.closest('[role=tab],[role=tablist]') && !o.querySelector('[role=tab]')).pop(); // the open list comes last; a tab can carry the same word
    inp.focus(); await new Promise(r => setTimeout(r, 300));
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", keyCode: 40, altKey: true, bubbles: true }));
    let o = await waitFor(option, 1500);
    if (!o) { const b = [...box.querySelectorAll('button,[role=button]')].pop(); if (b) b.click(); o = await waitFor(option, 2000); }
    if (!o) return false;
    o.click(); await new Promise(r => setTimeout(r, 1500)); await waitFor(() => !foBusy() && !document.querySelector(".processing") ? "idle" : null, 8000); await new Promise(r => setTimeout(r, 1500)); return true;
  }
  // The newest sales invoice in this company, so a payment can be matched to the invoice just posted
  async function lastInvoice() {
    const co = new URLSearchParams(location.search).get("cmp") || "";
    const r = await fetch(`/data/SalesInvoiceHeaders?cross-company=true&$filter=dataAreaId eq '${co.toLowerCase()}'&$select=InvoiceNumber&$orderby=InvoiceNumber desc&$top=1`, { headers: { Accept: "application/json" } });
    return r.ok ? ((await r.json()).value[0] || {}).InvoiceNumber || "" : "";
  }
  async function lastWorkOrder() {
    const H = { headers: { Accept: "application/json" } }, me = (await (await fetch("/api/data/v9.2/WhoAmI", H)).json()).UserId;
    const r = await fetch(`/api/data/v9.2/msdyn_workorders?$select=msdyn_name&$filter=_createdby_value eq ${me}&$orderby=createdon desc&$top=1`, H);
    return r.ok ? ((await r.json()).value[0] || {}).msdyn_name || "" : "";
  }
  // "newtask:<subject>" on a step whose page is a project: adds a task to the plan. The task grid is in project.microsoft.com, out of the guide's reach, and tasks can only be written through the schedule API.
  async function newProjectTask(projectId, subject) {
    const H = { Accept: "application/json", "Content-Type": "application/json", "OData-Version": "4.0" }, api = "/api/data/v9.2/";
    const get = async u => (await (await fetch(api + u, { headers: H })).json()).value || [];
    const exists = async () => (await get(`msdyn_projecttasks?$select=msdyn_projecttaskid&$filter=_msdyn_project_value eq ${projectId} and msdyn_subject eq '${subject.replace(/'/g, "''")}'`)).length > 0;
    if (await exists()) return true; // already added by an earlier try
    const post = async (a, b) => { const r = await fetch(api + a, { method: "POST", headers: H, body: JSON.stringify(b) }); if (!r.ok) throw new Error((await r.text()).slice(0, 200)); const t = await r.text(); return t ? JSON.parse(t) : {}; };
    const bucket = (await get(`msdyn_projectbuckets?$select=msdyn_projectbucketid&$filter=_msdyn_project_value eq ${projectId}`))[0]; if (!bucket) throw new Error("the project has no bucket");
    const OperationSetId = (await post("msdyn_CreateOperationSetV1", { ProjectId: projectId, Description: subject })).OperationSetId;
    await post("msdyn_PssCreateV1", { OperationSetId, Entity: { "@odata.type": "Microsoft.Dynamics.CRM.msdyn_projecttask", msdyn_projecttaskid: crypto.randomUUID(), msdyn_subject: subject, msdyn_LinkStatus: 192350000, "msdyn_project@odata.bind": `msdyn_projects(${projectId})`, "msdyn_projectbucket@odata.bind": `msdyn_projectbuckets(${bucket.msdyn_projectbucketid})` } });
    await post("msdyn_ExecuteOperationSetV1", { OperationSetId });
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) { caption("Waiting", `Project Operations is adding the task (${Math.round((Date.now() - t0) / 1000)} s)`); if (await exists()) return true; await new Promise(r => setTimeout(r, 3000)); }
    return false;
  }
  async function typeInto(box, value, force) {
    if (/^pick:/i.test(value)) return foPick(box, tokens(value.slice(5).trim()));
    if (/\{lastinvoice\}/i.test(value)) value = value.replace(/\{lastinvoice\}/ig, await lastInvoice());
    value = tokens(value, (box.querySelector("input[placeholder]") || {}).placeholder);
    // option sets: open the list and pick the option with that text
    const combo = box.querySelector('button[role=combobox],[role=combobox][data-id*="option-set"]');
    if (combo && !box.querySelector("input:not([type=hidden])")) {
      if (combo.innerText.trim() && combo.innerText.trim() !== "---" && !force) return "filled";
      combo.click();
      const opt = await waitFor(() => [...document.querySelectorAll("[role=option]")].find(o => o.getBoundingClientRect().width && o.innerText.trim().toLowerCase() === value.toLowerCase()), 3000);
      if (!opt) return false; opt.click(); return true;
    }
    // overwriting a lookup: remove the record that is in it first
    if (force) { const del = box.querySelector('[data-id*="selected_tag_delete"],button[aria-label^="Delete"]'); if (del) { del.click(); await waitFor(() => !box.querySelector('[data-id*="selected_tag"]') && box.querySelector("input:not([type=hidden])"), 3000); await new Promise(r => setTimeout(r, 300)); } }
    let inp = box.matches("input,textarea") ? box : box.querySelector("input:not([type=hidden]),textarea");
    if (!inp) { box.click(); inp = await waitFor(() => box.querySelector("input:not([type=hidden]),textarea"), 3000); }
    if (!inp) return false;
    const blank = v => !v || v === "---" || /^[^\d]*0+([.,]0+)?[^\d]*$/.test(v);
    if (!blank(inp.value) && !force) return "filled";
    if (box.querySelector('[data-id*="SelectedRecordList"] li,[data-id*="selected_tag"]')) return "filled";
    inp.focus();
    const proto = inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, "value").set;
    let typed = ""; if (force) { set.call(inp, ""); inp.dispatchEvent(new Event("input", { bubbles: true })); }
    for (const ch of String(value)) { typed += ch; set.call(inp, typed); inp.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 55)); } // slow enough to follow
    // lookups: pick the first search result
    const field = (box.getAttribute("data-id") || "").replace(/-FieldSectionItemContainer$/, "").replace(/^header_process_/, "").replace(/\..*$/, ""); // a field in the stage bar has a longer id
    if (field && /LookupResults/.test(inp.getAttribute("data-id") || "") && inp.getAttribute("aria-autocomplete") === "list") {
      const li = await waitFor(() => visible(document.querySelector(`[data-id$="LookupResultsDropdown_${field}_tab"] li[role=treeitem]`)), 15000);
      if (li) { li.click(); await new Promise(r => setTimeout(r, 400)); return true; }
      set.call(inp, ""); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.blur(); tlog("lookupEmpty", { field }); return false; // no match: nothing was picked
    }
    // date, time and duration pickers commit on Enter
    if (!IS_FO && inp.getAttribute("role") === "combobox") inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true })); inp.blur(); inp.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    if (IS_FO) { await new Promise(r => setTimeout(r, 1500)); await waitFor(() => !foBusy() && !document.querySelector(".processing") ? "idle" : null, 8000); await new Promise(r => setTimeout(r, 1000)); } // Finance answers a field after a moment, and an item's defaults would overwrite the next field
    return true;
  }
  // An error Dynamics shows after a click (business process error, required fields): the step is not done.
  const errorShown = () => {
    const d = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].find(x => x.getBoundingClientRect().width && /error|fault|required|cannot|can't|failed|not valid/i.test(x.innerText));
    if (d) return d.innerText.replace(/\s+/g, " ").slice(0, 160);
    // the red banner above a form, for example "Name : Required fields must be filled in"
    const b = visible(document.querySelector('[data-id="notificationWrapper"]'));
    if (!b) return "";
    // several messages collapse into "You have 2 notifications": open it once and read what they say
    if (/you have \d+ notifications/i.test(b.innerText) && !b.dataset.emphOpened) { b.dataset.emphOpened = "1"; document.querySelector('[data-id="notificationWrapper_expandIcon"]')?.click(); }
    const text = [...document.querySelectorAll('[data-id^="notification"]')].filter(x => x.getBoundingClientRect().width).map(x => x.innerText).join(" ").replace(/you have \d+ notifications\.?( select to view\.?)?/i, "");
    return /required fields|must be|error|failed|cannot|can't/i.test(text) ? text.replace(/\s+/g, " ").replace(/Press Alt.*$/, "").trim().slice(0, 160) : "";
  };
  const fieldEmpty = box => { const i = box.querySelector("input:not([type=hidden]),textarea"); if (i) return !i.value || i.value === "---"; const c = box.querySelector('button[role=combobox],[role=combobox]'); return !!c && (!c.innerText.trim() || c.innerText.trim() === "---"); };
  // A confirmation dialog of Dynamics (not a browser dialog): OK it when the step's demo value says confirm.
  // Finance and Supply Chain: OK the dialog the command opened (e.g. Post invoice proposals) and the message boxes after it.
  async function confirmFo() {
    let n = 0;
    for (let i = 0; i < 3; i++) {
      const ok = await waitFor(() => { const ds = [...document.querySelectorAll('[role=dialog],[data-dyn-role="Dialog"],.dialog-popup')].filter(x => x.getBoundingClientRect().width && !/Action center/.test(x.innerText));
        for (const d of ds.reverse()) { const b = [...d.querySelectorAll("button")].find(b => /^(OK|Yes)$/.test(b.innerText.trim()) && b.getBoundingClientRect().width); if (b) return b; } return null; }, i ? 6000 : 8000);
      if (!ok) break; tlog("dialogOk", { fo: true }); caption("Clicking", "OK"); await sleep(600); ok.click(); n++; await sleep(1500);
    }
    return n > 0;
  }
  const foBar = () => [...document.querySelectorAll('[class*=messageBar]')].filter(e => e.getBoundingClientRect().width).map(e => e.innerText.replace(/\s+/g, " ")).join(" ");
  const newFoError = before => { const now = foBar(); return now !== before && /canceled|does not exist|mandatory|must be|cannot be|no lines for posting/i.test(now) ? [...new Set(now.split(/(?<=\.)\s+/))].join(" ").slice(-160) : ""; };
  const foBusy = () => [...document.querySelectorAll('[role=dialog]')].some(x => x.getBoundingClientRect().width && /Processing operation/.test(x.innerText));
  async function confirmDialog() {
    const ok = await waitFor(() => visible(document.querySelector('[role=dialog] [data-id="confirmButton"],[role=alertdialog] [data-id="confirmButton"],[role=dialog] [data-id="okButton"],[role=alertdialog] [data-id="okButton"]')), 4000);
    if (ok) { tlog("dialogOk"); caption("Clicking", "OK"); await sleep(600); ok.click(); return true; }
    return false;
  }
  const RISKY = /SystemDefinedSaveButton|Delete|Post|Confirm|closeAsWon|ActivateQuote|\.Save\b|nextButtonContainer|MarkAsWon|MarkAsLost|\.Assign\b|Disqualify|Qualify/i;
  function pauseFor(text, buttons) {
    tlog("pause", { text: String(text).slice(0, 80) }); const t0 = Date.now();
    return new Promise(res => { ap.paused = true; ap.resume = v => { tlog("resume", { ms: Date.now() - t0 }); ap.paused = false; ap.resume = null; res(v); };
      caption("Your turn", text, buttons || [{ label: "Continue (Space)", fn: () => ap.resume && ap.resume() }, { label: "Stop", fn: stopAuto }]); });
  }
  function persistAuto(v) { st.autoReload = v; save(); }
  function startAuto(resume) { if (!st.flow) return; const atStart = (c => !!c && (c.type === T.start || st.steps.some(x => x.type === T.start && x.next.some(l => l.to === c.code))))(cur()); if (!st.runNo || (resume !== true && atStart)) st.runNo = runNo(); tlog("autoStart", { run: st.run }); ap.clicked = new Set(); persistAuto(false); ap.on = true; ap.token++; st.focus = false; st.min = false; save(); render(); runAuto(ap.token).catch(e => { caption("Stopped", e.message); ap.on = false; render(); }); }
  function stopAuto() { closeIntro(); if (st.autoReload) persistAuto(false); ap.on = false; ap.token++; ap.paused = false; ap.resume = null; hush(); caption(null); render(); }
  async function runAuto(tok) {
    const alive = () => ap.on && tok === ap.token;
    while (alive()) {
      const s = cur(); if (!s) break; const here0 = st.flow.id + s.code, t0 = Date.now();
      // Explain first, then act; and stay on the step long enough to read it, voice or no voice.
      const dwell = async () => { const rest = t0 + readMs(s) - Date.now(); if (rest > 0) await new Promise(r => setTimeout(r, rest)); };
      if (s.type === T.start) {
        const go_ = await showIntro(s); if (!alive() || !go_) return;
        if (s.next[0]) { st.how = "intro"; go(s.next[0].to); } await sleep(500); continue;
      }
      // "view": open it first and explain what is then on screen, for tabs and panels the explanation is about
      const isView = /^view$/i.test((s.demo || "").trim());
      if (isView && s.selector && pageState(s).ok) { const v = await waitFor(() => visible(q1(alts(s.selector)[0])), 5000); if (!alive()) return; if (v) { v.click(); tlog("autoClick"); await sleep(700); if (!alive()) return; } }
      render();
      const onScreen = !!s.selector && !/^(skip|manual)$/i.test((s.demo || "").trim()) && s.type !== T.end;
      caption(onScreen ? "Now" : s.type === T.end ? "Finished" : "Explaining", s.instruction || explainFallback(s));
      tlog("pace", { onScreen });
      await say(spoken(s));
      if (!alive()) return;
      if (s.type === T.end && s.cont) { await dwell(); if (!alive()) return; st.how = "auto"; go(null); await waitFor(() => st.flow.id + st.code !== here0, 10000); await sleep(800); continue; }
      if (s.type === T.end) { await dwell(); caption("Done", `${st.flow.name} finished`); await sleep(1500); ap.on = false; render(); return; }
      if (s.next.length <= 1 && (!onScreen || isView) && !/^manual$/i.test((s.demo || "").trim())) await dwell();
      if (!alive()) return;
      const demo = (s.demo || "").trim(), here = st.flow.id + s.code;
      // decisions: full autopilot takes the demo answer (or the first); checkpoints let the presenter answer
      if (s.next.length > 1) {
        let pick = s.next.find(l => (l.label || "").toLowerCase() === demo.toLowerCase()) || s.next[0];
        if (st.run === "check") pick = await pauseFor(`Decide: ${s.name}`, s.next.map(l => ({ label: l.label || "Next", fn: () => ap.resume && ap.resume(l) })).concat([{ label: "Stop", fn: stopAuto }]));
        if (!alive() || !pick) return; await dwell(); if (!alive()) return;
        caption("Answer", `${s.name}: ${pick.label || "next"}`); await sleep(1800); if (!alive()) return; st.how = "auto"; go(pick.to, pick.label); await sleep(800); continue;
      }
      if (/^manual$/i.test(demo)) { await pauseFor(`${s.instruction || s.name}. Continue when done.`); if (!alive()) return; if (st.flow.id + st.code === here) { st.how = "manual"; go(s.next[0]?.to); } await sleep(1500); continue; }
      if (!s.selector || /^(skip|view)$/i.test(demo)) { if (!alive()) return; if (st.flow.id + st.code === here) { st.how = "skip"; go(s.next[0]?.to); } await sleep(500); continue; }
      // get to the right page: follow the bridge (side menu, New, a list record) or open the page
      if (!pageState(s).ok && /click/.test(st.lastHow || "")) await waitFor(() => pageState(s).ok, 6000); // the last click may still be opening it
      if (!pageState(s).ok) {
        const pg = pageState(s), br = bridge(s);
        if (fromList(s)) {
          if (!onListOf(s)) { caption("Now", "Opening the list"); persistAuto(true); await sleep(400); const u = pageUrl(s); if (u) await softNav(u); await waitFor(() => onListOf(s), 20000); }
          const link = await waitFor(() => rowLink(s), 40000); if (!alive()) return;
          if (link) { caption("Now", `Opening ${tokens(demoArg(s, "open"))}`); await sleep(600); link.click(); }
        }
        else if (pg.canGo) { caption("Now", `Opening ${pg.what}`); persistAuto(true); await sleep(600); const u = pageUrl(s); if (u) await softNav(u); }
        else if (br) { caption("Now", br.text); await sleep(900); br.el.click(); }
        const t0 = Date.now(), tick = setInterval(() => caption("Waiting", `Dynamics is loading ${pg.what} (${Math.round((Date.now() - t0) / 1000)} s)`), 1000);
        const reached = await waitFor(() => pageState(s).ok, 45000); clearInterval(tick); tlog("reached", { ms: Date.now() - t0, ok: !!reached }); if (reached) persistAuto(false); if (!alive()) return;
        if (!reached) { await pauseFor(`Open ${pg.what} by hand, then Continue.`); if (!alive()) return; if (!pageState(s).ok) { stopAuto(); return; } }
        await sleep(1500);
      }
      // "openrow:<text>" opens that row of a sub-grid; the step's control is on the page it opens
      const rowToOpen = demoArg(s, "openrow");
      if (rowToOpen) { caption("Opening", tokens(rowToOpen)); await sleep(1500); if (!await openRow(rowToOpen)) { await pauseFor(`Open the row "${tokens(rowToOpen)}", then Continue.`); if (!alive()) return; } await waitFor(() => visible(q1(alts(s.selector)[0])), 20000); await sleep(1500); if (!alive()) return; }
      // some commands only appear once a row is selected (Approve), so the row comes first
      const selected = new Set();
      for (const ln of (demo ? demo.split(/\r?\n/) : [])) if (/^select(last|all)?:/i.test(ln.trim())) { const line = ln.trim(), last = /^selectlast:/i.test(line), all = /^selectall:/i.test(line), t = line.slice(line.indexOf(":") + 1); caption("Selecting", tokens(t)); if (!await (all ? selectAll(t) : selectRow(t, last))) { await pauseFor(`Select the row "${tokens(t)}", then Continue.`); if (!alive()) return; } selected.add(ln.trim()); await sleep(1200); if (!alive()) return; }
      // the control: open its fallback (stage flyout, More commands) when the primary is hidden
      const [first, ...rest] = alts(s.selector);
      const prim = () => visible(q1(first)) || (heal(s) || {}).el;
      const tf = Date.now(); let el = await waitFor(prim, 2500);
      if (!el && /^wait$/im.test(demo)) { caption("Waiting", "Dynamics is working on it"); el = await waitFor(prim, 60000); if (!alive()) return; } // wait: a slow screen, such as qualifying a lead
      if (!el) { const fb = rest.map(q1).find(visible); if (fb) { fb.click(); await sleep(900); } el = await waitFor(prim, 20000); }
      // on a narrow window Dynamics folds commands into the "..." menu of their command bar
      if (!el && /NoRelationship|\.commands?\./i.test(first)) for (const o of [...document.querySelectorAll('[data-id="OverflowButton"]')].filter(visible)) { o.click(); el = await waitFor(prim, 2000); if (el) break; o.click(); await sleep(300); }
      tlog("control", { ms: Date.now() - tf, ok: !!el });
      if (el && !q1(first)) caption("Healed", `Found "${s.name}" by its label`);
      if (!alive()) return;
      if (!el) { await pauseFor(`Can't find the control for "${s.name}". Do it by hand, then Continue.`); if (!alive()) return; if (st.flow.id + st.code === here) go(s.next[0]?.to); continue; }
      // fill demo values: "data-id=value" lines into those fields, or a plain value into the step's own field
      if (demo) {
        const lines = demo.split(/\r?\n/).filter(Boolean), unfilled = [];
        ap.filling = here;
        if (/\{lastwo\}/i.test(demo)) lastWo = await lastWorkOrder();
        for (const ln of lines) {
          if (/^newtask:/i.test(ln.trim())) {
            const subject = tokens(ln.trim().slice(8).trim()), project = new URL(s.page, location.origin).searchParams.get("id");
            let ok = false, why = ""; caption("Adding the task", subject); tlog("newTask", { subject });
            try { ok = await newProjectTask(project, subject); } catch (e) { why = ": " + e.message; }
            if (!ok) { tlog("error", { text: "newtask" + why }); await pauseFor(`Could not add the task "${subject}"${why}. Add it on the Tasks tab by hand, then Continue.`); }
            if (!alive()) return; continue;
          }
          if (/^(confirm|wait)$/i.test(ln.trim()) || /^open:/i.test(ln.trim())) continue;
          if (selected.has(ln.trim()) || /^openrow:/i.test(ln.trim())) continue;
          const m = ln.match(/^([\w.|$-]+?)(!?)=(.*)$/); const box = m ? fieldBox(m[1]) : el; const val = m ? m[3] : ln, force = !!(m && m[2]);
          if (!box) continue;
          caption("Typing", tokens(val)); tlog("type", { chars: String(val).length });
          const typedResult = await typeInto(box, val, force);
          if (typedResult === "filled") { await pauseFor(`A field already has a value, so autopilot will not overwrite it (${m ? m[1] : s.name}). Check you are on a new demo record, then Continue.`); if (!alive()) return; }
          else if (typedResult === false) unfilled.push({ box, name: m ? m[1] : s.name, val });
          await sleep(1000);
          if (!alive()) return;
        }
        // A form still initializing can wipe what was typed into it: check every field and type again what got lost.
        for (const ln of lines) {
          const m = ln.match(/^([\w.|$-]+?)(!?)=(.*)$/); if (!m) continue;
          const box = fieldBox(m[1]); if (!box || !fieldEmpty(box)) continue;
          tlog("retype", { field: m[1] }); caption("Typing", m[3]); await typeInto(box, m[3], true); await sleep(1000); if (!alive()) return;
        }
        // only now is a field that stayed empty a real problem: a form still loading is caught by the retype above
        for (const u of unfilled) if ((b => !b.querySelector('input,textarea,[role=combobox],[data-id*="selected_tag"]') || fieldEmpty(b))(fieldBox(u.name) || u.box)) { tlog("notFilled", { field: u.name }); await pauseFor(`Could not fill ${u.name} with "${tokens(u.val)}". Fill it by hand, then Continue.`); if (!alive()) return; }
        ap.filling = null;
      }
      if (isAction(el)) {
        if (st.run === "check" && RISKY.test(first)) { await pauseFor(`Next: ${s.instruction || s.name}. Continue to let autopilot click it.`); if (!alive()) return; }
        caption("Clicking", s.instruction || s.name); await sleep(/^wait$/im.test(demo) ? 7000 : 1800); await dwell(); if (!alive()) return; // the highlight shows what is about to be clicked
        // a flow that loops must never post the same document twice without someone looking
        if (ap.clicked && ap.clicked.has(here)) { tlog("repeatStop"); await pauseFor(`The flow came back to "${s.name}", which already ran. Stop here, or Continue to do it again.`, [{ label: "Stop", fn: stopAuto }, { label: "Do it again", fn: () => ap.resume && ap.resume() }]); if (!alive()) return; }
        (ap.clicked = ap.clicked || new Set()).add(here);
        const barBefore = foBar();
        el.click(); tlog("autoClick");
        const saving = SAVES.test(first), slow = SLOW.test(first), before = location.href;
        let err = null;
        if ((saving || slow) && !(IS_FO && /^confirm$/im.test(demo))) { await sleep(1200); const r = await waitSaving(() => errorShown() || (location.href !== before || !el.isConnected || ((slow || /^confirm$/im.test(demo)) && infoDialog()) || (!slow && /\.Save"\]/.test(first) && formSaved()) || (IS_FO && !foBusy() && !document.querySelector(".processing")) ? "moved" : null)); err = r && r !== "moved" ? r : null; if (!r && /^wait$/im.test(demo)) { tlog("noEffect"); await pauseFor(`"${s.name}" showed no result. Check the page, do it by hand if needed, then Continue.`); if (!alive()) return; } }
        else err = await waitFor(errorShown, 1500);
        if (!err && IS_FO) { await sleep(800); err = newFoError(barBefore); }
        if (err) { tlog("error", { text: err }); await pauseFor(`Dynamics reported a problem: ${err}. Fix it on the page, then Continue.`); if (!alive()) return; if (st.flow.id + st.code === here) { st.how = "manual"; go(s.next[0]?.to); } continue; }
        if (/^confirm$/im.test(demo)) { if (st.run === "check") await pauseFor("Confirm the dialog, then Continue."); else if (IS_FO) { await confirmFo(); await waitSaving(() => !foBusy() && !document.querySelector('[role=dialog] .processing') ? "done" : null); const fe = newFoError(barBefore); if (fe) { tlog("error", { text: fe }); await pauseFor(`Dynamics reported a problem: ${fe}. Fix it on the page, then Continue.`); } } else await confirmDialog(); if (!alive()) return; }
        if (st.flow.id + st.code === here) { st.how = "autoclick"; go(s.next[0]?.to); await waitFor(() => st.flow.id + st.code !== here, 15000); } // moving to another flow takes a moment: do not repeat this step meanwhile
      } else {
        await sleep(1500); await dwell(); if (!alive()) return; if (st.flow.id + st.code === here) { st.how = "autofield"; go(s.next[0]?.to); }
      }
      await sleep(1000);
    }
  }
  document.addEventListener("keydown", e => {
    if (e.code === "Space" && ap.paused && ap.resume && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) { e.preventDefault(); ap.resume(); }
  }, true);

  // ---------- start ----------
  render();
  if (launch) { st.open = true; st.focus = false; st.done = []; save(); openFlow(launch.flowId, launch.code || null).catch(e => { st.err = e.message; render(); }); }
  else if (saved.flowId && st.open) openFlow(saved.flowId, saved.code, true).then(() => { if (saved.auto && st.run !== "narrated") { persistAuto(false); setTimeout(() => startAuto(true), 2500); } }).catch(e => { st.err = e.message; render(); });
  if (EXT) chrome.storage.onChanged.addListener((ch, area) => {
    // a "Start guide" click in another tab while this tab is open on the target page
    if (area === "local" && ch.emphLaunch && ch.emphLaunch.newValue && document.visibilityState === "visible" && !IS_CE) { const l = ch.emphLaunch.newValue; chrome.storage.local.remove("emphLaunch"); st.open = true; st.done = []; openFlow(l.flowId, l.code || null).catch(e => { st.err = e.message; render(); }); }
  });
  }
})();
