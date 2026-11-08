// await __g.run() on each page variant. Keep the pane visible. Clears the guide's saved state first; a test page only.
window.__g = (function () {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const root = () => document.getElementById("emph-guide-host").shadowRoot;
  const $ = s => root().querySelector(s);
  const part = n => $('[data-part="' + n + '"]');
  const rect = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const near = (a, b, d = 2) => Math.abs(a - b) <= d;
  const log = [];
  const check = (name, ok, detail) => log.push((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " :: " + JSON.stringify(detail)));
  const state = () => JSON.parse(localStorage.getItem("emphGuideState") || "{}");
  const dragEl = async (grip, dx, dy) => {
    const r = grip.getBoundingClientRect(), sx = r.left + r.width / 2, sy = r.top + r.height / 2, id = 77;
    const ev = (t, x, y) => grip.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, cancelable: true, pointerId: id, button: 0, buttons: t === "pointerup" ? 0 : 1, clientX: x, clientY: y }));
    ev("pointerdown", sx, sy); await w(30);
    for (let i = 1; i <= 5; i++) { ev("pointermove", sx + dx * i / 5, sy + dy * i / 5); await w(30); }
    ev("pointerup", sx + dx, sy + dy); await w(120);
  };
  const free = () => { const fh = document.querySelector('[data-id="form-header"]'); return fh ? fh.getBoundingClientRect() : null; };
  async function openFlow() {
    $("#fab").click(); await w(300);
    const pr = root().querySelector("#proc"); pr.value = "85"; pr.dispatchEvent(new Event("change", { bubbles: true })); await w(150);
    root().querySelector("[data-flow]").click(); await w(500);
    root().querySelector("#intro-go")?.click(); await w(1500); // the pause at the start of a flow; the card's height is animated
  }
  async function run() {
    log.length = 0;
    const f = new URLSearchParams(location.search).get("f");
    const zone = () => {
      const fa = document.querySelector('[data-id="FormFillBar_Show_Button"]'); const save = document.querySelector('[data-id="header_saveStatus"]'); const hdr = free();
      return fa && { left: save.getBoundingClientRect().right, top: hdr.top, right: fa.getBoundingClientRect().left, bottom: fa.getBoundingClientRect().bottom };
    };
    if (f === "band") {
      const z = zone();
      check("Guide button starts in the band", (() => { const r = rect($("#fab")); return r.l >= z.left && r.r <= z.right && r.t >= z.top - 2 && r.b <= z.bottom + 2; })(), { fab: rect($("#fab")), z });
    }
    if (f === "list") check("list page: Guide button stays in its corner", (() => { const r = rect($("#fab")); return near(r.r, innerWidth - 18) && near(r.b, innerHeight - 18); })(), rect($("#fab")));
    await openFlow();
    const panel = part("panel"), pill = part("pill");
    if (f === "band") {
      const z = zone(), p = rect(panel), l = rect(pill);
      check("card sits in the band", p.l >= z.left && p.r <= z.right + 1 && p.t >= z.top - 2 && p.b <= z.bottom + 2, { p, z });
      check("pill sits in the band, beside the card", l.l >= z.left && l.r <= p.l + 1 && l.t >= z.top - 2 && l.b <= z.bottom + 2, { l, p, z });
      const fa = document.querySelector('[data-id="FormFillBar_Show_Button"]').getBoundingClientRect();
      check("Form assist stays uncovered", p.r <= fa.left && l.r <= fa.left, { p, fa });
      check("card keeps the header band only", p.h <= (z.bottom - z.top) + 2, p);
      check("band is measured from the form's own tabs", parseFloat(panel.style.getPropertyValue("--dockh")) <= (z.bottom - z.top) + 2 && l.l < 1000, { dockh: panel.style.getPropertyValue("--dockh"), l });
      panel.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      check("docked card can open downwards on hover", /docked/.test(panel.className) && parseFloat(panel.style.getPropertyValue("--openh")) > 300, panel.style.getPropertyValue("--openh"));
    }
    if (f === "busy") {
      const tabs = [...document.querySelectorAll('[data-id^="outerHeaderContainer"] [role=tab]')].pop().getBoundingClientRect(), l = rect(pill), p = rect(panel), bar = document.querySelector('[data-id*="ProcessBreadCrumb"]').getBoundingClientRect(), row = document.querySelector("[role=tablist]").getBoundingClientRect();
      check("busy form: pill sits in the tab row", l.l >= tabs.right && l.t >= row.top - 2 && l.t < row.bottom, { l, tabs, row });
      check("busy form: header fields and process bar uncovered", l.t >= bar.bottom && p.t >= bar.bottom, { l, p, bar });
      check("busy form: card sits below the tab row", p.t >= row.bottom, { p, row });
    }
    if (f === "list") {
      const p = rect(panel), l = rect(pill);
      check("list page: card and pill use their corners", near(p.l, Math.max(10, innerWidth - 320)) && near(p.t, 104) && near(l.b, innerHeight - 18), { p, l });
    }
    const n0 = window.__writes.length;
    const p0 = rect(panel);
    await dragEl(root().querySelector("#drag"), -160, 200);
    const p1 = rect(part("panel"));
    check("card drags", near(p1.l, p0.l - 160, 3) && near(p1.t, p0.t + 200, 3), { p0, p1 });
    check("position is saved", state().pos && state().pos.panel && near(state().pos.panel.x, p1.l, 3), state().pos);
    const l0 = rect(part("pill"));
    const up = v => (f === "list" ? -v : v); // on a list page the pill and chip start at the bottom edge
    await dragEl(root().querySelector('[data-drag="pill"]'), -150, up(260));
    const l1 = rect(part("pill"));
    check("pill drags", near(l1.l, l0.l - 150, 3) && near(l1.t, l0.t + up(260), 3), { l0, l1 });
    root().querySelector("#map").click(); await w(250);
    const s0 = rect(part("strip"));
    check("flow strip opens with a grip", !!root().querySelector('[data-drag="strip"]'), "");
    if (f === "band") { const z = zone(); check("flow strip starts in the band and stays readable", s0.t >= z.top - 2 && s0.t < z.bottom && s0.l >= z.left && s0.h >= 100, { s0, z }); }
    await dragEl(root().querySelector('[data-drag="strip"]'), 40, 240);
    const s1 = rect(part("strip"));
    check("flow strip drags", near(s1.l, s0.l + 40, 3) && near(s1.t, s0.t + 240, 3), { s0, s1 });
    root().querySelector("#map2").click(); await w(200);
    check("flow strip minimizes", !part("strip"), "");
    root().querySelector("#map").click(); await w(200);
    const s2 = rect(part("strip"));
    check("flow strip comes back where it was", near(s2.l, s1.l, 3) && near(s2.t, s1.t, 3), { s1, s2 });
    root().querySelector("#pillmin").click(); await w(200);
    const l2 = rect(part("pill"));
    check("pill minimizes", !root().querySelector("#run") && l2.w < 160, l2);
    root().querySelector("#pillopen").click(); await w(200);
    check("pill reopens", !!root().querySelector("#run"), "");
    root().querySelector("#min").click(); await w(200);
    check("card collapses to its title", !root().querySelector(".panel .body") && rect(part("panel")).h < 60, rect(part("panel")));
    root().querySelector("#min").click(); await w(200);
    const beforeTuck = rect(part("panel"));
    root().querySelector(".pill #tuck").click(); await w(250); // the pill's copy: the card has the same button
    check("minimize all leaves one chip", !part("panel") && !part("pill") && !part("strip") && !!$(".chip"), "");
    check("chip says the step", /Guide/.test($(".chip").innerText), $(".chip").innerText);
    const c0 = rect($(".chip"));
    await dragEl(root().querySelector('[data-drag="fab"]'), -70, up(90));
    const c1 = rect($(".chip"));
    check("chip drags", near(c1.l, c0.l - 70, 3) && near(c1.t, c0.t + up(90), 3), { c0, c1 });
    $("#untuck").click(); await w(250);
    const after = rect(part("panel"));
    check("reopening restores the parts", near(after.l, beforeTuck.l, 3) && near(after.t, beforeTuck.t, 3) && !!part("pill"), { beforeTuck, after });
    root().querySelector(".pill #home").click(); await w(250);
    const h = state();
    check("default-place button clears positions", Object.keys(h.pos || {}).length === 0 && Object.keys(h.mins || {}).length === 0 && !h.tuck, h);
    if (f === "band") { const z = zone(), p = rect(part("panel")); check("and the card is back in the band", p.l >= z.left && p.r <= z.right + 1 && p.t >= z.top - 2, { p, z }); }
    await dragEl(root().querySelector("#drag"), 90000, 90000);
    const far = rect(part("panel"));
    check("a part cannot be lost off the window", far.l < innerWidth && far.t < innerHeight, far);
    root().querySelector(".panel #home").click(); await w(200);
    check("the card's own default-place button works too", !Object.keys(state().pos || {}).length, state().pos);
    root().querySelector(".panel #tuck").click(); await w(200);
    check("the card's own minimize button works too", !!$(".chip"), "");
    $("#untuck").click(); await w(200);
    check("moving and minimizing writes nothing to Dataverse", window.__writes.length === n0, window.__writes.slice(n0));
    root().querySelector(".panel #change2").click(); await w(250);
    check("Flows opens the list with a way back", !!$("#proc") && !!$("#pick-back"), "");
    $("#pick-back").click(); await w(200);
    check("Back returns to the flow", !!root().querySelector(".panel #exit"), "");
    root().querySelector(".pill #exit").click(); await w(300);
    check("Exit leaves the flow and removes the highlight", !part("pill") && !$(".hl") && !!$("#proc") && !!$("#pick-resume"), "");
    $("#pick-resume").click(); await w(400);
    check("Continue the last flow returns to it", !!part("pill"), "");
    const q = $(".panel #x"); q.click(); await w(150);
    check("Closing clears this tab's open mark", sessionStorage.getItem("emphGuideOn") === null && !!$("#fab"), sessionStorage.getItem("emphGuideOn"));
    return log.join("\n");
  }
  return { run, reset: () => { localStorage.removeItem("emphGuideState"); localStorage.removeItem("__before"); }, part, rect, root };
})();
