const categories = [
  "Romance scam", "Financial fraud", "Catfishing", "Fake identity",
  "Impersonation", "Harassment", "Blackmail", "Online fraud", "Other",
];
const platforms = [
  "Muzz", "Tinder", "Bumble", "Facebook", "Instagram", "WhatsApp",
  "Telegram", "Snapchat", "Other",
];

async function getJson(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function addOptions(select, entries) {
  for (const [value, label] of entries) select.add(new Option(label, value));
}

function menu() {
  const button = document.querySelector(".menu-button");
  const nav = document.getElementById(button.getAttribute("aria-controls"));
  nav.dataset.ready = "";
  const setOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    nav.toggleAttribute("data-open", open);
  };
  button.addEventListener("click", () => setOpen(!nav.hasAttribute("data-open")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.hasAttribute("data-open")) {
      setOpen(false);
      button.focus();
    }
  });
}

function element(tag, value, className) {
  const item = document.createElement(tag);
  item.textContent = value;
  if (className) item.className = className;
  return item;
}

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

function publicReports(records, countries) {
  if (!Array.isArray(records)) throw new Error("The report feed must contain an array.");
  return records.filter((record) => (
    record && typeof record.title === "string" && record.title.trim()
    && typeof record.summary === "string" && record.summary.trim()
    && Object.hasOwn(countries, record.country)
    && categories.includes(record.category)
    && platforms.includes(record.platform)
    && isDate(record.publishedOn)
  )).sort((first, second) => second.publishedOn.localeCompare(first.publishedOn));
}

function card(report, countries) {
  const item = element("article", "", "card report-card");
  const chips = element("div", "", "chips");
  for (const label of [report.category, countries[report.country], report.platform]) {
    chips.append(element("span", label, "chip"));
  }
  const date = element("time", dateFormat.format(new Date(report.publishedOn)));
  date.dateTime = report.publishedOn;
  const meta = element("p", "Anonymous Community Member · ", "report-meta");
  meta.append(date);
  item.append(chips, element("h3", report.title), meta, element("p", report.summary));
  if (typeof report.description === "string" && report.description.trim()) {
    const details = document.createElement("details");
    details.append(element("summary", "Read full report"), element("p", report.description));
    item.append(details);
  }
  return item;
}

function empty(target, title, message) {
  const box = element("div", "", "empty");
  box.append(element("strong", title), element("span", message));
  target.replaceChildren(box);
}

function home(reports, countries) {
  document.getElementById("report-count").textContent = reports.length;
  document.getElementById("country-count").textContent = new Set(reports.map((report) => report.country).filter((country) => country !== "ZZ")).size;
  document.getElementById("category-count").textContent = new Set(reports.map((report) => report.category)).size;
  const target = document.getElementById("latest");
  if (reports.length) target.replaceChildren(...reports.slice(0, 3).map((report) => card(report, countries)));
  else empty(target, "No reports published yet", "Reports will appear here after review.");
}

