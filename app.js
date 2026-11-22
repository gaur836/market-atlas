const API_BASE = "https://finnhub.io/api/v1";
const $ = (selector) => document.querySelector(selector);
const elements = {
  apiKey: $("#api-key"),
  keySummary: $("#key-summary"),
  searchInput: $("#search-input"),
  searchButton: $("#search-button"),
  searchStatus: $("#search-status"),
  searchResults: $("#search-results"),
  companyView: $("#company-view"),
  companyError: $("#company-error"),
  companyName: $("#company-name"),
  companyMeta: $("#company-meta"),
  companyExchange: $("#company-exchange"),
  companyLogo: $("#company-logo"),
  companySite: $("#company-site"),
  profileDescription: $("#profile-description"),
  profileGrid: $("#profile-grid"),
  metricsGrid: $("#metrics-grid"),
  chart: $("#chart"),
  chartSummary: $("#chart-summary"),
  chartRange: $("#chart-range"),
  financialYear: $("#financial-year"),
  financialType: $("#financial-type"),
  financials: $("#financials"),
  newsList: $("#news-list")
};

let activeSymbol = "";
let companyCurrency = "";
let financialReports = [];
let searchSequence = 0;
let companySequence = 0;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

function setStatus(id, message, kind = "") {
  const element = document.getElementById(id);
  element.textContent = message;
  element.className = element.className.replace(/\s(error|success)/g, "");
  if (kind) element.classList.add(kind);
}

function apiKey() {
  return elements.apiKey.value.trim();
}

async function request(endpoint, params, key) {
  const query = new URLSearchParams({ ...params, token: key });
  let response;
  try {
    response = await fetch(`${API_BASE}/${endpoint}?${query.toString()}`, { cache: "no-store" });
  } catch {
    throw new Error("Could not reach Finnhub. Check your internet connection and try again.");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Finnhub rejected this request. Check that your API key is valid and that your plan includes this data.");
    }
    if (response.status === 429) {
      throw new Error("Finnhub request limit reached. Wait before trying again, or check your plan's usage limits.");
    }
    if (response.status === 404) throw new Error("Finnhub could not find data for this symbol.");
    if (response.status >= 500) throw new Error("Finnhub is temporarily unavailable. Try again shortly.");
    throw new Error(`Finnhub returned an error (${response.status}). Check the symbol and your plan.`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Finnhub returned an unreadable response. Please try again.");
  }
  if (data && typeof data === "object" && !Array.isArray(data) && data.error) {
    throw new Error("Finnhub could not fulfill this request. Check the symbol, API key, and plan availability.");
  }
  return data;
}

function formatNumber(value, decimals = 2) {
  const number = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(number);
}

function formatMoney(value, currency) {
  const number = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: currency || "USD", maximumFractionDigits: 2
    }).format(number);
  } catch {
    return `${formatNumber(number)} ${currency || ""}`.trim();
  }
}

function formatLarge(value, currency = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const absolute = Math.abs(number);
  const suffix = absolute >= 1e12 ? "T" : absolute >= 1e9 ? "B" : absolute >= 1e6 ? "M" : absolute >= 1e3 ? "K" : "";
  const scaled = absolute >= 1e12 ? number / 1e12 : absolute >= 1e9 ? number / 1e9 : absolute >= 1e6 ? number / 1e6 : absolute >= 1e3 ? number / 1e3 : number;
  return `${currency ? `${currency} ` : ""}${formatNumber(scaled, 2)}${suffix}`;
}

function formatDate(timestamp) {
  if (!Number.isFinite(Number(timestamp))) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(Number(timestamp) * 1000));
}

function setSearchStatus(message, kind = "") {
  elements.searchStatus.textContent = message;
  elements.searchStatus.className = `inline-status${kind ? ` ${kind}` : ""}`;
}

function setSectionError(statusId, containerId, message) {
  setStatus(statusId, message, "error");
  const container = document.getElementById(containerId);
  container.replaceChildren();
  container.textContent = message;
  container.classList.add("empty-message");
}

function clearContainer(id) {
  const container = document.getElementById(id);
  container.replaceChildren();
  container.classList.remove("empty-message");
}

