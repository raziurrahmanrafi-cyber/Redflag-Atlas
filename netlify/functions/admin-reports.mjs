import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { strFromU8, unzipSync } from "fflate";

export const config = { path: ["/admin/reports", "/api/published-reports"] };

const referencePattern = /^RFA-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const attachmentPattern = /^evidence-[1-9]\d*\.(jpg|png|webp|pdf)$/;
const mimeTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; sandbox allow-same-origin allow-downloads allow-forms",
};
const route = "/admin/reports";
const publishedStore = "published-incident-reports";

const digest = (value) => createHash("sha256").update(value).digest();
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function page(title, content, status = 200, extraHeaders = {}) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} · RedFlag Atlas</title>
<style>
body{font:1rem/1.55 system-ui,sans-serif;color:#182335;background:#f3f5f9;margin:0}
main{max-width:50rem;margin:auto;padding:1.25rem}
section{background:white;border:1px solid #dde2ec;border-radius:.8rem;padding:1rem;margin:1rem 0}
label{display:block;font-weight:700}input,textarea,button{font:inherit;padding:.65rem;border:1px solid #9ca7b8;border-radius:.35rem}input:not([type=checkbox]),textarea{box-sizing:border-box;width:100%;margin:.25rem 0 .85rem}textarea{resize:vertical}button{background:#174591;color:white;cursor:pointer}h1,h2,p{margin-top:0}a{color:#174591;overflow-wrap:anywhere}li{margin:.4rem 0}
dt{font-weight:700}dd{margin:0 0 .65rem;overflow-wrap:anywhere}
.description{white-space:pre-wrap;overflow-wrap:anywhere}img{display:block;max-width:100%;max-height:26rem;margin:.6rem 0 1rem}
</style><main><p>RedFlag Atlas · Private admin inbox</p><h1>${escape(title)}</h1>${content}</main></html>`,
  { status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", ...extraHeaders } });
}

function detail(report, reference, files, published, draft = {}, error = "") {
  const fields = {
    "Reference": reference, "Received (UTC)": report.receivedAt, "WhatsApp": report.whatsapp,
    "Category": report.category, "Platform": report.platform, "Country": report.country,
    "City": report.city, "Incident date": report.incidentDate,
    "Reported name or alias": report.reportedAlias, "Reported profile handle": report.publicHandle,
  };
  const rows = Object.entries(fields).filter(([, value]) => value)
    .map(([label, value]) => `<dt>${label}</dt><dd>${escape(value)}</dd>`).join("");
  const evidence = files.map((name) => {
    const url = `${route}?ref=${encodeURIComponent(reference)}&amp;file=${encodeURIComponent(name)}`;
    const img = name.endsWith(".pdf") ? "" : `<img loading="lazy" src="${url}" alt="${escape(name)}">`;
    return `<li><a href="${url}">${escape(name)}${name.endsWith(".pdf") ? " (download PDF)" : ""}</a>${img}</li>`;
  }).join("");
  const publication = published
    ? `<p><strong>Published.</strong> <a href="/explore.html">View public reports</a>.</p>`
    : `<form method="post" action="${route}?ref=${encodeURIComponent(reference)}">
      <input type="hidden" name="action" value="publish">
      ${error ? `<p role="alert">${escape(error)}</p>` : ""}
      <label for="public-title">Public title</label>
      <input id="public-title" name="title" value="${escape(draft.title)}" maxlength="100" required>
      <label for="public-summary">Public summary</label>
      <textarea id="public-summary" name="summary" rows="3" minlength="20" maxlength="500" required>${escape(draft.summary)}</textarea>
      <label for="public-description">Public details (optional)</label>
      <textarea id="public-description" name="description" rows="6" maxlength="4000">${escape(draft.description)}</textarea>
      <p><label><input type="checkbox" name="reviewed" value="yes" required> I reviewed this wording and removed private information.</label></p>
      <button type="submit">Publish report</button>
    </form>`;
  return page("Incident report", `<p><a href="${route}">All reports</a></p>
<section><dl>${rows}</dl><h2>What happened</h2><p class="description">${escape(report.description)}</p></section>
<section><h2>Private evidence</h2>${evidence ? `<ul>${evidence}</ul>` : "<p>No evidence attached.</p>"}</section>
<section><h2>Public report</h2><p>The title, summary, optional details, country, category and platform will appear on the public site.</p>${publication}</section>`, error ? 400 : 200);
}

function publicFields({ title, summary, description, country, category, platform, publishedOn }) {
  return { title, summary, description, country, category, platform, publishedOn };
}

async function publicFeed(request) {
  const responseHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { ...responseHeaders, Allow: "GET" } });
  try {
    const store = getStore({ name: publishedStore, consistency: "strong" });
    const reports = [];
    for await (const { blobs } of store.list({ paginate: true })) {
      for (let index = 0; index < blobs.length; index += 20) {
        const batch = await Promise.all(blobs.slice(index, index + 20).map(({ key }) => store.get(key, { type: "json" })));
        reports.push(...batch.filter(Boolean).map(publicFields));
      }
    }
    return Response.json(reports, { headers: responseHeaders });
  } catch {
    return Response.json({ error: "Published reports could not be loaded." }, { status: 503, headers: responseHeaders });
  }
}

export default async function adminReports(request, context) {
  const url = new URL(request.url);
  if (url.pathname === "/api/published-reports") {
    return context.deploy?.context === "production" ? publicFeed(request) : Response.json([]);
  }
  const password = process.env.RFA_ADMIN_PASSWORD;
  if (context.deploy?.context !== "production" || !password || password.length < 24) {
    return page("Admin inbox unavailable", "<p>The admin inbox needs to be configured for production.</p>", 503);
  }

  const sessionAge = 3600;
  const cookie = "rfa_admin_session";
  const signature = (expires) => createHmac("sha256", password)
    .update("redflag-admin:" + expires).digest("hex");
  const same = (a, b) => timingSafeEqual(digest(a), digest(b));
  const redirect = (value, age, target = route) => new Response(null, { status: 303, headers: {
    ...headers, Location: target,
    "Set-Cookie": `${cookie}=${value}; Max-Age=${age}; Path=${route}; HttpOnly; Secure; SameSite=Strict`,
  } });
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("ref");
  const attachment = searchParams.get("file");
  const target = referencePattern.test(reference) ? `${route}?ref=${encodeURIComponent(reference)}` : route;
  const login = (invalid = false) => page("Admin sign in", `<section>
    ${invalid ? '<p role="alert">Username or password is incorrect.</p>' : ""}
    <form method="post" action="${target}">
    <label for="username">Username</label><input id="username" name="username" autocomplete="username" value="admin" required>
    <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button></form></section>`, invalid ? 401 : 200);
  const stored = (request.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(cookie + "="));
  const [expires, token] = (stored?.slice(cookie.length + 1) ?? "").split(".");
  const now = Math.floor(Date.now() / 1000);
  const signedIn = /^\d{10}$/.test(expires) && Number(expires) > now &&
    Number(expires) <= now + sessionAge && token && same(token, signature(expires));

  let publicationForm;
  if (request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) {
      return page("Forbidden", "", 403);
    }
    let form;
    try {
      if (Number(request.headers.get("content-length")) > 60_000) return page("Request too large", "", 413);
      form = await request.formData();
    } catch {
      return login(true);
    }
    const action = form.get("action");
    if (action === "publish") {
      if (!signedIn) return login(true);
      if (!referencePattern.test(reference) || attachment) return page("Report not found", "", 404);
      publicationForm = form;
    } else {
      if (action === "logout") return redirect("", 0);
      const entered = form.get("password");
      if (form.get("username") !== "admin" || typeof entered !== "string" || !same(entered, password)) {
        return login(true);
      }
      const deadline = now + sessionAge;
      return redirect(`${deadline}.${signature(deadline)}`, sessionAge, target);
    }
  }
  if (request.method !== "GET" && !publicationForm) return page("Method not allowed", "", 405, { Allow: "GET, POST" });
  if (!signedIn) return login();

  if ((reference !== null && !referencePattern.test(reference)) ||
      (attachment !== null && (!reference || !attachmentPattern.test(attachment)))) {
    return page("Report not found", "", 404);
  }
  try {
    const store = getStore("private-incident-reports");
    if (!reference) {
      const { blobs } = await store.list();
      const refs = blobs.map(({ key }) => key.endsWith(".zip") ? key.slice(0, -4) : "")
        .filter((key) => referencePattern.test(key));
      const size = 50;
      const last = Math.max(1, Math.ceil(refs.length / size));
      const current = Math.min(last, Math.max(1, Math.floor(Number(searchParams.get("page")) || 1)));
      const links = refs.slice((current - 1) * size, current * size)
        .map((ref) => `<li><a href="${route}?ref=${encodeURIComponent(ref)}">${escape(ref)}</a></li>`).join("");
      const newer = current > 1 ? `<a href="${route}?page=${current - 1}">Previous</a> · ` : "";
      const older = current < last ? ` · <a href="${route}?page=${current + 1}">Next</a>` : "";
      return page("Reports", `<form method="post" action="${route}"><input type="hidden" name="action" value="logout"><button>Sign out</button></form>` + (links ?
        `<section><p>Choose a report by its submission reference.</p><ul>${links}</ul>
<p>${newer}Page ${current} of ${last}${older}</p></section>` : "<p>No reports received yet.</p>"));
    }

    const blob = await store.get(`${reference}.zip`, { type: "arrayBuffer", consistency: "strong" });
    if (!blob) return page("Report not found", "", 404);
    const archive = new Uint8Array(blob);
    const entries = unzipSync(archive, { filter: ({ name }) => name === (attachment ?? "report.json") });
    const entry = entries[attachment ?? "report.json"];
    if (!entry) return page("Report or attachment not found", "", 404);
    if (attachment) {
      const mime = mimeTypes[attachment.split(".").at(-1)];
      return new Response(entry, { headers: {
        ...headers, "Content-Type": mime,
        "Content-Disposition": `${mime === "application/pdf" ? "attachment" : "inline"}; filename="${attachment}"`,
      } });
    }
    const report = JSON.parse(strFromU8(entry));
    const files = (report.attachments ?? []).filter((name) => attachmentPattern.test(name));
    const publications = getStore({ name: publishedStore, consistency: "strong" });
    const published = Boolean(await publications.getMetadata(reference));
    if (!publicationForm || published) return detail(report, reference, files, published);

    const field = (key) => String(publicationForm.get(key) ?? "").trim();
    const draft = { title: field("title"), summary: field("summary"), description: field("description") };
    if (!draft.title || draft.title.length > 100 || draft.summary.length < 20 || draft.summary.length > 500 ||
        draft.description.length > 4000 || field("reviewed") !== "yes") {
      return detail(report, reference, files, false, draft, "Check the title and summary length and confirm your review.");
    }
    const contact = String(report.whatsapp ?? "").replace(/\D/g, "");
    const includesContact = contact.length >= 7 && Object.values(draft).some((value) =>
      value.replace(/[\s()+-]/g, "").includes(contact));
    if (includesContact) {
      return detail(report, reference, files, false, draft, "Remove the submitter’s WhatsApp number from the public text.");
    }
    await publications.setJSON(reference, publicFields({
      ...draft, country: report.country, category: report.category, platform: report.platform,
      publishedOn: new Date().toISOString().slice(0, 10),
    }), { onlyIfNew: true });
    return new Response(null, { status: 303, headers: { ...headers, Location: target } });
  } catch {
    return page("Could not load reports", "<p>Please reload and try again.</p>", 503);
  }
}
