import { getStore } from "@netlify/blobs";
import { unzipSync } from "fflate";
import { mirrorReport, readStoredReport, referencePattern, reportStoreName } from "../dashboard-reports.mjs";

export const config = { schedule: "*/2 * * * *" };

const evidenceFilename = /^evidence-[1-9]\d*\.(jpg|png|webp|pdf)$/;

async function copyEvidence(store, evidence, completed, reference) {
  if (await completed.getMetadata(reference)) return;
  const archive = await store.get(`${reference}.zip`, { type: "arrayBuffer" });
  if (!archive) return;
  const files = unzipSync(new Uint8Array(archive), { filter: ({ name }) => evidenceFilename.test(name) });
  for (const [name, bytes] of Object.entries(files)) {
    await evidence.set(`${reference}_${name}`, bytes, { onlyIfNew: true });
  }
  await completed.set(reference, "done", { onlyIfNew: true });
}

export default async function syncReportDashboard(request, context) {
  if (context.deploy?.context !== "production") return new Response(null, { status: 204 });
  const store = getStore({ name: reportStoreName, consistency: "strong" });
  const evidence = getStore("private-report-evidence");
  const completed = getStore({ name: "report-evidence-copies", consistency: "strong" });
  const deadline = Date.now() + 18_000;
  for await (const { blobs } of store.list({ paginate: true })) {
    const references = blobs.filter(({ key }) => key.endsWith(".zip"))
      .map(({ key }) => key.slice(0, -4)).filter((reference) => referencePattern.test(reference));
    for (let index = 0; index < references.length; index += 5) {
      if (Date.now() >= deadline) return new Response(null, { status: 204 });
      const results = await Promise.allSettled(references.slice(index, index + 5)
        .flatMap((reference) => [
          mirrorReport(reference, () => readStoredReport(store, reference)),
          copyEvidence(store, evidence, completed, reference),
        ]));
      for (const result of results) {
        if (result.status === "rejected") console.error("Could not sync a report or its evidence to the Netlify dashboard");
      }
    }
  }
  return new Response(null, { status: 204 });
}
