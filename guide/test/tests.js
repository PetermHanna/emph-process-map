// await __g.run() on main.aspx?f=band | busy | list. Keep the pane visible. Clears the guide's saved state first; a test page only.
// await __g.launch() checks how the Process Map starts a flow: the emph-guide-start event and ?emphguide=<flow id>.
window.__g = (function () {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const root = () => document.getElementById("emph-guide-host").shadowRoot;
  const $ = s => root().querySelector(s);
  const part = n => $('[data-part="' + n + '"]');
  const rect = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const near = (a, b, d = 2) => Math.abs(a - b) <= d;
  const inside = r => r.l >= 0 && r.t >= 0 && r.r <= innerWidth + 1 && r.b <= innerHeight + 1;
  const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const log = [];
  const check = (name, ok, detail) => log.push((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " :: " + JSON.stringify(detail)));
  const state = () => JSON.parse(localStorage.getItem("emphGuideState") || "{}");
  const menu = async id => { $("#more").click(); await w(120); root().querySelector("#menu #" + id).click(); await w(250); };
  const dragEl = async (grip, dx, dy) => {
    const r = grip.getBoundingClientRect(), sx = r.left + r.width / 2, sy = r.top + 10, id = 77;
    const ev = (t, x, y) => grip.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, cancelable: true, pointerId: id, button: 0, buttons: t === "pointerup" ? 0 : 1, clientX: x, clientY: y }));
    ev("pointerdown", sx, sy); await w(30);
    for (let i = 1; i <= 5; i++) { ev("pointermove", sx + dx * i / 5, sy + dy * i / 5); await w(30); }
    ev("pointerup", sx + dx, sy + dy); await w(150);
  };
  async function openFlow() {
    $("#fab").click(); await w(400);
    const pr = $("#proc"); pr.value = "85"; pr.dispatchEvent(new Event("change", { bubbles: true })); await w(150);
    const opt = [...pr.options].find(o => o.value === "85"), btns = [...root().querySelectorAll("[data-flow]")];
    check("process list uses the Process Map's own end-to-end name", !!opt && /Lead to quote/.test(opt.text), opt && opt.text);
    check("our process is listed first, then the reference", btns.length === 2 && /our process/.test(btns[0].innerText) && !/our process/.test(btns[1].innerText), btns.map(b => b.innerText));
    btns[0].click(); await w(500);
    $("#intro-go")?.click(); await w(1500); // the pause at the start of a flow; the card's height is animated
  }
  async function run() {
    log.length = 0;
    const f = new URLSearchParams(location.search).get("f") || "band";
    check("Guide button shows before the guide opens", !!$("#fab") && inside(rect($("#fab"))), $("#fab") && rect($("#fab")));
    check("the page is marked for the Process Map", !!document.documentElement.getAttribute("data-emph-guide"), document.documentElement.getAttribute("data-emph-guide"));
    await openFlow();
    const dock = part("dock");
    check("the flow opens in the window", !!dock && /Capture lead/.test(dock.innerText), dock && dock.innerText.slice(0, 80));
    if (!dock) return log.join("\n");
    const d0 = rect(dock), fe = document.getElementById("field-a"), field = fe && fe.getBoundingClientRect();
    check("window starts inside the screen", inside(d0), d0);
    if (field) check("window leaves the step's control free", !overlap(d0, { l: field.left, t: field.top, r: field.right, b: field.bottom }), { d0, field });
    if (f !== "list") check("window starts bottom right", near(d0.r, innerWidth - 16, 3) && near(d0.b, innerHeight - 16, 3), d0);
    const n0 = window.__writes.length;
    await dragEl(root().querySelector("#drag"), -160, -120);
    const d1 = rect(part("dock"));
    check("window drags", near(d1.l, d0.l - 160, 3) && near(d1.t, d0.t - 120, 3), { d0, d1 });
    check("position is saved", state().pos && state().pos.dock && near(state().pos.dock.x, d1.l, 3), state().pos);
    $("#map").click(); await w(300);
    const strip = part("strip");
    check("flow drawer opens", !!strip && !!strip.querySelector("#dg"), "");
    if (strip && strip.style.visibility !== "hidden") check("flow drawer leaves the window free", !overlap(rect(strip), rect(part("dock"))), { s: rect(strip), d: rect(part("dock")) });
    $("#map").click(); await w(200);
    check("flow drawer closes", !part("strip"), "");
    await menu("tuck");
    check("minimize leaves one chip", !part("dock") && !!$(".chip"), "");
    check("chip says the step", /Guide/.test($(".chip").innerText), $(".chip").innerText);
    const c0 = rect($(".chip"));
    await dragEl(root().querySelector('[data-drag="fab"]'), -70, -90);
    const c1 = rect($(".chip"));
    check("chip drags", near(c1.l, c0.l - 70, 3) && near(c1.t, c0.t - 90, 3), { c0, c1 });
    $("#untuck").click(); await w(250);
    const d2 = rect(part("dock"));
    check("reopening keeps the window where it was", near(d2.l, d1.l, 3) && near(d2.t, d1.t, 3), { d1, d2 });
    await menu("home");
    const h = state(), d3 = rect(part("dock"));
    check("reset position clears saved places", Object.keys(h.pos || {}).length === 0 && !h.tuck, h);
    check("and the window is back in its corner", near(d3.l, d0.l, 3) && near(d3.t, d0.t, 3), { d0, d3 });
    await dragEl(root().querySelector("#drag"), 90000, 90000);
    const far = rect(part("dock"));
    check("the window cannot be lost off the screen", far.l < innerWidth && far.t < innerHeight, far);
    await menu("home");
    check("moving and minimizing writes nothing to Dataverse", window.__writes.length === n0, window.__writes.slice(n0));
    await menu("change");
    check("Choose another flow opens the list with a way back", !!$("#proc") && !!$("#pick-back"), "");
    $("#pick-back").click(); await w(250);
    check("Back returns to the flow", !!part("dock") && /Capture lead/.test(part("dock").innerText), "");
    await menu("exit");
    check("Exit leaves the flow and removes the highlight", !!$("#proc") && !!$("#pick-resume") && !$(".hl"), "");
    $("#pick-resume").click(); await w(500);
    check("Continue the last flow returns to it", /Capture lead/.test((part("dock") || {}).innerText || ""), "");
    await menu("x");
    check("Closing clears this tab's open mark", sessionStorage.getItem("emphGuideOn") === null && !!$("#fab"), sessionStorage.getItem("emphGuideOn"));
    return log.join("\n");
  }
  // The Process Map's "Play in the guide": the event leaves a launch request; a tab opened with ?emphguide=<id> plays that flow.
  async function launch() {
    log.length = 0;
    const q = new URLSearchParams(location.search).get("emphguide");
    if (q) {
      await w(800);
      const intro = root().querySelector("#intro-go")?.closest("[data-part]") || part("dock");
      check("?emphguide opens that flow at its introduction", !!intro && /Identify opportunity/.test(intro.innerText), intro && intro.innerText.slice(0, 80));
      $("#intro-go")?.click(); await w(1500);
      check("and Continue starts at its first step", !!part("dock") && /Capture lead/.test(part("dock").innerText), part("dock") && part("dock").innerText.slice(0, 60));
      return log.join("\n");
    }
    localStorage.removeItem("emphLaunch");
    document.documentElement.setAttribute("data-emph-guide-start", window.__FLOW);
    window.dispatchEvent(new CustomEvent("emph-guide-start", { detail: { flowId: window.__FLOW, code: null } }));
    const l = JSON.parse(localStorage.getItem("emphLaunch") || "null");
    check("emph-guide-start leaves a launch request", !!l && l.flowId === window.__FLOW && Date.now() - l.at < 5000, l);
    window.dispatchEvent(new CustomEvent("emph-guide-start", { detail: { flowId: "not-a-flow" } }));
    check("a bad flow id is ignored", JSON.parse(localStorage.getItem("emphLaunch") || "null").flowId === window.__FLOW, localStorage.getItem("emphLaunch"));
    localStorage.removeItem("emphLaunch");
    return log.join("\n");
  }
  return { run, launch, reset: () => { localStorage.removeItem("emphGuideState"); sessionStorage.clear(); }, part, rect, root };
})();
