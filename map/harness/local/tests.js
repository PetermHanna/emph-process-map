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
    for (const k of ["overview", "processes", "requirements", "raid", "workshops", "signoff", "history", "systems", "settings"]) { await nav(k); out.push(k + ":" + (q("h1")?.innerText || "")); }
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
    // business processes (level 3) in scope: not Not applicable themselves (decision 1), with their area and end-to-end process in scope
    const items = rows("emph_processitem"), byId = new Map(items.map(r => [r.emph_processitemid, r]));
    const own = r => (r.emph_level === 3 ? r.emph_scope !== 582100002 && r.emph_scope !== 582100003 : r.emph_scope === 582100001);
    const on = r => own(r) && (!r._emph_parent_value || on(byId.get(r._emph_parent_value)));
    const inScope = items.filter(r => r.emph_level === 3 && on(r)).length;
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
    const row = rows("emph_processitem").find(r => r.emph_name === "Our own name for it");
    if (!row || row.emph_catalogname !== before) throw new Error("rename did not keep Microsoft's name");
    // take a process out (40 - Not applicable: a business process takes no In scope of its own) and back in; history records both
    const UNSPECIFIED = 582100000, NA = 582100003;
    const l3 = () => rows("emph_processitem").filter(r => r.emph_level === 3 && r.emph_scope !== NA && r.emph_scope !== 582100002).length;
    const before3 = l3(), hist = rows("emph_history").length;
    const toggle = () => [...document.querySelectorAll('[data-emph="process-card"]')].find(c => c.innerText.includes("Our own name for it"))?.querySelector('[data-emph="scope-toggle"]');
    const e2eCode = toggle().closest('[data-emph="e2e-section"]').querySelector("header").innerText.trim().split(/\s/)[0];
    toggle().click(); await wait(300);
    // the last process in scope takes its end-to-end section with it: open it again from the list below
    if (!toggle()) { [...document.querySelectorAll('[data-emph="open-e2e"]')].find(b => b.innerText.trim().startsWith(e2eCode + " ")).click(); await wait(300); }
    if (row.emph_scope !== NA || l3() !== before3 - 1) throw new Error("not Not applicable: " + row.emph_scope);
    toggle().click(); await wait(400);
    if (row.emph_scope !== UNSPECIFIED || row.emph_sethow !== 582100001 || !row.emph_seton) throw new Error("not back in with Set how Direct");
    const logged = rows("emph_history").slice(hist).filter(h => h.emph_rowid === row.emph_processitemid && h.emph_field === "emph_scope").map(h => h.emph_newvalue);
    if (logged.join("|") !== "40 - Not applicable|10 - Unspecified") throw new Error("history: " + logged.join("|"));
    // scope with a reason on each end-to-end process and area (levels 1 and 2)
    const picks = document.querySelectorAll('[data-emph="e2e-scope"] [data-emph="scope-pick"][data-level="1"]').length, areaPicks = document.querySelectorAll('[data-emph="area-scope"] [data-emph="scope-pick"][data-level="2"]').length;
    if (picks !== sections || areaPicks !== columns) throw new Error("scope picks " + picks + "/" + sections + ", " + areaPicks + "/" + columns);
    // products read up from the scenarios in scope
    const products = q('[data-emph="target-products"]')?.innerText || "";
    if (!/Field Service/.test(products)) throw new Error("target products: " + products);
    return sections + " sections, " + columns + " area columns, renamed \u201c" + before + "\u201d, out and back in scope (2 history rows), target " + products.replace(/^.*?:\s*/, "").replace(/\n/g, ", ");
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
    q('[data-emph="prepare-start"]').click(); await wait(300);
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
    const req = await until(() => rows("emph_requirement").find(r => (r.emph_sourcetext || "").startsWith("[0:01] Ana Field:")));
    if (req.emph_raisedby !== "Ana Field" || !req._emph_workshop_value) throw new Error("requirement fields");
    await until(() => /RQ-/.test(q('[data-line="0"]').innerText));
    if (q('[data-line="0"] [data-emph="line-capture"]')) throw new Error("line 0 can still be used");
    // 1: a licence need on a role
    q('[data-line="1"] [data-emph="line-licence"]').click();
    const form = await until(() => q('[data-emph="licence-form"]'));
    const combos = form.querySelectorAll('[role="combobox"]');
    const roleName = rows("emph_role")[0].emph_name;
    await pickOption(combos[0], roleName); await pickOption(combos[1], "Team Members");
    q('[data-emph="licence-save"]').click();
    await until(() => rows("emph_role").some(r => r.emph_licencetype === 582100001 && /read-only access/.test(r.emph_licencenote || "")));
    await until(() => /Licence: .+, Team Members/.test(q('[data-line="1"]').innerText));
    // 2: a comment, 3: an open point
    q('[data-line="2"] [data-emph="line-comment"]').click();
    await until(() => rows("emph_comment").some(c => c.emph_source === "[0:03] Ana Field: We always do the credit check." && c.emph_author === "Ana Field" && c._emph_workshop_value));
    await until(() => /Comment/.test(q('[data-line="2"]').innerText));
    q('[data-line="3"] [data-emph="line-open"]').click();
    await until(() => rows("emph_raid").some(a => /ten thousand/.test(a.emph_description) && /^\[0:04\] Ben Office:/.test(a.emph_sourcetext || "") && a.emph_raidtype === 582100004 && a._emph_workshop_value === ws().emph_workshopid));
    await until(() => /Open point/.test(q('[data-line="3"]').innerText));
    // walk the flow: the step visit collects line 5, and its requirement is linked to the step
    q('[data-emph="tool-tab"][data-tab="flow"]').click(); // the old phase "Process flow" is a tab of the business process line
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
    const onStep = await until(() => rows("emph_requirement").find(r => (r.emph_sourcetext || "").includes("second check")));
    const act = rows("emph_flowactivity").find(a => a.emph_flowactivityid === onStep._emph_flowactivity_value);
    if (!act || act.emph_activitycode !== code || !onStep._emph_item_value) throw new Error("requirement not on the step");
    // a screenshot, with a canvas standing in for the screen picker
    const md = navigator.mediaDevices, real = md.getDisplayMedia;
    md.getDisplayMedia = async () => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; const g = c.getContext("2d"); g.fillStyle = "#0D9488"; g.fillRect(0, 0, 640, 360); const st = c.captureStream(5); setInterval(() => g.fillRect(0, 0, 1, 1), 50); return st; };
    try { q('[data-emph="screenshot"]').click(); await until(() => q('[data-emph="shot-canvas"]'), 6000); } finally { md.getDisplayMedia = real; }
    const pe = (el, type, x, y) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 5, clientX: r.left + r.width * x, clientY: r.top + r.height * y })); };
    const cv = q('[data-emph="shot-canvas"]');
    pe(cv, "pointerdown", 0.1, 0.1); for (let k = 2; k <= 6; k++) { pe(cv, "pointermove", 0.1 * k, 0.1 * k); await wait(20); } pe(cv, "pointerup", 0.6, 0.6); await wait(100);
    q('[data-emph="shot-comment"]').click(); await wait(100);
    pe(q('[data-emph="shot-canvas"]'), "pointerdown", 0.5, 0.3); await wait(150);
    const ct = await until(() => q('[data-emph="shot-comment-text"] textarea') || q('textarea[data-emph="shot-comment-text"]'));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ct, "Wrong price list here"); ct.dispatchEvent(new Event("input", { bubbles: true })); await wait(100);
    q('[data-emph="shot-comment-add"]').click(); await wait(100);
    q('[data-emph="shot-save"]').click();
    await until(() => rows("annotation").length > 0, 6000);
    const note = rows("annotation")[0];
    if (note.mimetype !== "image/jpeg" || !note.documentbody || note._objectid_value !== ws().emph_workshopid) throw new Error("note fields");
    if (!/--- marks ---/.test(note.notetext || "") || !/Wrong price list here/.test(note.notetext)) throw new Error("marks not in the note: " + note.notetext);
    if (JSON.parse(note.notetext.split("--- marks ---\n")[1]).strokes.length !== 1) throw new Error("the line is not in the marks: " + note.notetext);
    (await until(() => q('[data-emph="screenshots"] button'))).click();
    await until(() => document.querySelector('img[src^="data:image/jpeg;base64,"]'));
    button(/^Close$/)?.click(); await wait(200);
    const usedNow = (q('[data-emph="transcript-stats"]').innerText.match(/(\d+) used/) || [])[1];
    if (usedNow !== "5") throw new Error("used " + usedNow);
    return "agenda " + total.replace(/^· /, "").toLowerCase() + "; 6 lines, 5 used (requirement, licence, comment, open point, requirement on step " + act.emph_activitycode + "), screenshot " + Math.round(note.documentbody.length * 0.75 / 1024) + " KB with a line and a comment";
  }
  // Slice 4, on the workshop transcript() left open: a line marked not relevant and back, edited and kept as a business rule,
  // undone; the read-back answers; the meeting request; a drawing on the flow kept with the workshop; the close checks.
  async function review() {
    const ws = () => rows("emph_workshop")[rows("emph_workshop").length - 1];
    const sw = [...document.querySelectorAll('[data-emph="transcript"] label')].find(x => /^All lines/.test(x.innerText.trim()));
    if (sw && !sw.closest(".fui-Switch").querySelector("input").checked) { sw.click(); await wait(250); }
    const line = () => q('[data-line="4"]');
    if (!/Suggested:/.test(line().innerText)) throw new Error("no suggested type: " + line().innerText);
    line().querySelector('[data-emph="line-reject"]').click();
    await until(() => line().dataset.status === "rejected" && /Not relevant/.test(line().innerText));
    await until(() => Object.values(JSON.parse(ws().emph_sessiondata).review || {}).some(r => r.status === "rejected"));
    line().querySelector('[data-emph="line-undo"]').click();
    await until(() => line().dataset.status === "todo");
    line().querySelector('[data-emph="line-edit"]').click();
    const ta = await until(() => line().querySelector('textarea'));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "Thirty technicians and eight foremen book time daily."); ta.dispatchEvent(new Event("input", { bubbles: true })); await wait(150);
    line().querySelector('[data-emph="line-rule"]').click();
    await until(() => /Business rule/.test(q('[data-emph="capture-type"]')?.innerText || ""));
    const box = q('[data-emph="capture"] textarea');
    if (!/book time daily/.test(box.value)) throw new Error("edited words not in the capture box: " + box.value);
    [...q('[data-emph="capture"]').querySelectorAll("button")].find(b => b.innerText.trim() === "Capture").click();
    const rule = await until(() => rows("emph_requirement").find(r => /book time daily/.test(r.emph_description || "")));
    if (rule.emph_requirementtype !== 582100006 || !/^\[0:05\] Carl Site: Thirty technicians plus eight foremen\.$/.test(rule.emph_sourcetext)) throw new Error("rule fields " + rule.emph_requirementtype + " " + rule.emph_sourcetext);
    await until(() => line().dataset.status === "accepted" && q('[data-line="4"] [data-emph="line-undo"]'));
    q('[data-line="4"] [data-emph="line-undo"]').click();
    await until(() => !rows("emph_requirement").some(r => r === rule || r.emph_requirementid === rule.emph_requirementid) && line().dataset.status === "todo");
    // the read-back: answer two lines, name who confirmed
    button(/^4\. Conclusion$/).click();
    const rb = await until(() => document.querySelectorAll('[data-emph="read-back-line"]').length >= 2 && document.querySelectorAll('[data-emph="read-back-line"]'));
    rb[0].querySelector('[data-emph="read-back-confirmed"]').click(); await wait(250);
    q('[data-emph="read-back-line"]:nth-of-type(2) [data-emph="read-back-changed"]')?.click() || document.querySelectorAll('[data-emph="read-back-line"]')[1].querySelector('[data-emph="read-back-changed"]').click();
    await until(() => Object.keys(JSON.parse(ws().emph_sessiondata).readBack?.marks || {}).length === 2);
    const by = q('input[data-emph="read-back-by"]') || q('[data-emph="read-back-by"] input');
    by.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(by, "Ana Field, office lead"); by.dispatchEvent(new Event("input", { bubbles: true })); by.blur(); by.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await until(() => JSON.parse(ws().emph_sessiondata).readBack?.confirmedBy === "Ana Field, office lead");
    const counts = q('[data-emph="read-back-counts"]').innerText;
    // Close lists what is still missing and keeps the answers on requirements for their history
    button(/^5\. Close$/).click();
    const checks = (await until(() => q('[data-emph="close-checks"]'))).innerText;
    if (!/not answered yet/.test(checks) || !/to review/.test(checks)) throw new Error("close checks: " + checks);
    // the meeting request in Prepare: Teams link with subject, attendees and agenda
    button(/^1\. Prepare$/).click();
    (await until(() => q('[data-emph="meeting-request"]'))).click();
    await until(() => q('[data-emph="meeting-form"]'));
    const subject = (q('input[data-emph="meeting-subject"]') || q('[data-emph="meeting-subject"] input')).value;
    const opened = []; const realOpen = window.open; window.open = u => { opened.push(u); return null; };
    try { q('[data-emph="meeting-open"]').click(); await wait(150); } finally { window.open = realOpen; }
    const u = new URL(opened[0] || "https://x/");
    if (u.pathname !== "/l/meeting/new" || !/process workshop/.test(u.searchParams.get("subject") || "") || !/^1\. /.test(u.searchParams.get("content") || "")) throw new Error("meeting link: " + opened[0]);
    button(/^Cancel$/)?.click(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(250);
    if (q('[data-emph="meeting-form"]')) { q('[data-emph="meeting-form"]').closest('[role="dialog"]')?.querySelector("button")?.click(); await wait(200); }
    // a line drawn on our process in the flow studio is kept with the workshop, on the step it is on
    button(/^2\. Run the agenda$/).click(); await wait(300);
    q('[data-emph="tool-tab"][data-tab="flow"]')?.click(); await wait(300);
    (await until(() => button(/^Open the flow studio$/))).click();
    (await until(() => q('[data-emph="flow-draw"]'))).click();
    const layer = await until(() => q('[data-emph="flow-draw-layer"]'));
    const node = await until(() => q('.react-flow__node-step'));
    const nr = node.getBoundingClientRect(), lr = layer.getBoundingClientRect();
    const pt = (type, dx) => layer.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 6, clientX: nr.left + 10 + dx, clientY: nr.top + nr.height / 2 }));
    if (nr.left < lr.left || nr.top < lr.top) throw new Error("step not on the canvas");
    pt("pointerdown", 0); for (let k = 1; k <= 6; k++) { pt("pointermove", k * 12); await wait(20); } pt("pointerup", 72);
    const drawn = await until(() => { try { const d = JSON.parse(ws().emph_drawings || "{}"); const f = Object.values(d)[0]; return f && f.strokes.length && f; } catch { return null; } });
    if (!drawn.strokes[0].step) throw new Error("the line is not on a step");
    button(/^Close$/) ? q('[aria-label="Close"]').click() : null; await wait(300);
    return "line not relevant and back, kept as a business rule (edited) and undone; read back " + counts.replace(/^· /, "") + "; close checks shown; Teams link " + u.searchParams.get("subject") + "; a line drawn on step " + drawn.strokes[0].step;
  }
  // Requirements: MoSCoW stores Microsoft's priority; Gap waits for a gap solution approach
  async function fitGap() {
    await nav("requirements");
    const r = rows("emph_requirement").find(x => x.emph_description === "Test requirement from the scripted check") || rows("emph_requirement")[0];
    (await until(() => [...document.querySelectorAll('[data-emph="requirements"] tbody tr')].find(t => t.innerText.includes(r.emph_reqid)))).click();
    const ed = await until(() => q('[data-emph="requirement-editor"]'));
    const field = label => [...ed.querySelectorAll("label")].find(x => x.innerText.trim().startsWith(label)).closest(".fui-Field").querySelector('[role="combobox"]');
    await pickOption(field("MoSCoW"), "Should");
    await until(() => r.emph_priority === 582100001);
    const fg = ed.querySelector('[data-emph="fit-gap"]');
    await pickOption(fg.querySelector('[role="combobox"]'), "Gap");
    await until(() => q('[data-emph="needs-approach"]'));
    if (r.emph_fitgapstatus === 582100001) throw new Error("Gap saved without an approach");
    await pickOption(q('[data-emph="fit-gap"]').querySelectorAll('[role="combobox"]')[1], "30 - Power Platform");
    await until(() => r.emph_fitgapstatus === 582100001 && r.emph_gapsolutionapproach === 582100002);
    q('[aria-label="Close"]')?.click(); await wait(300);
    return r.emph_reqid + ": Should = priority 2, Gap held until 30 - Power Platform was picked";
  }
  async function systems() {
    await nav("systems");
    const areas = document.querySelectorAll('[data-emph="systems-area"]').length;
    const target = q('[data-emph="systems-target"]').innerText;
    const n = rows("emph_system").length;
    if (!areas || !n) throw new Error("no systems per area");
    const first = q('[data-emph="systems-area"]');
    const box = first.querySelector('input[placeholder^="A system used today"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(box, "Test planning tool"); box.dispatchEvent(new Event("input", { bubbles: true })); await wait(50);
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const made = await until(() => rows("emph_system").find(x => x.emph_name === "Test planning tool" && x._emph_item_value));
    if (made.emph_decision !== 582100000) throw new Error("new system not Keep");
    return areas + " areas, " + n + " systems, added one (Keep); " + target.replace(/\n/g, " ");
  }
  const setInput = (el, v) => { const input = el.tagName === "INPUT" ? el : el.querySelector("input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, v); input.dispatchEvent(new Event("input", { bubbles: true })); return input; };
  const optionsOf = async combo => {
    combo.click(); await until(() => document.querySelector('[role="option"]'));
    const list = [...document.querySelectorAll('[role="option"]')].map(o => o.innerText.trim());
    combo.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await until(() => !document.querySelector('[role="option"]')); await wait(100);
    return list;
  };
  const raidRow = text => [...document.querySelectorAll('[data-emph="raid-item"]')].find(x => x.innerText.includes(text));
  // RAID page: each type's own fields, filters, open questions, a decision needs its maker; no change request before an approved sign-off
  async function raid() {
    raid.step = 1; await nav("raid");
    raid.step = 2; const addBox = () => q('[data-emph="raid-add"]');
    raid.step = 3; const typeCombo = () => addBox().querySelector('[role="combobox"]');
    raid.step = 4; const offered = await optionsOf(typeCombo());
    raid.step = 5; const approved = rows("emph_signoff").some(s => s.emph_state === 582100002);
    raid.step = 6; if (!approved && offered.includes("Change request")) throw new Error("change request offered before approval");
    raid.step = 7; const add = async (type, text, question) => {
      await pickOption(typeCombo(), type);
      if (question) { addBox().querySelector('input[type="checkbox"]').click(); await wait(100); }
      const input = setInput(q('[data-emph="raid-add-text"]'), text); await wait(50);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return until(() => rows("emph_raid").find(r => r.emph_description === text));
    };
    raid.step = 8; const risk = await add("Risk", "Test risk: supplier data arrives late");
    raid.step = 9; if (risk.emph_raidtype !== 582100000 || risk.emph_status !== 582100000) throw new Error("risk type/status");
    raid.step = 10; (await until(() => raidRow("supplier data arrives late"))).querySelector('[data-emph="raid-open"]').click();
    raid.step = 11; const ed = await until(() => raidRow("supplier data arrives late").querySelector('[data-emph="raid-editor"]'));
    raid.step = 12; const field = label => [...ed.querySelectorAll("label")].find(x => x.innerText.trim().startsWith(label))?.closest(".fui-Field");
    raid.step = 13; if (!field("Risk response") || !field("Contingency plan") || field("Change request type")) throw new Error("risk fields");
    raid.step = 14; await pickOption(field("Risk response").querySelector('[role="combobox"]'), "Mitigate");
    raid.step = 15; await until(() => risk.emph_riskresponse === 582100002);
    raid.step = 16; const qn = await add("Action item", "Test question: who signs off the credit limit?", true);
    raid.step = 17; if (qn.emph_raidtype !== 582100004 || qn.emph_isquestion !== true) throw new Error("open question");
    raid.step = 18; const sw = [...q('[data-emph="raid-filter"]').querySelectorAll('input[role="switch"]')][0]; sw.click(); await wait(300);
    raid.step = 19; const shown = [...document.querySelectorAll('[data-emph="raid-item"]')];
    raid.step = 20; if (!shown.length || shown.some(x => x.dataset.type !== "Action item") || !raidRow("who signs off")) throw new Error("questions filter");
    raid.step = 21; sw.click(); await wait(200);
    raid.step = 22; const dec = await add("Decision", "Test decision: one price list for all regions");
    raid.step = 23; if (dec.emph_status !== 582100003) throw new Error("decision not Proposed");
    raid.step = 24; const statusOf = () => [...raidRow("one price list").firstElementChild.querySelectorAll('[role="combobox"]')].pop(); // the row header, not the editor
    raid.step = 25; await pickOption(statusOf(), "Decided");
    raid.step = 26; await until(() => /needs a decision maker/.test(document.body.innerText));
    raid.step = 27; if (dec.emph_status !== 582100003) throw new Error("decided without a maker");
    raid.step = 28; raidRow("one price list").querySelector('[data-emph="raid-open"]').click();
    raid.step = 29; const ded = await until(() => raidRow("one price list").querySelector('[data-emph="raid-editor"]'));
    raid.step = 30; const maker = [...ded.querySelectorAll("label")].find(x => x.innerText.trim().startsWith("Decision maker")).closest(".fui-Field").querySelector("input");
    raid.step = 31; setInput(maker, "Steering group"); maker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    raid.step = 32; await until(() => dec.emph_decisionmaker === "Steering group");
    raid.step = 33; await pickOption(statusOf(), "Decided");
    raid.step = 34; await until(() => dec.emph_status === 582100004);
    raid.step = 35; return "risk with Risk response Mitigate, an open question (filter shows action items only), a decision Decided once it had a maker; change request " + (approved ? "offered" : "not offered before approval");
  }
  // History page: restore the last scope change of the renamed process; the restore is a new history row (how Restore)
  async function history() {
    await nav("history");
    const row = rows("emph_processitem").find(r => r.emph_name === "Our own name for it");
    if (!row) throw new Error("run mainMap first");
    const before = rows("emph_history").length, was = row.emph_scope;
    const line = await until(() => [...document.querySelectorAll('[data-emph="history-row"]')].find(t => t.innerText.includes("Our own name for it") && /\bScope\b/.test(t.innerText)));
    const target = /40 - Not applicable/.test(line.innerText.split("→")[0]) ? 582100003 : null;
    line.querySelector('[data-emph="history-restore"]').click();
    await until(() => rows("emph_history").length === before + 1);
    const h = rows("emph_history")[before];
    if (h.emph_how !== 582100004 || h.emph_field !== "emph_scope" || h.emph_rowid !== row.emph_processitemid) throw new Error("history row " + JSON.stringify(h));
    if (target != null && row.emph_scope !== target) throw new Error("not restored: " + row.emph_scope);
    await until(() => document.querySelectorAll('[data-emph="history-row"]')[0]?.innerText.includes("Restore"));
    return "restored scope " + h.emph_oldvalue + " → " + h.emph_newvalue + " (was " + was + "), written as a new row with how Restore";
  }
  // After approval, a change to what the sign-off froze is raised as a change request
  async function changeRequest() {
    await nav("signoff");
    const tr = await until(() => [...document.querySelectorAll("tbody tr")].find(t => /v1/.test(t.innerText)));
    tr.click();
    (await until(() => button(/^Approve$/))).click();
    await until(() => rows("emph_signoff")[0].emph_state === 582100002);
    (await until(() => button(/^Compare with today$/))).click();
    const raise = await until(() => q('[data-emph="raise-cr"]'), 8000);
    const n = rows("emph_raid").length;
    raise.click();
    const cr = await until(() => rows("emph_raid").length === n + 1 && rows("emph_raid")[n]);
    if (cr.emph_raidtype !== 582100005 || cr.emph_status !== 582100003 || cr._emph_signoff_value !== rows("emph_signoff")[0].emph_signoffid || !cr.emph_frozenkey || !cr.emph_justification) throw new Error("change request " + JSON.stringify(cr));
    await nav("raid");
    const offered = await optionsOf(q('[data-emph="raid-add"] [role="combobox"]'));
    if (!offered.includes("Change request")) throw new Error("change request not offered after approval");
    return "approved v1; raised “" + cr.emph_name + "” (" + cr.emph_justification.split("\n")[0] + "); offered on the RAID page";
  }
  // Licences per role: a suggestion from the scenarios, applied; the summary per type; a dated price row
  async function licences() {
    await nav("settings");
    const apply = await until(() => q('[data-emph="role-licence-apply"]'));
    const name = apply.closest('[data-emph="role-row"]').querySelector("input").value;
    const role = rows("emph_role").find(r => r.emph_name === name);
    const text = apply.closest('[data-emph="role-licence-suggest"]').innerText;
    apply.click();
    await until(() => /Suggested from the scenarios/.test(role.emph_licencenote || ""));
    const summary = q('[data-emph="licence-summary"]').innerText;
    if (!/Full: \d+/.test(summary)) throw new Error("summary: " + summary);
    q('[data-emph="price-add"]').click();
    const ws = rows("emph_workspace")[0];
    await until(() => JSON.parse(ws.emph_settings || "{}").prices?.length === 1);
    return name + ": " + text.replace(/\s*Use it$/, "").slice(0, 120) + "; summary " + summary.replace(/\s+/g, " ").slice(0, 100) + "; price row added";
  }
  // Azure Boards import file: Microsoft's work item types and fields, at most 1,000 rows per file
  async function boards() {
    await nav("signoff");
    const files = [], real = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = b => { files.push(b); return "blob:test"; };
    HTMLAnchorElement.prototype.click = function () {};
    try { q('[data-emph="boards-export"]').click(); await wait(200); } finally { URL.createObjectURL = real; HTMLAnchorElement.prototype.click = click; }
    if (!files.length) throw new Error("no file");
    const texts = await Promise.all(files.map(b => b.text())); // text() drops the byte order mark, so read it from the bytes
    const bom = [...new Uint8Array(await files[0].slice(0, 3).arrayBuffer())].join(",") === "239,187,191";
    const lines = texts.map(t => t.split("\r\n").filter(Boolean));
    if (!bom || !texts[0].startsWith("\"ID\",\"Work Item Type\",\"Title 1\",\"Title 2\"") || lines.some(l => l.length - 1 > 1000)) throw new Error("format");
    const all = texts.join("\n");
    for (const t of ['"End to end"', '"Process area"', '"Process"', '"Scenario"', '"Requirement"', '"Risk"', '"Action item"', '"Change request"', '"20 - In scope"']) if (!all.includes(t)) throw new Error("missing " + t);
    return files.length + " file(s), " + lines.reduce((s, l) => s + l.length - 1, 0) + " work items";
  }
  // ---------- slice 3: workshops like Microsoft (made-up content; the default demo has 80 Project to profit in scope) ----------
  const session = w => JSON.parse(w.emph_sessiondata || "{}");
  const lastWorkshop = () => rows("emph_workshop")[rows("emph_workshop").length - 1];
  async function newWorkshop(kind, e2eCode = "80") {
    await nav("workshops");
    if (!q('[data-emph="workshop-new"]')) { button(/All workshops/).click(); await wait(250); }
    await pickOption(q('[data-emph="workshop-kind"] [role="combobox"]'), kind);
    const e2e = q('[data-emph="workshop-kind"]').parentElement.querySelectorAll('[role="combobox"]')[1];
    e2e.click();
    (await until(() => [...document.querySelectorAll('[role="option"]')].find(x => x.innerText.trim().startsWith(e2eCode + " ")))).click(); await wait(200);
    const before = rows("emph_workshop").length;
    q('[data-emph="workshop-new"]').click();
    await until(() => rows("emph_workshop").length === before + 1 && q('[data-emph="phases"]'));
    return lastWorkshop();
  }
  const toStep = async i => { [...document.querySelectorAll('[data-emph="phases"] button')][i].click(); await wait(250); };
  const lineWith = async tool => { // walks the agenda with Next until the line opens the tool
    for (let i = 0; i < 12; i++) { if (q('[data-emph="' + tool + '"]')) return; q('[data-emph="agenda-nav-top"] [data-emph="agenda-next"]').click(); await wait(250); }
    throw new Error("no line opens " + tool);
  };

  // A scenario board workshop from Microsoft's template: type and phase set, child tasks, overview without cards, key scenarios with cards, scope proposals grey an area
  async function board() {
    const ws = await newWorkshop("Scenario board discovery");
    if (ws.emph_microsoftworkshoptype !== 582100000 || ws.emph_sbdphase !== 582100000 || !/^80\./.test(ws.emph_units ? ws.emph_units + "." : "")) throw new Error("type/phase/unit " + ws.emph_microsoftworkshoptype + "/" + ws.emph_sbdphase + "/" + ws.emph_units);
    const tasks = JSON.parse(ws.emph_childtasks);
    if (tasks.length !== 3 || !/^80\.01\.001 /.test(tasks[0].id + " ") || !/project to profit/.test(tasks[0].title)) throw new Error("child tasks " + ws.emph_childtasks);
    if (!q('[data-emph="template-roles"]')) throw new Error("no roles to invite");
    q('[data-emph="prepare-start"]').click(); await wait(300);
    const lines = document.querySelectorAll('[data-emph="agenda-item"]').length;
    if (lines !== session(ws).run.agenda.length || !q('[data-emph="agenda-nav-top"] [data-emph="agenda-next"]') || !q('[data-emph="agenda-nav-bottom"] [data-emph="agenda-prev"]')) throw new Error("agenda and its buttons");
    await lineWith("board");
    if (q('[data-emph="board"]').dataset.view !== "overview" || q('[data-emph="board-card"]')) throw new Error("the overview line shows cards");
    q('[data-emph="agenda-nav-bottom"] [data-emph="agenda-next"]').click(); await wait(300);
    if (session(lastWorkshop()).run.done.length < 2) throw new Error("Next did not tick the lines walked");
    const areas = document.querySelectorAll('[data-emph="board-area"]').length, cards = document.querySelectorAll('[data-emph="board-card"]').length;
    if (!cards) throw new Error("the key-scenarios line shows no cards");
    const card = q('[data-emph="board-card"] [data-emph="card-mark"]');
    card.click(); await wait(250); q('[data-emph="board-card"] [data-emph="card-mark"]').click(); await wait(250);
    const key = q('[data-emph="board-card"]').dataset.key;
    if (session(lastWorkshop()).run.marks[key]?.state !== "strike") throw new Error("card not struck");
    // an area Not applicable is a proposal: greyed and folded, the item itself unchanged until Close
    const col = [...document.querySelectorAll('[data-emph="board-area"]')].find(a => a.querySelector('[data-emph="board-scope"]') && a.dataset.off === "0");
    const id = col.querySelector('[data-emph="board-scope"]').dataset.item, before = rows("emph_processitem").find(r => r.emph_processitemid === id).emph_scope;
    await pickOption(col.querySelector('[data-emph="board-scope"] [role="combobox"]'), "40 - Not applicable");
    const after = [...document.querySelectorAll('[data-emph="board-area"]')].find(a => a.querySelector('[data-emph="board-scope"]')?.dataset.item === id);
    if (after.dataset.off !== "1" || !after.querySelector('[data-emph="board-unfold"]')) throw new Error("area not greyed and folded");
    if (rows("emph_processitem").find(r => r.emph_processitemid === id).emph_scope !== before) throw new Error("the board wrote scope before Close");
    return areas + " areas, " + cards + " cards, " + lines + " agenda lines, card struck, an area proposed Not applicable (greyed, not written)";
  }

  // The storyline review: in-scope processes only, fit per step makes the process a gap, main path, a demo link in the settings
  async function storyline() {
    await newWorkshop("Storyline design review");
    q('[data-emph="prepare-start"]').click(); await wait(300);
    await lineWith("story");
    const procs = [...document.querySelectorAll('[data-emph="story-process"]')];
    if (!procs.length) throw new Error("no processes");
    const withFlow = procs.find(p => !/no flow/.test(p.innerText)) || procs[0];
    const pid = withFlow.dataset.id;
    withFlow.querySelector('[data-emph="story-open"]').click();
    const step = await until(() => q('[data-emph="story-process"][data-id="' + pid + '"] [data-emph="story-step"]'));
    await pickOption(step.querySelector('[data-emph="step-fit"] [role="combobox"]'), "Differs");
    (await until(() => q('[data-emph="story-process"][data-id="' + pid + '"] [data-emph="story-use-steps"]'))).click(); await wait(300);
    const run = session(lastWorkshop()).run;
    if (run.processFit[pid]?.fitGap !== 582100001 || !Object.keys(run.stepFit).length) throw new Error("fit: " + JSON.stringify(run.processFit));
    q('[data-emph="story-process"][data-id="' + pid + '"] input[data-emph="story-main"], [data-emph="story-process"][data-id="' + pid + '"] [data-emph="story-main"] input').click(); await wait(300);
    if (!session(lastWorkshop()).run.mainPath.includes(pid)) throw new Error("main path");
    q('[data-emph="story-process"][data-id="' + pid + '"] [data-emph="demo-link-add"]').click();
    const box = await until(() => q('[data-emph="demo-link-form"] input'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(box, "https://demo.example.test/project"); box.dispatchEvent(new Event("input", { bubbles: true })); await wait(50);
    q('[data-emph="demo-link-save"]').click();
    await until(() => (JSON.parse(rows("emph_workspace")[0].emph_settings || "{}").demoLinks || []).some(d => d.url === "https://demo.example.test/project"));
    await until(() => q('[data-emph="story-process"][data-id="' + pid + '"] [data-emph="demo-open"]'));
    return procs.length + " processes in areas in scope, a step that differs made " + pid.slice(-4) + " a gap, main path, demo link saved";
  }

  // The quick track: five lines, Microsoft's lines back when switched off, scope proposed from today with feedback
  async function quickTrack() {
    const ws = await newWorkshop("Scenario board discovery");
    const ms = session(ws).run.agenda.map(a => a.text).join("|");
    q('input[data-emph="quick-track"], [data-emph="quick-track"] input').click(); await wait(300);
    let run = session(lastWorkshop()).run;
    if (run.track !== "quick" || run.agenda.length !== 5 || run.agenda[3].tool !== "story") throw new Error("quick agenda " + JSON.stringify(run.agenda.map(a => a.tool)));
    q('[data-emph="quick-propose"]').click();
    const note = (await until(() => q('[data-emph="quick-note"]'))).innerText;
    run = session(lastWorkshop()).run;
    q('input[data-emph="quick-track"], [data-emph="quick-track"] input').click(); await wait(300);
    if (session(lastWorkshop()).run.agenda.map(a => a.text).join("|") !== ms) throw new Error("Microsoft's agenda did not come back");
    q('input[data-emph="quick-track"], [data-emph="quick-track"] input').click(); await wait(300);
    return "5 quick lines (fit-to-standard on the storyline tool), " + Object.keys(run.scope).length + " scope proposals: " + note;
  }

  // Close: agreed items only, How Workshop with the workshop's name, history, child tasks ticked, next workshop, undo
  async function close() {
    const ws = await newWorkshop("Scenario board discovery");
    const name = ws.emph_name;
    q('[data-emph="prepare-start"]').click(); await wait(300);
    await lineWith("board"); q('[data-emph="agenda-nav-top"] [data-emph="agenda-next"]').click(); await wait(300);
    const linked = [...document.querySelectorAll('[data-emph="board-card"]')].find(c => c.querySelector('[data-emph="card-links"]') && !/Stands for no process/.test(c.querySelector('[data-emph="card-links"]').innerText));
    if (!linked) throw new Error("no card stands for a process");
    const key = linked.dataset.key;
    linked.querySelector('[data-emph="card-mark"]').click(); await wait(250);
    q('[data-emph="board-card"][data-key="' + key + '"] [data-emph="card-mark"]').click(); await wait(300);
    await toStep(3);
    const items = document.querySelectorAll('[data-emph="conclusion-item"]').length;
    q('[data-emph="agree-rest"]').click();
    await until(() => / 0 open/i.test(q('[data-emph="conclusion-counts"]').innerText));
    await toStep(4);
    if (!document.querySelectorAll('[data-emph="close-changes"] li').length) throw new Error("nothing to write");
    q('input[data-emph="child-task"], [data-emph="child-task"] input').click(); await wait(300);
    const hist = rows("emph_history").length;
    q('[data-emph="workshop-close"]').click();
    await until(() => lastWorkshop().emph_status === 582100001);
    const written = session(lastWorkshop()).run.written || [];
    if (!written.length) throw new Error("Close wrote nothing");
    const row = rows("emph_processitem").find(r => r.emph_processitemid === written[0].itemId);
    if (row.emph_sethow !== 582100000 || row.emph_workshopname !== name || !row.emph_seton) throw new Error("set how " + row.emph_sethow + " " + row.emph_workshopname);
    if (rows("emph_history").length <= hist || !rows("emph_history").slice(hist).every(h => h.emph_workshopname === name)) throw new Error("history");
    if (!JSON.parse(lastWorkshop().emph_childtasks)[0].done) throw new Error("child task not ticked");
    const next = (await until(() => q('[data-emph="next-workshop"]'))).innerText.split("\n")[0];
    const realConfirm = window.confirm; window.confirm = () => true;
    try { q('[data-emph="close-undo"]').click(); await until(() => lastWorkshop().emph_status === 582100000); } finally { window.confirm = realConfirm; }
    const back = rows("emph_processitem").find(r => r.emph_processitemid === written[0].itemId);
    if (back.emph_scope !== written[0].before.scope || back.emph_sethow !== 582100004) throw new Error("undo: " + back.emph_scope + " how " + back.emph_sethow);
    return items + " conclusion items agreed, Close wrote " + written.length + " (" + written.map(x => x.label).join("; ").slice(0, 120) + "), How Workshop, history, child task ticked; next: " + next + "; undo restored";
  }

  // Catalog rules (Peter, 2026-11-21): no duplicate "10 - Unspecified"; areas in and out from a discovery workshop's Prepare;
  // the scenario board offers end-to-end processes not in scope yet; own items follow Microsoft's rules and numbering.
  async function catalogRules() {
    const item = code => rows("emph_processitem").find(x => x.emph_catalogcode === code);
    const options = async combo => { combo.click(); await wait(300); const o = [...document.querySelectorAll('[role="option"]')]; return o; };
    // 1 the scope list has each value once
    await nav("overview");
    const combo = await until(() => q('[data-emph="scope-pick"] [role="combobox"]'));
    const labels = (await options(combo)).map(o => o.innerText.trim());
    document.body.click(); await wait(200);
    if (labels.filter(x => x === "10 - Unspecified").length !== 1) throw new Error("scope options: " + labels.join(", "));
    // 2 a discovery workshop's Prepare lists every area with its scope; an area comes in and goes out there
    await nav("workshops");
    if (!q('[data-emph="workshop-new"]')) { button(/All workshops/)?.click(); await wait(300); }
    q('[data-emph="workshop-new"]').click();
    const areas = await until(() => { const a = document.querySelectorAll('[data-emph="agenda-area"]'); return a.length && a; });
    const off = [...areas].find(a => a.querySelector('[data-emph="scope-pick"]') && /10 - Unspecified|30 - Out of scope/.test(a.querySelector('[data-emph="scope-pick"]').innerText));
    if (!off) throw new Error("no area outside scope listed in Prepare");
    const code = off.dataset.code;
    let o = await options(off.querySelector('[data-emph="scope-pick"] [role="combobox"]'));
    o.find(x => x.innerText.trim() === "20 - In scope").click();
    await until(() => item(code).emph_scope === 582100001);
    const listed = await until(() => { const a = q('[data-emph="agenda-area"][data-code="' + code + '"]'); return a && a.querySelectorAll('input[type="checkbox"]').length > 0 && a; });
    o = await options(listed.querySelector('[data-emph="scope-pick"] [role="combobox"]'));
    o.find(x => x.innerText.trim() === "30 - Out of scope").click();
    await until(() => item(code).emph_scope === 582100002);
    // 3 the scenario board offers an end-to-end process that isn't in scope yet
    button(/All workshops/)?.click(); await wait(300);
    o = await options(q('[data-emph="workshop-kind"] [role="combobox"]') || q('[data-emph="workshop-kind"]'));
    o.find(x => /^Scenario board/.test(x.innerText.trim())).click(); await wait(300);
    const e2eCombo = [...document.querySelectorAll('[role="combobox"]')].find(c => /end-to-end|All in scope/i.test(c.innerText || c.value || c.placeholder || ""));
    o = await options(e2eCombo);
    const notYet = o.filter(x => /not in scope yet/.test(x.innerText)).length;
    document.body.click(); await wait(200);
    if (!notYet) throw new Error("board offers only end-to-end processes in scope");
    // 4 own items: no own end-to-end; an own area needs Microsoft's approval and is numbered under its end-to-end process
    await nav("processes");
    if (!q('[data-emph="own-e2e-rule"]')) throw new Error("own end-to-end still offered");
    const tree = q('[data-emph="process-tree"]');
    [...tree.querySelectorAll("div")].find(d => /^20\s*Case to resolution$/.test(d.innerText.trim())).click(); await wait(400);
    (await until(() => q('[data-emph="own-item-open"]'))).click();
    const form = await until(() => q('[data-emph="own-item"]'));
    const [nameBox, reasonBox] = form.querySelectorAll("input");
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
    set(nameBox, "Our test area"); await wait(100);
    const add = [...form.querySelectorAll("button")].find(b => b.innerText.trim() === "Add");
    if (!add.disabled) throw new Error("own area added without Microsoft's approval");
    set(reasonBox, "Approved by Microsoft BPE (made-up test)"); await wait(100);
    add.click();
    const own = await until(() => rows("emph_processitem").find(x => x.emph_name === "Our test area"));
    if (!/^20\.9\d$/.test(own.emph_catalogcode) || !/Microsoft's approval: Approved/.test(own.emph_summary || "")) throw new Error("own area: " + own.emph_catalogcode + " / " + own.emph_summary);
    return "scope list without duplicate; area " + code + " in and out from Prepare; board offers " + notYet + " not in scope yet; own area " + own.emph_catalogcode + " with approval, no own end-to-end";
  }
  const ALL = { pages, mainMap, processAndFlow, guide, capture, fitGap, signOff, workshop, transcript, review, systems, raid, history, changeRequest, licences, boards, board, storyline, quickTrack, close, catalogRules };
  window.__tests = {
    ...ALL,
    async all() { const r = {}; for (const [k, f] of Object.entries(ALL)) { try { r[k] = await f(); } catch (e) { r[k] = "FAIL " + (f.step ? "at step " + f.step + ": " : "") + e.message; } } return r; },
  };
})();
