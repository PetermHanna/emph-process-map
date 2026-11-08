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
    [...document.querySelectorAll('[data-emph="process-tree"] div')].find(d => d.innerText.trim() === "Deliver and invoice projects").click(); await wait(200);
    (await until(() => [...document.querySelectorAll('[data-emph="process-node"]')].find(d => /Invoice a project/.test(d.innerText)))).click();
    await until(() => q('[data-emph="process-panel"]'));
    q('[data-emph="open-flow"]').click();
    (await until(() => q('[data-emph="flow-adapt"]'))).click();
    await until(() => rows("emph_processflow").length === 2);
    await until(() => q('[data-emph="flow-confirm"]'));
    const acts = rows("emph_flowactivity").filter(a => a._emph_processflow_value === rows("emph_processflow")[1].emph_processflowid).length;
    q('[data-emph="flow-confirm"]').click(); await wait(500);
    const state = rows("emph_processflow")[1].emph_state;
    return "copied " + acts + " activities, state " + state;
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
  window.__tests = {
    pages, processAndFlow, capture, signOff, workshop,
    async all() { const r = {}; for (const [k, f] of Object.entries({ pages, processAndFlow, capture, signOff, workshop })) { try { r[k] = await f(); } catch (e) { r[k] = "FAIL " + e.message; } } return r; },
  };
})();
