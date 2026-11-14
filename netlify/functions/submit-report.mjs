import { getStore } from "@netlify/blobs";
import { strToU8, zipSync } from "fflate";

const storeName = "private-incident-reports";
const maxEvidenceBytes = 4_000_000;
const referencePattern = /^RFA-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const consents = ["accuracy", "review", "contact_consent", "guidelines_agreement"];

function respond(status, data) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function evidenceExtension(bytes) {
  const startsWith = (signature, offset = 0) =>
    signature.every((byte, index) => bytes[index + offset] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(strToU8("RIFF")) && startsWith(strToU8("WEBP"), 8)) return "webp";
  if (startsWith(strToU8("%PDF-"))) return "pdf";
  return null;
}

export default async function submitReport(request, context) {
  if (request.method !== "POST") return respond(405, { error: "Use POST to submit a report." });
  if (context.deploy?.context && context.deploy.context !== "production") {
    return respond(403, { error: "Submit reports on the live site." });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return respond(403, { error: "Submit reports from the RedFlag Atlas form." });
  }
  if (Number(request.headers.get("content-length")) > 4_100_000) {
    return respond(413, { error: "Attachments must be 4 MB or less combined." });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return respond(400, { error: "The report could not be read. Please try again." });
  }

  const field = (name) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const reference = field("reference");
  const whatsapp = field("whatsapp").replace(/[\s()-]/g, "");
  const description = field("description");
  const category = field("category");
  const platform = field("platform");
  const country = field("country");

  if (!referencePattern.test(reference) || field("website-check")) {
    return respond(400, { error: "The report could not be validated. Reload the form and try again." });
  }
  if (!/^\+[1-9]\d{6,14}$/.test(whatsapp)) {
    return respond(400, { error: "Enter a WhatsApp number with a country code." });
  }
  if (description.length < 20 || description.length > 4000 ||
      !category || category.length > 50 || !platform || platform.length > 50 ||
      !/^[A-Z]{2}$/.test(country) || consents.some((name) => field(name) !== "yes")) {
    return respond(400, { error: "Check the incident details and confirm all consent statements." });
  }

  const files = form.getAll("evidence").filter((entry) =>
    typeof entry !== "string" && (entry.name || entry.size));
  if (files.reduce((total, file) => total + file.size, 0) > maxEvidenceBytes) {
    return respond(413, { error: "Attachments must be 4 MB or less combined." });
  }

  const attachments = {};
  for (const [index, file] of files.entries()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = evidenceExtension(bytes);
    if (!extension) return respond(400, { error: "Evidence must be a valid JPG, PNG, WebP or PDF file." });
    attachments[`evidence-${index + 1}.${extension}`] = bytes;
  }

  const report = {
    reference,
    receivedAt: new Date().toISOString(),
    whatsapp,
    category,
    platform,
    country,
    description,
    reportedAlias: field("reported_alias").slice(0, 100),
    publicHandle: field("public_handle").slice(0, 100),
    city: field("city").slice(0, 100),
    incidentDate: /^\d{4}-\d{2}-\d{2}$/.test(field("incident_date")) ? field("incident_date") : "",
    consent: Object.fromEntries(consents.map((name) => [name, true])),
    attachments: Object.keys(attachments),
  };

  // One conditional write keeps the report and its files together and makes retries safe.
  try {
    const archive = zipSync({ "report.json": strToU8(JSON.stringify(report, null, 2)), ...attachments }, { level: 0 });
    await getStore(storeName).set(`${reference}.zip`, archive, { onlyIfNew: true });
    return respond(201, { reference });
  } catch {
    return respond(503, { error: "The report could not be saved. Please try again." });
  }
}
