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
    const listed = (await until(() => q('[data-emph="agenda-pick"]'))).querySelectorAll('input[type="checkbox"]').length;
    const inScope = rows("emph_businessprocess").filter(r => r.emph_inscope).length;
    if (listed !== inScope) throw new Error("agenda lists " + listed + " processes, " + inScope + " in scope");
    return "workshop " + rows("emph_workshop").length + ", agenda lists the " + listed + " in-scope processes";
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

  // Meeting transcript (made-up): agenda, paste, then each kind of use: requirement, licence, comment, open point, and a requirement on a flow step; a screenshot.
  const TRANSCRIPT = "Ana Field   0:01\nUsually the foreman approves the work order, sometimes the PM skips it.\n\nBen Office   0:02\nWe need read-only access for the office, maybe five licences.\n\nAna Field   0:03\nWe always do the credit check.\n\nBen Office   0:04\nOnly above ten thousand, someone from management should look into that.\nBen Office stopped transcription\nCarl Site   0:05\nThirty technicians plus eight foremen.\n\nCarl Site   10:00\nWe don't do the second check any more.";
  const pickOption = async (combo, text) => { combo.click(); const o = await until(() => [...document.querySelectorAll('[role="option"]')].find(x => x.innerText.trim() === text)); o.click(); await wait(150); };
  async function transcript() {
    await nav("workshops");
    if (!q('[data-emph="workshop-new"]')) { button(/All workshops/).click(); await wait(200); }
    q('[data-emph="workshop-new"]').click();
    await until(() => q('[data-emph="phases"]'));
    const total = (await until(() => q('[data-emph="agenda-total"]'))).innerText;
    if (!/\d+ business processes, \d+ min/i.test(total)) throw new Error("agenda: " + total);
    const items = await until(() => { const a = document.querySelectorAll('[data-emph="agenda-item"]'); return a.length >= 2 && a; });
    items[0].click(); await wait(300); items[1].click(); await wait(300);
    q('[data-emph="transcript-toggle"]').click();
    const box = await until(() => q('[data-emph="transcript-paste"] textarea') || q('textarea[data-emph="transcript-paste"]'));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, TRANSCRIPT); box.dispatchEvent(new Event("input", { bubbles: true })); await wait(150);
    const preview = q('[data-emph="transcript-preview"]').innerText;
    if (!/Read 6 lines from 3 speakers/.test(preview)) throw new Error("preview: " + preview);
    q('[data-emph="transcript-keep"]').click();
    const ws = () => rows("emph_workshop")[rows("emph_workshop").length - 1];
    await until(() => (ws().emph_transcript || "").includes("foreman"));
    await until(() => document.querySelectorAll('[data-emph="transcript-line"]').length === 6); // line 5 moves onto a flow step once the walk starts
    if (!document.querySelector('mark[data-mark="hedge"]')) throw new Error("no hedges marked");
    const captureBox = () => [...q('[data-emph="capture"]').querySelectorAll("button")].find(b => b.innerText.trim() === "Capture");
    // 0: a requirement
    q('[data-line="0"] [data-emph="line-capture"]').click();
    const from = await until(() => q('[data-emph="capture-from"]'));
    if (!/\[0:01\] Ana Field: Usually/.test(from.innerText)) throw new Error("capture-from: " + from.innerText);
    captureBox().click();
    const req = await until(() => rows("emph_requirement").find(r => (r.emph_verbatim || "").startsWith("[0:01] Ana Field:")));
    if (req.emph_raisedby !== "Ana Field" || !req._emph_workshop_value) throw new Error("requirement fields");
    await until(() => /RQ-/.test(q('[data-line="0"]').innerText));
    if (q('[data-line="0"] [data-emph="line-capture"]')) throw new Error("line 0 can still be used");
    // 1: a licence need on a role
    q('[data-line="1"] [data-emph="line-licence"]').click();
    const form = await until(() => q('[data-emph="licence-form"]'));
    const combos = form.querySelectorAll('[role="combobox"]');
    const roleName = rows("emph_role")[0].emph_name;
    await pickOption(combos[0], roleName); await pickOption(combos[1], "Read-only");
    q('[data-emph="licence-save"]').click();
    await until(() => rows("emph_role").some(r => r.emph_licencetype === 582100002 && /read-only access/.test(r.emph_licencenote || "")));
    await until(() => /Licence: .+, Read-only/.test(q('[data-line="1"]').innerText));
    // 2: a comment, 3: an open point
    q('[data-line="2"] [data-emph="line-comment"]').click();
    await until(() => rows("emph_comment").some(c => c.emph_source === "[0:03] Ana Field: We always do the credit check." && c.emph_author === "Ana Field" && c._emph_workshop_value));
    await until(() => /Comment/.test(q('[data-line="2"]').innerText));
    q('[data-line="3"] [data-emph="line-open"]').click();
    await until(() => JSON.parse(ws().emph_sessiondata).actions.some(a => /ten thousand/.test(a.text) && /^\[0:04\] Ben Office:/.test(a.source)));
    // walk the flow: the step visit collects line 5, and its requirement is linked to the step
    [...document.querySelectorAll('[data-emph="phases"] button')][3].click();
    const adapt = await until(() => q('[data-emph="walk-adapt"]') || q('[data-emph="walk-step"]'));
    if (adapt.dataset.emph === "walk-adapt") adapt.click();
    const step = await until(() => q('[data-emph="walk-step"]'));
    const code = step.dataset.code; step.click();
    await until(() => JSON.parse(ws().emph_sessiondata).current.endsWith("#" + code));
    const l5 = await until(() => q('[data-line="5"]'));
    if (!/›/.test(l5.innerText)) throw new Error("line 5 has no step: " + l5.innerText);
    l5.querySelector('[data-emph="line-capture"]').click();
    await until(() => q('[data-emph="capture-step"]'));
    captureBox().click();
    const onStep = await until(() => rows("emph_requirement").find(r => (r.emph_verbatim || "").includes("second check")));
    const act = rows("emph_flowactivity").find(a => a.emph_flowactivityid === onStep._emph_flowactivity_value);
    if (!act || act.emph_activitycode !== code || !onStep._emph_businessprocess_value) throw new Error("requirement not on the step");
    // a screenshot, with a canvas standing in for the screen picker
    const md = navigator.mediaDevices, real = md.getDisplayMedia;
    md.getDisplayMedia = async () => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; const g = c.getContext("2d"); g.fillStyle = "#0D9488"; g.fillRect(0, 0, 640, 360); const st = c.captureStream(5); setInterval(() => g.fillRect(0, 0, 1, 1), 50); return st; };
    try { q('[data-emph="screenshot"]').click(); await until(() => rows("annotation").length > 0, 6000); } finally { md.getDisplayMedia = real; }
    const note = rows("annotation")[0];
    if (note.mimetype !== "image/jpeg" || !note.documentbody || note._objectid_value !== ws().emph_workshopid) throw new Error("note fields");
    (await until(() => q('[data-emph="screenshots"] button'))).click();
    await until(() => document.querySelector('img[src^="data:image/jpeg;base64,"]'));
    button(/^Close$/)?.click(); await wait(200);
    const usedNow = (q('[data-emph="transcript-stats"]').innerText.match(/(\d+) used/) || [])[1];
    if (usedNow !== "5") throw new Error("used " + usedNow);
    return "agenda " + total.replace(/^· /, "").toLowerCase() + "; 6 lines, 5 used (requirement, licence, comment, open point, requirement on step " + act.emph_activitycode + "), screenshot " + Math.round(note.documentbody.length * 0.75 / 1024) + " KB";
  }
  window.__tests = {
    pages, processAndFlow, guide, capture, signOff, workshop, transcript, mainMap,
    async all() { const r = {}; for (const [k, f] of Object.entries({ pages, mainMap, processAndFlow, guide, capture, signOff, workshop, transcript })) { try { r[k] = await f(); } catch (e) { r[k] = "FAIL " + e.message; } } return r; },
  };
})();
