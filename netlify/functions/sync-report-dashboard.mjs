import { getStore } from "@netlify/blobs";
import { mirrorReport, readStoredReport, referencePattern, reportStoreName } from "../dashboard-reports.mjs";

export const config = { schedule: "*/2 * * * *" };

export default async function syncReportDashboard(request, context) {
  if (context.deploy?.context !== "production") return new Response(null, { status: 204 });
  const store = getStore({ name: reportStoreName, consistency: "strong" });
  const deadline = Date.now() + 18_000;
  for await (const { blobs } of store.list({ paginate: true })) {
    const references = blobs.filter(({ key }) => key.endsWith(".zip"))
      .map(({ key }) => key.slice(0, -4)).filter((reference) => referencePattern.test(reference));
    for (let index = 0; index < references.length; index += 5) {
      if (Date.now() >= deadline) return new Response(null, { status: 204 });
      const results = await Promise.allSettled(references.slice(index, index + 5)
        .map((reference) => mirrorReport(reference, () => readStoredReport(store, reference))));
      for (const result of results) {
        if (result.status === "rejected") console.error("Could not sync a report to Netlify Forms");
      }
    }
  }
  return new Response(null, { status: 204 });
}
