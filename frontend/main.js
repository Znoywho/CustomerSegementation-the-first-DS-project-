const DATA_BASE = "../artifacts/dashboard";

const formatNum = (n) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-";

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Cannot load ${path}`);
  return res.json();
}

async function fetchCsv(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Cannot load ${path}`);
  const text = await res.text();
  return parseCsv(text);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const value = cols[i] ?? "";
      const n = Number(value);
      row[h] = value !== "" && Number.isFinite(n) ? n : value;
    });
    return row;
  });
}

function getCategoryCols(row) {
  if (!row) return [];
  return Object.keys(row).filter((k) => /^categ_\d+$/.test(k));
}

function renderCards(summary) {
  const root = document.getElementById("kpi-cards");
  root.innerHTML = "";
  summary
    .sort((a, b) => a.cluster - b.cluster)
    .forEach((c) => {
      const el = document.createElement("article");
      el.className = "card";
      el.innerHTML = `
        <h3>${c.cluster_name ?? `Cluster ${c.cluster}`}</h3>
        <div class="value">${formatNum(c.customer_count)}</div>
        <div class="meta">customers</div>
        <div class="meta">Avg spend: ${formatNum(c.avg_sum)}</div>
        <div class="meta">Avg recency (days): ${formatNum(c.avg_LastPurchase)}</div>
      `;
      root.appendChild(el);
    });
}

function renderCustomersChart(summary) {
  const x = summary.map((d) => d.cluster_name ?? `Cluster ${d.cluster}`);
  const y = summary.map((d) => d.customer_count);
  Plotly.newPlot(
    "customersBar",
    [{ x, y, type: "bar", marker: { color: "#4464ff" } }],
    { margin: { t: 20, r: 10, b: 40, l: 45 }, yaxis: { title: "Customers" } },
    { responsive: true }
  );
}

function renderCategoryChart(categoryRows) {
  if (!categoryRows.length) return;
  const clusters = categoryRows.map((r) => r.cluster_name ?? `Cluster ${r.cluster}`);
  const catCols = Object.keys(categoryRows[0]).filter((k) => /^categ_\d+$/.test(k));
  const traces = catCols.map((cat, idx) => ({
    x: clusters,
    y: categoryRows.map((r) => r[cat]),
    name: cat,
    type: "bar",
    marker: { opacity: 0.9 - idx * 0.08 },
  }));
  Plotly.newPlot(
    "categoryStacked",
    traces,
    {
      barmode: "stack",
      margin: { t: 20, r: 10, b: 50, l: 45 },
      yaxis: { title: "Category %" },
    },
    { responsive: true }
  );
}

