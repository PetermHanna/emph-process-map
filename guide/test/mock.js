// Stands in for the Dataverse Web API. Records every write, so the tests can prove nothing was saved by moving the guide.
(function () {
  localStorage.setItem("emphMute", "1");
  const FLOW = "11111111-1111-4111-8111-111111111111", OURS = "33333333-3333-4333-8333-333333333333";
  const page = location.pathname + location.search;
  const step = (code, name, type, func, next, order, extra) => ({ emph_flowactivityid: "22222222-2222-4222-8222-22222222" + String(order).padStart(4, "0"), emph_activitycode: code, emph_name: name, emph_shape: type, emph_lane: func, emph_links: JSON.stringify(next), emph_rank: order, emph_delta: 582100000, emph_summary: "", emph_screenpath: "", emph_screentarget: "", emph_instruction: "", emph_narration: "", emph_completion: "", emph_nextaction: "", emph_samplevalue: "", ...extra });
  const steps = [
    step("P100", "Start", 582100000, "Sales Rep", [{ to: "P200", label: "" }], 0),
    step("P200", "Capture lead", 582100001, "Sales Rep", [{ to: "P300", label: "" }], 10, { emph_screentarget: "#field-a", emph_instruction: "Type the topic of the lead.", emph_narration: "Start topics with DEMO\nDemo records stay apart\nA third key point to make the card long\nA fourth key point" }),
    step("P300", "Qualify lead", 582100001, "Sales Manager", [{ to: "P400", label: "" }], 20, { emph_screentarget: "#go", emph_instruction: "Press the button.", emph_narration: "Second step" }),
    step("P400", "Approved?", 582100002, "Sales Manager", [{ to: "P500", label: "Yes" }, { to: "P600", label: "No" }], 30),
    step("P500", "Create opportunity", 582100001, "Project Manager", [{ to: "P700", label: "" }], 40),
    step("P600", "Disqualify", 582100001, "Sales Rep", [{ to: "P700", label: "" }], 50),
    step("P700", "End", 582100003, "Sales Rep", [], 60),
  ];
  const json = o => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
  window.__writes = [];
  const real = window.fetch.bind(window);
  window.fetch = async (u, opt = {}) => {
    const s = String(u);
    if (!s.startsWith("/api/data/")) return real(u, opt);
    if ((opt.method || "GET") !== "GET") { window.__writes.push([opt.method, s]); return new Response(null, { status: 204 }); }
    if (s.includes("emph_flowactivities")) return json({ value: steps });
    if (/emph_processflows\(/.test(s)) return json({ emph_processflowid: FLOW, emph_name: "85.45.100 Identify opportunity", emph_catalogcode: "85.45.100", emph_flowtype: 582100000 });
    if (s.includes("emph_processflows")) return json({ value: [
      { emph_processflowid: FLOW, emph_name: "85.45.100 Identify opportunity", emph_catalogcode: "85.45.100", emph_flowtype: 582100000 },
      { emph_processflowid: OURS, emph_name: "85.45.100 Identify opportunity: our process", emph_catalogcode: "85.45.100", emph_flowtype: 582100001 }] });
    if (s.includes("emph_endtoendprocesses")) return json({ value: [{ emph_catalogcode: "85", emph_name: "Lead to quote" }] });
    return json({ value: [] });
  };
  window.__FLOW = FLOW;
})();
