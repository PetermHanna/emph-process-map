// EMPH Process Map Guide: page helper (runs in the page itself, not in the extension's isolated world).
// Opens Dynamics 365 pages inside the app with Xrm.Navigation.navigateTo instead of a full page load, so the guide keeps
// running and the browser keeps the presenter's click as permission to speak.
(() => {
  if (window.top !== window || window.__emphNav) return;
  window.__emphNav = true;
  window.addEventListener("message", e => {
    if (e.source !== window || !e.data || e.data.type !== "emph-nav") return;
    const done = (ok, error) => window.postMessage({ type: "emph-nav-done", id: e.data.id, ok, error }, location.origin);
    try {
      if (!window.Xrm || !Xrm.Navigation || !Xrm.Navigation.navigateTo) return done(false, "Xrm not available");
      Xrm.Navigation.navigateTo(e.data.req).then(() => {}, err => done(false, String((err && err.message) || err))); // success is seen in the address bar
    } catch (err) { done(false, String(err)); }
  });
})();