async function searchCompanies() {
  const key = apiKey();
  const query = elements.searchInput.value.trim();
  elements.searchResults.replaceChildren();
  elements.searchResults.classList.add("hidden");
  if (!key) {
    setSearchStatus("Add your Finnhub API key before searching.", "error");
    elements.apiKey.focus();
    return;
  }
  if (!query) {
    setSearchStatus("Enter a company name or ticker symbol.", "error");
    elements.searchInput.focus();
    return;
  }

  const sequence = ++searchSequence;
  elements.searchButton.disabled = true;
  setSearchStatus("Searching Finnhub…");
  try {
    const result = await request("search", { q: query }, key);
    if (sequence !== searchSequence) return;
    const matches = Array.isArray(result?.result) ? result.result : [];
    if (!matches.length) {
      setSearchStatus(`No companies found for “${query}”. Check the spelling or try a ticker symbol.`);
      return;
    }
    elements.searchResults.innerHTML = matches.slice(0, 8).map((match, index) => `
      <button class="result-button" type="button" data-index="${index}">
        <span class="result-copy"><span class="result-symbol">${escapeHtml(match.displaySymbol || match.symbol || "—")}</span>
        <span class="result-name">${escapeHtml(match.description || "Name unavailable")}</span></span>
        <span class="result-type">${escapeHtml(match.type || "")}</span>
      </button>`).join("");
    elements.searchResults.classList.remove("hidden");
    elements.searchResults.querySelectorAll(".result-button").forEach((button) => {
      button.addEventListener("click", () => loadCompany(matches[Number(button.dataset.index)]));
    });
    setSearchStatus(`${matches.length} result${matches.length === 1 ? "" : "s"} found. Select a company to view its information.`, "success");
  } catch (error) {
    if (sequence === searchSequence) setSearchStatus(error.message, "error");
  } finally {
    if (sequence === searchSequence) elements.searchButton.disabled = false;
  }
}

function companySection(section, id, statusId, message) {
  setStatus(statusId, message);
  clearContainer(id);
}

async function loadCompany(match) {
  const symbol = String(match?.displaySymbol || match?.symbol || "").trim();
  if (!symbol) {
    setSearchStatus("This search result did not include a valid ticker symbol.", "error");
    return;
  }
  const key = apiKey();
  if (!key) {
    setSearchStatus("Your API key is missing. Enter it again to load company data.", "error");
    return;
  }

  const sequence = ++companySequence;
  activeSymbol = symbol;
  companyCurrency = "";
  financialReports = [];
  elements.companyView.classList.remove("hidden");
  elements.companyError.classList.add("hidden");
  elements.companyName.textContent = match.description || symbol;
  elements.companyMeta.textContent = `${symbol} · Loading company details…`;
  elements.companyExchange.textContent = "COMPANY OVERVIEW";
  elements.companyLogo.textContent = symbol.slice(0, 1);
  elements.companyLogo.replaceChildren(document.createTextNode(symbol.slice(0, 1)));
  elements.companySite.classList.add("hidden");
  $("#quote-price").textContent = "—";
  $("#quote-change").textContent = "—";
  $("#quote-time").textContent = "Latest quote";
  for (const id of ["quote-open", "quote-high", "quote-low", "quote-prev"]) $(`#${id}`).textContent = "—";
  elements.profileDescription.textContent = "Loading company profile…";
  companySection(null, "profile-grid", "profile-status", "Loading…");
  companySection(null, "metrics-grid", "metrics-status", "Loading…");
  companySection(null, "chart", "chart-status", "Loading…");
  companySection(null, "financials", "financial-status", "Loading…");
  companySection(null, "news-list", "news-status", "Loading…");
  elements.chartSummary.textContent = "";
  elements.chartRange.textContent = "";
  elements.financialYear.replaceChildren();

  const now = Math.floor(Date.now() / 1000);
  const from = now - 365 * 24 * 60 * 60;
  const tasks = [
    loadProfile(symbol, key, sequence),
    loadQuote(symbol, key, sequence),
    loadMetrics(symbol, key, sequence),
    loadFinancials(symbol, key, sequence),
    loadCandles(symbol, key, from, now, sequence),
    loadNews(symbol, key, sequence)
  ];
  await Promise.allSettled(tasks);
}

function isCurrent(sequence) {
  return sequence === companySequence;
}