function explore(reports, countries) {
  const form = document.getElementById("filters");
  const results = document.getElementById("results-count");
  const target = document.getElementById("feed");
  const fields = ["q", "country", "category", "platform"];
  const params = new URLSearchParams(location.search);
  addOptions(form.elements.country, countryOptions(countries));
  addOptions(form.elements.category, categories.map((value) => [value, value]));
  addOptions(form.elements.platform, platforms.map((value) => [value, value]));
  for (const field of fields) {
    const control = form.elements[field];
    const value = params.get(field) || "";
    if (field === "q") control.value = value.slice(0, 120);
    else if ([...control.options].some((option) => option.value === value)) control.value = value;
  }

  function render() {
    const { q, country, category, platform } = Object.fromEntries(new FormData(form));
    const tokens = q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matched = reports.filter((report) => {
      const searchable = [
        report.title, report.summary, report.description, report.publicAlias,
        report.publicHandle, report.category, report.platform, countries[report.country],
      ].join(" ").toLocaleLowerCase();
      return (!country || report.country === country)
        && (!category || report.category === category)
        && (!platform || report.platform === platform)
        && tokens.every((token) => searchable.includes(token));
    });
    results.textContent = `${matched.length} ${matched.length === 1 ? "report" : "reports"}`;
    if (matched.length) target.replaceChildren(...matched.map((report) => card(report, countries)));
    else if (reports.length) empty(target, "No matching reports", "Try another keyword or clear the filters.");
    else empty(target, "No reports published yet", "Reports will appear here after review.");

    const url = new URL(location.href);
    for (const field of fields) {
      const value = form.elements[field].value.trim();
      if (value) url.searchParams.set(field, value);
      else url.searchParams.delete(field);
    }
    if (url.href !== location.href) history.replaceState(null, "", url);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  form.addEventListener("input", render);
  document.getElementById("clear-filters").addEventListener("click", () => {
    form.reset();
    render();
    form.elements.q.focus();
  });
  render();
}

function countryOptions(countries) {
  return Object.entries(countries).sort((first, second) => first[1].localeCompare(second[1], "en"));
}

function reportForm(countries) {
  const form = document.getElementById("incident-form");
  const controls = form.elements;
  const steps = [...form.querySelectorAll(".step")];
  const markers = [...form.querySelectorAll(".steps li")];
  const back = document.getElementById("back-step");
  const next = document.getElementById("next-step");
  const error = document.getElementById("form-error");
  const success = document.getElementById("form-success");
  const { whatsapp, evidence, description, incident_date: date } = controls;
  let step = 0;
  let sending = false;

  addOptions(controls.country, countryOptions(countries));
  addOptions(controls.category, categories.map((value) => [value, value]));
  addOptions(controls.platform, platforms.map((value) => [value, value]));
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  date.max = localDate.toISOString().slice(0, 10);
  document.getElementById("form-loading").hidden = true;
  form.noValidate = true;
  form.hidden = false;

  function showError(message = "") {
    error.textContent = message;
    error.hidden = !message;
  }

  function showStep(index, focus = true) {
    step = index;
    for (let i = 0; i < steps.length; i++) {
      steps[i].hidden = i !== step;
      if (i === step) markers[i].setAttribute("aria-current", "step");
      else markers[i].removeAttribute("aria-current");
    }
    back.hidden = step === 0;
    next.textContent = step < steps.length - 1 ? "Continue" : "Submit report";
    showError();
    if (focus) steps[step].querySelector("legend").focus();
  }

  function validate(index) {
    if (index === 0) {
      whatsapp.value = whatsapp.value.trim();
      const international = /^\+[1-9]\d{6,14}$/.test(whatsapp.value.replace(/[\s()-]/g, ""));
      whatsapp.setCustomValidity(international ? "" : "Enter a WhatsApp number with a country code.");
    }
    if (index === 1) {
      const files = [...evidence.files];
      let evidenceError = "";
      if (files.length > 3) evidenceError = "Choose up to 3 attachments.";
      else if (files.some((file) => !/\.(jpe?g|png|webp|pdf)$/i.test(file.name) || !file.size)) {
        evidenceError = "Choose non-empty JPG, PNG, WebP or PDF files.";
      } else if (files.reduce((total, file) => total + file.size, 0) > 4_000_000) {
        evidenceError = "Attachments must be 4 MB or less combined.";
      }
      evidence.setCustomValidity(evidenceError);
      const length = description.value.trim().length;
      description.setCustomValidity(length < 20 ? "Describe what happened in at least 20 characters." : "");
    }
    return [...steps[index].querySelectorAll("input, select, textarea")].find((field) => !field.checkValidity());
  }

  form.addEventListener("input", () => showError());
  back.addEventListener("click", () => showStep(step - 1));
  showStep(0, false);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    showError();
    for (let index = 0; index <= step; index++) {
      const invalid = validate(index);
      if (!invalid) continue;
      if (index !== step) showStep(index, false);
      invalid.focus();
      invalid.reportValidity();
      return;
    }

    if (step < steps.length - 1) {
      showStep(step + 1);
      return;
    }
    if (!globalThis.crypto?.randomUUID) {
      showError("Open the secure HTTPS version of the website to send this report.");
      return;
    }

    const reference = controls.reference.value || `RFA-${crypto.randomUUID()}`;
    controls.reference.value = reference;
    const body = new FormData(form);
    body.set("description", description.value.trim());
    sending = true;
    next.disabled = true;
    back.disabled = true;
    next.textContent = "Sending…";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if ((response.status === 400 || response.status === 413) && result.error) {
        showError(result.error);
        return;
      }
      if (!response.ok || result.reference !== reference) throw new Error("Receipt could not be verified");
      form.reset();
      document.getElementById("reference-value").textContent = reference;
      form.hidden = true;
      success.hidden = false;
      document.getElementById("success-title").focus();
    } catch {
      showError("We could not confirm receipt. Try again in a moment. The same reference will be used if you retry.");
    } finally {
      sending = false;
      next.disabled = false;
      back.disabled = false;
      next.textContent = "Submit report";
    }
  });
}

menu();
const page = document.body.dataset.page;
try {
  if (page === "report") reportForm(await getJson("./assets/countries.json"));
  else {
    const [countries, records] = await Promise.all([
      getJson("./assets/countries.json"),
      getJson("./assets/reports.json"),
    ]);
    const reports = publicReports(records, countries);
    if (page === "home") home(reports, countries);
    if (page === "explore") explore(reports, countries);
  }
} catch {
  if (page === "report") {
    document.getElementById("form-loading").textContent = "The form could not load. Please refresh to try again.";
  } else {
    empty(document.getElementById(page === "home" ? "latest" : "feed"), "Reports unavailable", "Please refresh the page to try again.");
  }
}
