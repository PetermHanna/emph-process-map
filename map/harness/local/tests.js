// Scripted checks for the local page. Run from the console: await __tests.all()
// They click through the real UI against the in-memory data, so they test the app's behaviour end to end.
(function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const q = sel => document.querySelector(sel);
  const button = re => [...document.querySelectorAll("button")].find(b => re.test(b.innerText.trim()));
  async function until(fn, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await wait(80); } throw new Error("Timed out: " + fn); }
  const nav = async key => { q('[data-emph="nav-' + key + '"]').click(); await wait(250); };
  const rows = t => window.__T[t] || [];

  async function pages() {
    const out = [];
    for (const k of ["overview", "processes", "requirements", "workshops", "signoff", "applications", "settings"]) { await nav(k); out.push(k + ":" + (q("h1")?.innerText || "")); }
    return out.join(" | ");
  }
  async function processAndFlow() {
    await nav("processes");
    [...document.querySelectorAll('[data-emph="process-tree"] > div')].find(d => /Project to profit/.test(d.innerText)).click(); await wait(200);
    [...document.querySelectorAll('[data-emph="process-tree"] div')].find(d => /^80\.50\s*Manage project financials$/.test(d.innerText.trim())).click(); await wait(200);
    (await until(() => [...document.querySelectorAll('[data-emph="process-node"]')].find(d => /Invoice project milestones/.test(d.innerText)))).click();
    await until(() => q('[data-emph="process-panel"]'));
    const before = rows("emph_processflow").length;
    q('[data-emph="open-flow"]').click();
    (await until(() => q('[data-emph="flow-adapt"]'))).click();
    await until(() => rows("emph_processflow").length === before + 1);
    await until(() => q('[data-emph="flow-confirm"]'));
    const ours = rows("emph_processflow")[before];
    const acts = rows("emph_flowactivity").filter(a => a._emph_processflow_value === ours.emph_processflowid).length;
    q('[data-emph="flow-confirm"]').click(); await wait(500);
    const state = ours.emph_state;
    return "copied " + acts + " activities, state " + state;
  }
  // "Play in the guide": a hint without the extension; with it (the page marked data-emph-guide), a new tab with ?emphguide=<flow id>
  async function guide() {
    await nav("processes");
    const node = () => [...document.querySelectorAll('[data-emph="process-node"]')].find(d => /Invoice project milestones/.test(d.innerText));
    if (!node()) { // processAndFlow may have left the tree open
      const area = () => [...document.querySelectorAll('[data-emph="process-tree"] div')].find(d => /^80\.50\s*Manage project financials$/.test(d.innerText.trim()));
      if (!area()) { [...document.querySelectorAll('[data-emph="process-tree"] > div')].find(d => /Project to profit/.test(d.innerText)).click(); await wait(200); }
      area().click(); await wait(200);
    }
    (await until(node)).click();
    await until(() => q('[data-emph="process-panel"]'));
    q('[data-emph="open-flow"]').click();
    const adapt = await until(() => q('[data-emph="flow-adapt"]') || q('[data-emph="flow-play-hint"]'));
    if (adapt.dataset.emph === "flow-adapt") adapt.click();
    (await until(() => q('[data-emph="flow-play-hint"]'))).click();
    await until(() => q('[data-emph="guide-hint"]'));
    button(/^OK$/).click(); await wait(200);
    const html = document.documentElement, opened = [], open = window.open, heard = [];
    const onStart = e => heard.push(e.detail.flowId);
    window.addEventListener("emph-guide-start", onStart);
    window.open = u => { opened.push(String(u)); return null; };
    try {
      html.setAttribute("data-emph-guide", "test");
      (await until(() => q('[data-emph="flow-play"]'))).click(); await wait(100);
    } finally { window.open = open; window.removeEventListener("emph-guide-start", onStart); html.removeAttribute("data-emph-guide"); html.removeAttribute("data-emph-guide-start"); }
    const ours = rows("emph_processflow").find(f => f.emph_flowtype === 582100001 && /^80\.50/.test(f.emph_catalogcode || "") && (opened[0] || "").includes(f.emph_processflowid));
    if (!ours || !opened[0] || !opened[0].includes("emphguide=" + ours.emph_processflowid) || heard[0] !== ours.emph_processflowid) throw new Error("launch: " + JSON.stringify({ opened, heard }));
    q('[aria-label="Close"]')?.click(); await wait(300);
    return "hint shown, played our process in " + opened[0].replace(location.origin, "");
  }
  async function capture() {
    await nav("requirements");
    const box = q('[data-emph="capture"] textarea');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    set.call(box, "Test requirement from the scripted check"); box.dispatchEvent(new Event("input", { bubbles: true })); await wait(100);
    button(/^Capture$/).click();
    await until(() => rows("emph_requirement").some(r => r.emph_description === "Test requirement from the scripted check"));
    return "captured " + rows("emph_requirement").length;
  }
  async function signOff() {
    await nav("signoff");
    q('[data-emph="signoff-freeze"]').click();
    await until(() => rows("emph_signoff").length === 1);
    await until(() => rows("emph_signoffitem").length > 0);
    return "frozen " + rows("emph_signoffitem").length + " items";
  }
  async function workshop() {
    await nav("workshops");
    q('[data-emph="workshop-new"]').click();
    await until(() => q('[data-emph="phases"]'));
    return "workshop " + rows("emph_workshop").length;
  }
  async function mainMap() {
    await nav("overview");
    const sections = document.querySelectorAll('[data-emph="e2e-section"]').length;
    const columns = document.querySelectorAll('[data-emph="area-column"]').length;
    // rename the first in-scope process card
    const card = [...document.querySelectorAll('[data-emph="process-card"]')].find(c => c.querySelector('[data-emph="scope-toggle"] svg') && !c.style.opacity.startsWith("0"));
    const before = card.querySelector('[data-emph="rename"]').getAttribute("aria-label").replace(/^Rename /, "");
    card.querySelector('[data-emph="rename"]').click(); await wait(150);
    const input = card.querySelector("input");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "Our own name for it");
    input.dispatchEvent(new Event("input", { bubbles: true })); await wait(50);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await wait(400);
    const row = rows("emph_businessprocess").find(r => r.emph_name === "Our own name for it");
    if (!row || row.emph_catalogname !== before) throw new Error("rename did not keep Microsoft's name");
    // take a process out of scope and back in
    const toggle = [...document.querySelectorAll('[data-emph="scope-toggle"]')][0];
    const id = rows("emph_businessprocess").filter(r => r.emph_inscope).length;
    toggle.click(); await wait(300);
    const after = rows("emph_businessprocess").filter(r => r.emph_inscope).length;
    return sections + " sections, " + columns + " area columns, renamed \u201c" + before + "\u201d, in scope " + id + " -> " + after;
  }
  window.__tests = {
    pages, processAndFlow, guide, capture, signOff, workshop, mainMap,
    async all() { const r = {}; for (const [k, f] of Object.entries({ pages, mainMap, processAndFlow, guide, capture, signOff, workshop })) { try { r[k] = await f(); } catch (e) { r[k] = "FAIL " + e.message; } } return r; },
  };
})();