async function loadProfile(symbol, key, sequence) {
  try {
    const profile = await request("stock/profile2", { symbol }, key);
    if (!isCurrent(sequence)) return;
    if (!profile || (!profile.name && !profile.ticker)) throw new Error("No company profile is available for this symbol.");
    elements.companyName.textContent = profile.name || profile.ticker || symbol;
    companyCurrency = profile.currency || "";
    elements.companyMeta.textContent = [profile.ticker || symbol, profile.exchange, profile.currency].filter(Boolean).join(" · ");
    elements.companyExchange.textContent = profile.exchange ? `LISTED ON ${profile.exchange}` : "COMPANY OVERVIEW";
    elements.profileDescription.textContent = profile.description || "Finnhub does not provide a company description for this symbol.";
    const info = [
      ["Industry", profile.finnhubIndustry],
      ["Country", profile.country],
      ["Currency", profile.currency],
      ["Exchange", profile.exchange],
      ["Market cap", profile.marketCapitalization != null ? formatLarge(profile.marketCapitalization, profile.currency) : null],
      ["IPO date", profile.ipo],
      ["Shares outstanding", profile.shareOutstanding != null ? `${formatNumber(profile.shareOutstanding)} M` : null],
      ["Ticker", profile.ticker]
    ].filter(([, value]) => value != null && value !== "");
    elements.profileGrid.innerHTML = info.length
      ? info.map(([label, value]) => `<div class="profile-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")
      : `<p class="empty-message">No profile details were provided by Finnhub.</p>`;
    if (profile.weburl) {
      try {
        const website = new URL(profile.weburl);
        if (website.protocol === "https:" || website.protocol === "http:") {
          elements.companySite.href = website.href;
          elements.companySite.classList.remove("hidden");
        }
      } catch {
        // Ignore malformed vendor website values.
      }
    }
    if (profile.logo) {
      try {
        const logoUrl = new URL(profile.logo);
        if (logoUrl.protocol === "https:") {
          const image = document.createElement("img");
          image.src = logoUrl.href;
          image.alt = "";
          image.referrerPolicy = "no-referrer";
          image.addEventListener("error", () => image.remove(), { once: true });
          elements.companyLogo.replaceChildren(image);
        }
      } catch {
        // Ignore malformed vendor logo values.
      }
    }
    setStatus("profile-status", "");
  } catch (error) {
    if (!isCurrent(sequence)) return;
    elements.profileDescription.textContent = error.message;
    clearContainer("profile-grid");
    setStatus("profile-status", "Unavailable", "error");
  }
}

async function loadQuote(symbol, key, sequence) {
  try {
    const quote = await request("quote", { symbol }, key);
    if (!isCurrent(sequence)) return;
    if (quote?.c == null || Number(quote.c) === 0) throw new Error("No current quote is available for this symbol.");
    $("#quote-price").textContent = formatMoney(quote.c, companyCurrency);
    const change = Number(quote.d);
    const percent = Number(quote.dp);
    const isPositive = Number.isFinite(change) && change >= 0;
    $("#quote-change").textContent = `${Number.isFinite(change) ? `${isPositive ? "+" : ""}${formatNumber(change)}` : "—"} (${Number.isFinite(percent) ? `${isPositive && percent >= 0 ? "+" : ""}${formatNumber(percent)}%` : "—"})`;
    $("#quote-change").className = `change ${isPositive ? "positive" : "negative"}`;
    $("#quote-time").textContent = quote.t ? `As of ${formatDate(quote.t)}` : "Latest available quote";
    $("#quote-open").textContent = formatNumber(quote.o);
    $("#quote-high").textContent = formatNumber(quote.h);
    $("#quote-low").textContent = formatNumber(quote.l);
    $("#quote-prev").textContent = formatNumber(quote.pc);
  } catch (error) {
    if (!isCurrent(sequence)) return;
    $("#quote-price").textContent = "Unavailable";
    $("#quote-time").textContent = error.message;
  }
}

const METRICS = [
  ["peBasicExclExtraTTM", "P/E ratio", (v) => `${formatNumber(v)}×`],
  ["52WeekHigh", "52-week high", (v) => formatNumber(v)],
  ["52WeekLow", "52-week low", (v) => formatNumber(v)],
  ["marketCapitalization", "Market cap", (v, currency) => formatLarge(v, currency)],
  ["epsBasicExclExtraItemsTTM", "EPS (TTM)", (v) => formatNumber(v)],
  ["beta", "Beta", (v) => formatNumber(v)],
  ["dividendYieldIndicatedAnnual", "Dividend yield", (v) => `${formatNumber(v)}%`],
  ["revenuePerShareTTM", "Revenue / share", (v) => formatNumber(v)]
];

async function loadMetrics(symbol, key, sequence) {
  try {
    const response = await request("stock/metric", { symbol, metric: "all" }, key);
    if (!isCurrent(sequence)) return;
    const values = response?.metric;
    const cards = METRICS.filter(([field]) => values?.[field] != null && Number.isFinite(Number(values[field])));
    elements.metricsGrid.innerHTML = cards.length
      ? cards.map(([field, label, render]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(render(values[field], companyCurrency))}</strong></div>`).join("")
      : `<p class="empty-message">Finnhub did not provide key metrics for this symbol.</p>`;
    setStatus("metrics-status", cards.length ? "" : "No metrics available");
  } catch (error) {
    if (!isCurrent(sequence)) return;
    setSectionError("metrics-status", "metrics-grid", error.message);
  }
}

