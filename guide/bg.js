// Background worker: makes the Dataverse calls the guide needs on Finance and Supply Chain pages, where the page itself
// cannot call another site. Only the Process Map guide tables are allowed, with the user's own Dynamics sign-in.
const ALLOWED = /^(emph_processflows|emph_flowactivities|RetrieveFinanceAndOperationsIntegrationDetails)\b/;
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "emph-api") return false;
  (async () => {
    try {
      const org = new URL(msg.org);
      if (org.protocol !== "https:" || !/\.dynamics\.com$/i.test(org.hostname) || /\.operations\./i.test(org.hostname)) throw new Error("Not a Dataverse address");
      if (!ALLOWED.test(msg.path || "")) throw new Error("Not a guide table");
      if (!["GET", "PATCH"].includes(msg.method)) throw new Error("Method not allowed");
      const r = await fetch(org.origin + "/api/data/v9.2/" + msg.path, {
        method: msg.method, credentials: "include", body: msg.method === "PATCH" ? msg.body : undefined,
        headers: { Accept: "application/json", "Content-Type": "application/json", "OData-Version": "4.0", "OData-MaxVersion": "4.0" } });
      if (r.status === 401 || r.status === 403 || r.redirected) throw new Error("Not signed in to Dataverse from here: open the Process Map once in this browser");
      if (!r.ok) throw new Error((await r.text()).slice(0, 200));
      reply({ ok: true, data: r.status === 204 ? null : await r.json() });
    } catch (e) { reply({ ok: false, error: String(e.message || e) }); }
  })();
  return true;
});