function renderInterpretationTable(rows) {
  const tbody = document.querySelector("#interpretTable tbody");
  tbody.innerHTML = "";
  rows
    .sort((a, b) => a.cluster - b.cluster)
    .forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.cluster}</td>
        <td>${r.top_category}</td>
        <td>${formatNum(r.top_category_percent)}%</td>
        <td>${r.top_words}</td>
        <td>${r.hypothesis}</td>
      `;
      tbody.appendChild(tr);
    });
}

function renderClusterInsights(summary, interpretation, clusterId) {
  const info = summary.find((s) => Number(s.cluster) === Number(clusterId));
  const explain = interpretation.find((it) => Number(it.cluster) === Number(clusterId));
  const root = document.getElementById("clusterInsights");
  if (!info) {
    root.innerHTML = "<p>No cluster info available.</p>";
    return;
  }

  const words = (explain?.top_words || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 12);

  root.innerHTML = `
    <div class="insight-item">
      <strong>Cluster</strong>
      <div>${info.cluster_name ?? `Cluster ${info.cluster}`}</div>
    </div>
    <div class="insight-item">
      <strong>Customers</strong>
      <div>${formatNum(info.customer_count)}</div>
    </div>
    <div class="insight-item">
      <strong>Top Category</strong>
      <div>${explain?.top_category ?? "-"}</div>
      <div class="meta">${formatNum(explain?.top_category_percent)}%</div>
    </div>
    <div class="insight-item">
      <strong>Hypothesis</strong>
      <div>${explain?.hypothesis ?? "-"}</div>
    </div>
    <div class="insight-item">
      <strong>Top Words</strong>
      <div class="word-tags">${words.map((w) => `<span class="word-tag">${w}</span>`).join("")}</div>
    </div>
  `;
}

function renderClusterCompareChart(summary, clusterId) {
  const row = summary.find((s) => Number(s.cluster) === Number(clusterId));
  if (!row) return;

  const metrics = ["avg_count", "avg_sum", "avg_LastPurchase"];
  const names = ["Avg Frequency", "Avg Spend", "Avg Recency"];
  const overall = metrics.map((m) => {
    const values = summary.map((s) => Number(s[m]) || 0);
    return values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  });
  const selected = metrics.map((m) => Number(row[m]) || 0);

  Plotly.newPlot(
    "clusterCompare",
    [
      { x: names, y: overall, type: "bar", name: "Overall Avg", marker: { color: "#98a6bd" } },
      { x: names, y: selected, type: "bar", name: row.cluster_name ?? `Cluster ${row.cluster}`, marker: { color: "#365ef6" } },
    ],
    {
      barmode: "group",
      margin: { t: 20, r: 10, b: 40, l: 45 },
      yaxis: { title: "Value" },
    },
    { responsive: true }
  );
}

function renderClusterCategoryDonut(categoryRows, clusterId) {
  const row = categoryRows.find((r) => Number(r.cluster) === Number(clusterId));
  if (!row) return;
  const categoryCols = getCategoryCols(row);

  Plotly.newPlot(
    "clusterCategoryDonut",
    [
      {
        labels: categoryCols,
        values: categoryCols.map((c) => Number(row[c]) || 0),
        type: "pie",
        hole: 0.45,
        textinfo: "label+percent",
      },
    ],
    {
      margin: { t: 20, r: 10, b: 20, l: 10 },
      showlegend: true,
    },
    { responsive: true }
  );
}

function renderSpendDistribution(customers, clusterId) {
  const rows = customers.filter((c) => Number(c.cluster) === Number(clusterId));
  const spend = rows.map((r) => Number(r.sum)).filter((v) => Number.isFinite(v));
  Plotly.newPlot(
    "spendDistribution",
    [
      {
        x: spend,
        type: "histogram",
        marker: { color: "#18a0a6" },
        nbinsx: 30,
      },
    ],
    {
      margin: { t: 20, r: 10, b: 45, l: 45 },
      xaxis: { title: "Spend (sum)" },
      yaxis: { title: "Customers" },
    },
    { responsive: true }
  );
}

function renderRecencySpendScatter(customers, clusterId) {
  const rows = customers.filter((c) => Number(c.cluster) === Number(clusterId));
  const x = [];
  const y = [];
  const text = [];
  rows.forEach((r) => {
    const recency = Number(r.LastPurchase);
    const spend = Number(r.sum);
    if (Number.isFinite(recency) && Number.isFinite(spend)) {
      x.push(recency);
      y.push(spend);
      text.push(`Customer: ${r.CustomerID ?? "-"}`);
    }
  });

  Plotly.newPlot(
    "recencySpendScatter",
    [
      {
        x,
        y,
        mode: "markers",
        type: "scatter",
        text,
        hovertemplate: "%{text}<br>Recency: %{x}<br>Spend: %{y}<extra></extra>",
        marker: { size: 7, color: "#ff8c3a", opacity: 0.75 },
      },
    ],
    {
      margin: { t: 20, r: 10, b: 45, l: 55 },
      xaxis: { title: "LastPurchase (days)" },
      yaxis: { title: "Spend (sum)" },
    },
    { responsive: true }
  );
}

function renderCustomersTable(rows) {
  const table = document.getElementById("customersTable");
  const head = table.querySelector("thead");
  const body = table.querySelector("tbody");
  head.innerHTML = "";
  body.innerHTML = "";
  if (!rows.length) return;

  const columns = ["CustomerID", "cluster", "cluster_name", "count", "mean", "sum", "LastPurchase"];
  const available = columns.filter((c) => c in rows[0]);
  const headRow = document.createElement("tr");
  headRow.innerHTML = available.map((c) => `<th>${c}</th>`).join("");
  head.appendChild(headRow);

  rows.slice(0, 300).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = available.map((c) => `<td>${r[c] ?? ""}</td>`).join("");
    body.appendChild(tr);
  });
}

function setupFilter(customers) {
  const select = document.getElementById("clusterFilter");
  const clusters = [...new Set(customers.map((c) => c.cluster))].sort((a, b) => a - b);
  select.innerHTML = `<option value="all">All</option>` + clusters.map((c) => `<option value="${c}">Cluster ${c}</option>`).join("");

  const render = () => {
    const v = select.value;
    const rows = v === "all" ? customers : customers.filter((c) => String(c.cluster) === v);
    renderCustomersTable(rows);
  };
  select.addEventListener("change", render);
  render();
}

function setupClusterFocus(summary, interpretation, categoryRows, customers) {
  const select = document.getElementById("clusterFocus");
  const clusters = [...new Set(summary.map((s) => Number(s.cluster)))].sort((a, b) => a - b);
  select.innerHTML = clusters.map((c) => `<option value="${c}">Cluster ${c}</option>`).join("");

  const render = () => {
    const selectedCluster = Number(select.value);
    renderClusterInsights(summary, interpretation, selectedCluster);
    renderClusterCompareChart(summary, selectedCluster);
    renderClusterCategoryDonut(categoryRows, selectedCluster);
    renderSpendDistribution(customers, selectedCluster);
    renderRecencySpendScatter(customers, selectedCluster);
  };

  select.addEventListener("change", render);
  if (clusters.length) {
    select.value = String(clusters[0]);
  }
  render();
}

async function init() {
  try {
    const [summary, interpretation, categoryRows, customers] = await Promise.all([
      fetchJson(`${DATA_BASE}/cluster_summary.json`),
      fetchJson(`${DATA_BASE}/cluster_word_category_interpretation.json`),
      fetchCsv(`${DATA_BASE}/category_by_cluster.csv`),
      fetchCsv(`${DATA_BASE}/customer_segments.csv`),
    ]);

    renderCards(summary);
    renderCustomersChart(summary);
    renderCategoryChart(categoryRows);
    renderInterpretationTable(interpretation);
    setupFilter(customers);
    setupClusterFocus(summary, interpretation, categoryRows, customers);
  } catch (err) {
    document.body.innerHTML = `<main class="container"><div class="panel"><h2>Load error</h2><p>${err.message}</p><p>Run export cells in notebook first, then serve this folder with a local HTTP server.</p></div></main>`;
  }
}

init();