function populateFinancials() {
  const report = financialReports.find((item) => String(item.year) === elements.financialYear.value);
  const statementKey = elements.financialType.value;
  const statements = report?.report?.[statementKey];
  if (!Array.isArray(statements) || !statements.length) {
    elements.financials.innerHTML = `<p class="empty-message">No ${escapeHtml(statementKey === "ic" ? "income statement" : statementKey === "bs" ? "balance sheet" : "cash flow")} rows were returned for this filing.</p>`;
    return;
  }
  elements.financials.innerHTML = `<table><thead><tr><th>Line item</th><th>Value</th><th>Unit</th></tr></thead><tbody>${statements.map((item) => `
    <tr><td>${escapeHtml(item.label || item.concept || "Unnamed item")}</td><td>${escapeHtml(formatNumber(item.value, 2))}</td><td>${escapeHtml(item.unit || "—")}</td></tr>`).join("")}</tbody></table>`;
}

async function loadFinancials(symbol, key, sequence) {
  try {
    const response = await request("stock/financials-reported", { symbol, freq: "annual" }, key);
    if (!isCurrent(sequence)) return;
    financialReports = Array.isArray(response?.data) ? response.data : [];
    if (!financialReports.length) {
      setSectionError("financial-status", "financials", "Finnhub has no reported annual financial filings for this symbol.");
      return;
    }
    const sorted = [...financialReports].sort((a, b) => Number(b.year) - Number(a.year));
    elements.financialYear.innerHTML = sorted.map((report) =>
      `<option value="${escapeHtml(report.year)}">${escapeHtml(report.year)}${report.form ? ` · ${escapeHtml(report.form)}` : ""}</option>`
    ).join("");
    financialReports = sorted;
    setStatus("financial-status", `${sorted.length} annual filing${sorted.length === 1 ? "" : "s"} available`);
    populateFinancials();
  } catch (error) {
    if (!isCurrent(sequence)) return;
    setSectionError("financial-status", "financials", error.message);
  }
}

function drawCandles(data) {
  const closes = data.c;
  const highs = data.h;
  const lows = data.l;
  const times = data.t;
  if (!Array.isArray(closes) || !Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(times) || !closes.length ||
      closes.length !== times.length || closes.length !== highs.length || closes.length !== lows.length) {
    throw new Error("Finnhub did not return usable daily price history.");
  }
  const points = closes.map((close, index) => ({ close: Number(close), high: Number(highs[index]), low: Number(lows[index]), time: Number(times[index]) }))
    .filter((point) => Number.isFinite(point.close) && Number.isFinite(point.high) && Number.isFinite(point.low) && Number.isFinite(point.time));
  if (points.length < 2) throw new Error("Not enough daily price history is available to draw a chart.");

  const width = 900;
  const height = 210;
  const padding = { top: 12, right: 12, bottom: 20, left: 10 };
  const min = Math.min(...points.map((point) => point.low));
  const max = Math.max(...points.map((point) => point.high));
  const spread = max - min || Math.max(Math.abs(max) * .02, 1);
  const x = (index) => padding.left + index * (width - padding.left - padding.right) / (points.length - 1);
  const y = (value) => padding.top + (max - value) * (height - padding.top - padding.bottom) / spread;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.close).toFixed(2)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${height - padding.bottom} L${x(0)},${height - padding.bottom} Z`;
  const ticks = [0.2, 0.5, 0.8].map((fraction) => {
    const tickY = padding.top + fraction * (height - padding.top - padding.bottom);
    return `<line x1="${padding.left}" y1="${tickY}" x2="${width - padding.right}" y2="${tickY}" stroke="#2b3a2f" stroke-dasharray="3 5"/><text x="${width - padding.right}" y="${tickY - 4}" fill="#829283" text-anchor="end" font-size="10">${escapeHtml(formatNumber(max - fraction * spread))}</text>`;
  }).join("");
  const up = points[points.length - 1].close >= points[0].close;
  const stroke = up ? "#b9ed79" : "#ff9a8d";
  const gradient = up ? "chartFillUp" : "chartFillDown";
  elements.chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily closing prices over the past twelve months">
    <defs><linearGradient id="${gradient}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${stroke}" stop-opacity=".2"/><stop offset="100%" stop-color="${stroke}" stop-opacity="0"/></linearGradient></defs>
    ${ticks}<path d="${area}" fill="url(#${gradient})"/><path d="${line}" fill="none" stroke="${stroke}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(points.length - 1)}" cy="${y(points[points.length - 1].close)}" r="3" fill="${stroke}"/></svg>`;
  const first = points[0];
  const last = points[points.length - 1];
  const change = ((last.close - first.close) / first.close) * 100;
  elements.chartSummary.textContent = `${formatNumber(first.close)} → ${formatNumber(last.close)} · ${change >= 0 ? "+" : ""}${formatNumber(change)}%`;
  elements.chartSummary.className = `chart-summary ${change >= 0 ? "positive" : "negative"}`;
  elements.chartRange.textContent = `${formatDate(first.time)} – ${formatDate(last.time)}`;
}

