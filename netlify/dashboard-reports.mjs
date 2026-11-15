import { getStore } from "@netlify/blobs";
import { strFromU8, unzipSync } from "fflate";

export const reportStoreName = "private-incident-reports";
export const referencePattern = /^RFA-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const productionSite = "https://redflag-atlas.netlify.app";
const dashboardStoreName = "report-dashboard-deliveries";

export async function mirrorReport(reference, loadReport) {
  const deliveries = getStore({ name: dashboardStoreName, consistency: "strong" });
  const delivery = await deliveries.getWithMetadata(reference, { type: "json" });
  if (delivery?.data.sent || delivery?.data.retryAfter > Date.now()) return;

  const lease = await deliveries.setJSON(reference, { retryAfter: Date.now() + 60_000 },
    delivery ? { onlyIfMatch: delivery.etag } : { onlyIfNew: true });
  if (!lease.modified) return;

  const report = await loadReport();
  const evidenceLink = new URL("/admin/reports", productionSite);
  evidenceLink.searchParams.set("ref", reference);
  const evidenceCount = report.attachments?.length ?? 0;
  const body = new URLSearchParams({
    "form-name": "redflag-reports",
    reference,
    description: report.description,
    received_utc: report.receivedAt,
    category: report.category,
    platform: report.platform,
    country: report.country,
    city: report.city ?? "",
    incident_date: report.incidentDate ?? "",
    reported_alias: report.reportedAlias ?? "",
    public_handle: report.publicHandle ?? "",
    whatsapp: report.whatsapp ?? "",
    evidence_count: String(evidenceCount),
    private_evidence: evidenceCount ? evidenceLink.href : "",
  });
  const response = await fetch(new URL("/report-inbox.html", productionSite), {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Netlify Forms returned ${response.status}`);
  await deliveries.setJSON(reference, { sent: true }, { onlyIfMatch: lease.etag });
}

export async function readStoredReport(store, reference) {
  const blob = await store.get(`${reference}.zip`, { type: "arrayBuffer" });
  if (!blob) throw new Error("Report archive missing");
  const entries = unzipSync(new Uint8Array(blob), { filter: ({ name }) => name === "report.json" });
  return JSON.parse(strFromU8(entries["report.json"]));
}
