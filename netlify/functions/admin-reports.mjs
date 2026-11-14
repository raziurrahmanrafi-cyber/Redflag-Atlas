import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { strFromU8, unzipSync } from "fflate";

export const config = { path: "/admin/reports" };

const referencePattern = /^RFA-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const attachmentPattern = /^evidence-[1-9]\d*\.(jpg|png|webp|pdf)$/;
const mimeTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; sandbox allow-same-origin allow-downloads",
};
const route = "/admin/reports";

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
h1,h2,p{margin-top:0}a{color:#174591;overflow-wrap:anywhere}li{margin:.4rem 0}
dt{font-weight:700}dd{margin:0 0 .65rem;overflow-wrap:anywhere}
.description{white-space:pre-wrap;overflow-wrap:anywhere}img{display:block;max-width:100%;max-height:26rem;margin:.6rem 0 1rem}
</style><main><p>RedFlag Atlas · Private admin inbox</p><h1>${escape(title)}</h1>${content}</main></html>`,
  { status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", ...extraHeaders } });
}

function detail(report, reference, files) {
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
  return page("Incident report", `<p><a href="${route}">All reports</a></p>
<section><dl>${rows}</dl><h2>What happened</h2><p class="description">${escape(report.description)}</p></section>
<section><h2>Private evidence</h2>${evidence ? `<ul>${evidence}</ul>` : "<p>No evidence attached.</p>"}</section>`);
}

export default async function adminReports(request, context) {
  const password = process.env.RFA_ADMIN_PASSWORD;
  if (context.deploy?.context !== "production" || !password || password.length < 24) {
    return page("Admin inbox unavailable", "<p>The admin inbox needs to be configured for production.</p>", 503);
  }

  const supplied = request.headers.get("authorization") ?? "";
  const expected = "admin:" + password;
  const credentials = supplied.startsWith("Basic ") ? Buffer.from(supplied.slice(6), "base64").toString("utf8") : "";
  if (!timingSafeEqual(digest(credentials), digest(expected))) {
    return page("Sign in", "<p>Enter your RedFlag Atlas admin credentials.</p>", 401,
      { "WWW-Authenticate": 'Basic realm="RedFlag Atlas Admin", charset="UTF-8"' });
  }
  if (request.method !== "GET") return page("Method not allowed", "", 405, { Allow: "GET" });

  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("ref");
  const attachment = searchParams.get("file");
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
      return page("Reports", links ?
        `<section><p>Choose a report by its submission reference.</p><ul>${links}</ul>
<p>${newer}Page ${current} of ${last}${older}</p></section>` : "<p>No reports received yet.</p>");
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
    return detail(report, reference, (report.attachments ?? []).filter((name) => attachmentPattern.test(name)));
  } catch {
    return page("Could not load reports", "<p>Please reload and try again.</p>", 503);
  }
}