async function loadCandles(symbol, key, from, to, sequence) {
  try {
    const data = await request("stock/candle", {
      symbol, resolution: "D", from: String(from), to: String(to)
    }, key);
    if (!isCurrent(sequence)) return;
    if (data?.s !== "ok") throw new Error(data?.s === "no_data" ? "No daily price history is available for this symbol and date range." : "Finnhub returned no usable daily price history.");
    drawCandles(data);
    setStatus("chart-status", `${data.c.length} trading days`);
  } catch (error) {
    if (!isCurrent(sequence)) return;
    setSectionError("chart-status", "chart", error.message);
  }
}

async function loadNews(symbol, key, sequence) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const date = (value) => value.toISOString().slice(0, 10);
  try {
    const items = await request("company-news", { symbol, from: date(from), to: date(to) }, key);
    if (!isCurrent(sequence)) return;
    if (!Array.isArray(items) || !items.length) {
      setSectionError("news-status", "news-list", "No company news was returned for the past 30 days.");
      return;
    }
    const articles = items.filter((item) => item.headline && item.url).slice(0, 8);
    if (!articles.length) {
      setSectionError("news-status", "news-list", "Finnhub returned news without usable headlines or article links.");
      return;
    }
    elements.newsList.innerHTML = articles.map((item) => {
      let href = "#";
      try {
        const url = new URL(item.url);
        if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
      } catch {
        return "";
      }
      return `<a class="news-card" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
        <span class="news-meta">${escapeHtml(item.source || "News")} · ${escapeHtml(formatDate(item.datetime))}</span>
        <span class="news-title">${escapeHtml(item.headline)}</span>
        ${item.summary ? `<span class="news-summary">${escapeHtml(item.summary)}</span>` : ""}
      </a>`;
    }).join("");
    if (!elements.newsList.children.length) {
      setSectionError("news-status", "news-list", "Finnhub returned no usable article links.");
      return;
    }
    setStatus("news-status", `${articles.length} recent articles`);
  } catch (error) {
    if (!isCurrent(sequence)) return;
    setSectionError("news-status", "news-list", error.message);
  }
}

elements.searchButton.addEventListener("click", searchCompanies);
elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchCompanies();
});
elements.apiKey.addEventListener("input", () => {
  elements.keySummary.textContent = apiKey() ? "API key ready for this session" : "Add your Finnhub API key";
});
$("#key-toggle").addEventListener("click", (event) => {
  const showing = elements.apiKey.type === "text";
  elements.apiKey.type = showing ? "password" : "text";
  event.currentTarget.textContent = showing ? "Show" : "Hide";
  event.currentTarget.setAttribute("aria-label", showing ? "Show API key" : "Hide API key");
});
$("#key-clear").addEventListener("click", () => {
  elements.apiKey.value = "";
  elements.keySummary.textContent = "Add your Finnhub API key";
  elements.apiKey.focus();
});
elements.financialYear.addEventListener("change", populateFinancials);
elements.financialType.addEventListener("change", populateFinancials);
