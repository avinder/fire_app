function inr(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatAbsoluteCompact(value) {
  const safe = Math.max(0, Number(value) || 0);
  const lakhs = safe / 100000;
  if (lakhs >= 100) {
    return `${(safe / 10000000).toFixed(1)} Cr`;
  }
  return `${Math.round(lakhs)} L`;
}

function formatMonthlyCompactFromAnnual(value) {
  const monthly = Math.max(0, Number(value) || 0) / 12;
  const monthlyLakhs = monthly / 100000;
  if (monthlyLakhs >= 100) {
    return `${(monthly / 10000000).toFixed(1)} Cr/mo`;
  }
  return `${Math.round(monthlyLakhs)} L/mo`;
}

let currentDashboardData = null;
const API_URL_STORAGE_KEY = "finance_api_url";
const DEFAULT_API_URL = "http://localhost:8000/api/dashboard/expenses";

function renderSummary(data) {
  void data;
}

function showTab(tabName) {
  const dashboardPanel = document.getElementById("dashboardPanel");
  const firePanel = document.getElementById("firePanel");
  const tabDashboard = document.getElementById("tabDashboard");
  const tabFire = document.getElementById("tabFire");

  if (tabName === "fire") {
    dashboardPanel.classList.remove("active");
    firePanel.classList.add("active");
    tabDashboard.classList.remove("active");
    tabFire.classList.add("active");
  } else {
    firePanel.classList.remove("active");
    dashboardPanel.classList.add("active");
    tabFire.classList.remove("active");
    tabDashboard.classList.add("active");
  }
}

function estimateAnnualExpense(data) {
  const monthly = data.monthly_expenses || [];
  if (!monthly.length) return data.total_expense || 0;
  const monthlyTotal = monthly.reduce((sum, row) => sum + (row.amount || 0), 0);
  const monthlyAverage = monthlyTotal / monthly.length;
  return monthlyAverage * 12;
}

function yearsToTarget(targetCorpus, currentCorpus, annualInvestment, annualReturnRate) {
  if (currentCorpus >= targetCorpus) return 0;
  let corpus = currentCorpus;
  const r = annualReturnRate / 100;
  for (let year = 1; year <= 100; year += 1) {
    corpus = corpus * (1 + r) + annualInvestment;
    if (corpus >= targetCorpus) return year;
  }
  return null;
}

function calculateFire() {
  const currentAge = Number(document.getElementById("fireCurrentAge").value || 0);
  const retirementAgeInput = Number(document.getElementById("fireRetirementAgeInput").value || 0);
  const lifeExpectancy = Number(document.getElementById("fireLifeExpectancy").value || 0);
  const preRetExpenseMonthlyLakh = Number(document.getElementById("firePreRetExpense").value || 0);
  const postRetExpensePct = Number(document.getElementById("firePostRetExpensePct").value || 0);
  const inflationRate = Number(document.getElementById("fireInflationRate").value || 0);
  const preRetReturnRate = Number(document.getElementById("firePreRetReturnRate").value || 0);
  const postRetReturnRate = Number(document.getElementById("firePostRetReturnRate").value || 0);
  const currentCorpusLakh = Number(document.getElementById("fireCurrentCorpus").value || 0);
  const monthlyInvestmentLakh = Number(document.getElementById("fireAnnualInvestment").value || 0);
  const valueMode = document.getElementById("fireValueMode").value;
  const preRetExpense = preRetExpenseMonthlyLakh * 100000 * 12;
  const postRetExpense = preRetExpense * (postRetExpensePct / 100);
  const currentCorpus = currentCorpusLakh * 100000;
  const annualInvestment = monthlyInvestmentLakh * 100000 * 12;

  const fireNumberEl = document.getElementById("fireNumber");
  const fireYearsEl = document.getElementById("fireYears");
  const fireMonthlyEl = document.getElementById("fireMonthlyExpense");
  const fireReadinessEl = document.getElementById("fireReadinessText");
  const fireNumberCardEl = document.getElementById("fireNumberCard");
  const fireProgressPctEl = document.getElementById("fireProgressPct");
  const fireProgressFillEl = document.getElementById("fireProgressFill");
  const fireRequiredAtRetirementEl = document.getElementById("fireRequiredAtRetirement");

  if (
    postRetExpense <= 0 ||
    preRetExpense <= 0 ||
    retirementAgeInput <= currentAge ||
    lifeExpectancy <= currentAge ||
    preRetReturnRate < 0 ||
    postRetReturnRate < 0 ||
    inflationRate < 0
  ) {
    fireReadinessEl.textContent = "Enter valid age, expense, and return values.";
    fireNumberCardEl.classList.remove("not-ready");
    fireNumberEl.textContent = "-";
    fireYearsEl.textContent = "-";
    fireMonthlyEl.textContent = "-";
    fireProgressPctEl.textContent = "0%";
    fireProgressFillEl.style.width = "0%";
    fireRequiredAtRetirementEl.textContent = "-";
    return;
  }

  const yearsToRetirement = retirementAgeInput - currentAge;
  const retirementAge = retirementAgeInput;
  const retirementYears = lifeExpectancy - retirementAge;
  if (retirementYears <= 0) {
    fireReadinessEl.textContent = "Life expectancy must be greater than retirement age.";
    fireNumberCardEl.classList.remove("not-ready");
    fireNumberEl.textContent = "-";
    fireYearsEl.textContent = "-";
    fireMonthlyEl.textContent = "-";
    fireProgressPctEl.textContent = "0%";
    fireProgressFillEl.style.width = "0%";
    fireRequiredAtRetirementEl.textContent = "-";
    return;
  }
  const realPostRetReturn = (1 + postRetReturnRate / 100) / (1 + inflationRate / 100) - 1;

  let fireNumber;
  if (realPostRetReturn <= 0) {
    fireNumber = postRetExpense * retirementYears;
  } else {
    fireNumber =
      postRetExpense * (1 - Math.pow(1 + realPostRetReturn, -retirementYears)) / realPostRetReturn;
  }

  const years = yearsToTarget(fireNumber, currentCorpus, annualInvestment, preRetReturnRate);

  fireNumberEl.textContent = formatAbsoluteCompact(fireNumber);
  fireYearsEl.textContent = years === null ? "100+ years" : `${years} years`;
  fireMonthlyEl.textContent = `${formatMonthlyCompactFromAnnual(preRetExpense)} → ${formatMonthlyCompactFromAnnual(postRetExpense)}`;
  const progressPct = fireNumber > 0 ? Math.min(100, (currentCorpus / fireNumber) * 100) : 0;
  fireProgressPctEl.textContent = `${progressPct.toFixed(1)}%`;
  fireProgressFillEl.style.width = `${progressPct}%`;
  const requiredAtRetirement = fireNumber * Math.pow(1 + inflationRate / 100, yearsToRetirement);
  fireRequiredAtRetirementEl.textContent = requiredAtRetirement
    ? formatAbsoluteCompact(requiredAtRetirement)
    : "N/A";
  const projectionPoints = buildFireProjection({
    currentAge,
    lifeExpectancy,
    retirementAge: retirementAgeInput,
    currentCorpus,
    annualInvestment,
    preRetExpense,
    postRetExpense,
    inflationRate,
    preRetReturnRate,
    postRetReturnRate,
    valueMode,
  });
  renderFireProjectionChart(projectionPoints, valueMode);
  const endingNetWorth = projectionPoints.length
    ? projectionPoints[projectionPoints.length - 1].netWorth
    : 0;
  const notReady = endingNetWorth < 0;
  const readinessText = notReady ? "You are not ready to FIRE." : "You are FIRE ready.";
  fireReadinessEl.textContent = readinessText;
  fireNumberCardEl.classList.toggle("not-ready", notReady);
}

function buildFireProjection(params) {
  const {
    currentAge,
    lifeExpectancy,
    retirementAge,
    currentCorpus,
    annualInvestment,
    preRetExpense,
    postRetExpense,
    inflationRate,
    preRetReturnRate,
    postRetReturnRate,
    valueMode,
  } = params;

  const points = [];
  const inflation = inflationRate / 100;
  let corpus = currentCorpus;
  const currentYear = new Date().getFullYear();

  for (let age = currentAge; age <= lifeExpectancy; age += 1) {
    const yearOffset = age - currentAge;
    const inflationFactor = Math.pow(1 + inflation, yearOffset);
    const calendarYear = currentYear + yearOffset;
    const isWorking = age < retirementAge;
    const incomeFuture = isWorking ? annualInvestment * inflationFactor : 0;
    const expenseBase = isWorking ? preRetExpense : postRetExpense;
    const expenseFuture = expenseBase * inflationFactor;

    const divisor = valueMode === "present" ? inflationFactor : 1;
    points.push({
      age,
      year: calendarYear,
      netWorth: corpus / divisor,
      income: incomeFuture / divisor,
      expense: expenseFuture / divisor,
    });

    const growthRate = (isWorking ? preRetReturnRate : postRetReturnRate) / 100;
    if (isWorking) {
      corpus = corpus * (1 + growthRate) + annualInvestment;
    } else {
      corpus = corpus * (1 + growthRate) - expenseFuture;
    }
  }

  return points;
}

function renderFireProjectionChart(points, valueMode) {
  const chart = document.getElementById("fireProjectionGraph");
  const legend = document.getElementById("fireProjectionLegend");
  chart.innerHTML = "";
  legend.innerHTML = "";

  if (!points.length) {
    chart.textContent = "No projection data.";
    return;
  }

  const netWorthSeries = {
    key: "netWorth",
    label: "Net Worth (Lakh, Right Axis)",
    color: "#1d4ed8",
    transform: (v) => v / 100000,
  };
  const flowSeries = [
    {
      key: "income",
      label: "Income Monthly (Lakh, Left Axis)",
      color: "#0fa968",
      transform: (v) => v / 12 / 100000,
    },
    {
      key: "expense",
      label: "Expense Monthly (Lakh, Left Axis)",
      color: "#e45858",
      transform: (v) => v / 12 / 100000,
    },
  ];
  const series = [netWorthSeries, ...flowSeries];

  const width = 920;
  const height = 310;
  const padX = 65;
  const padY = 34;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;

  const maxLeftValue = Math.max(
    ...points.flatMap((p) => flowSeries.map((s) => Math.max(0, s.transform(p[s.key] || 0)))),
    1,
  );
  const maxRightValue = Math.max(
    ...points.map((p) => Math.max(0, netWorthSeries.transform(p[netWorthSeries.key] || 0))),
    1,
  );
  const roundedLeftMax = Math.max(1, Math.ceil(maxLeftValue));
  const roundedRightMax = Math.max(1, Math.ceil(maxRightValue));
  let leftStep = roundedLeftMax / 5;
  if (leftStep < 0.2) leftStep = 0.2;
  leftStep = Math.ceil(leftStep * 10) / 10;
  let rightStep = roundedRightMax / 5;
  if (rightStep < 0.2) rightStep = 0.2;
  rightStep = Math.ceil(rightStep * 10) / 10;

  const xScale = (age) => {
    const idx = points.findIndex((p) => p.age === age);
    if (points.length === 1) return padX + innerWidth / 2;
    return padX + (idx * innerWidth) / (points.length - 1);
  };
  const leftYScale = (value) =>
    padY + innerHeight - (Math.max(0, value) / roundedLeftMax) * innerHeight;
  const rightYScale = (value) =>
    padY + innerHeight - (Math.max(0, value) / roundedRightMax) * innerHeight;

  const leftTicks = [];
  for (let value = 0; value <= roundedLeftMax; value += leftStep) {
    const y = leftYScale(value);
    leftTicks.push(`
      <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#dfe7f5" stroke-width="1" />
      <text x="${padX - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#6a7f9f">${value.toFixed(1)}L</text>
    `);
  }
  const rightTicks = [];
  for (let value = 0; value <= roundedRightMax; value += rightStep) {
    const y = rightYScale(value);
    rightTicks.push(
      `<text x="${width - padX + 10}" y="${y + 4}" text-anchor="start" font-size="10" fill="#6a7f9f">${value.toFixed(1)}L</text>`,
    );
  }

  const paths = series
    .map((s) => {
      const path = points
        .map((p, idx) => {
          const transformed = s.transform(p[s.key]);
          const y = s.key === "netWorth" ? rightYScale(transformed) : leftYScale(transformed);
          return `${idx === 0 ? "M" : "L"} ${xScale(p.age)} ${y}`;
        })
        .join(" ");
      return `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.8" />`;
    })
    .join("");

  const xLabels = points
    .filter((_, idx) => idx % Math.ceil(points.length / 8) === 0 || idx === points.length - 1)
    .map(
      (p) =>
        `<text x="${xScale(p.age)}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#5f7395">${p.age}</text>`,
    )
    .join("");

  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="FIRE projection (${valueMode} value)">
      ${leftTicks.join("")}
      ${rightTicks.join("")}
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="#cdd8ea" />
      <line x1="${width - padX}" y1="${padY}" x2="${width - padX}" y2="${height - padY}" stroke="#cdd8ea" />
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#cdd8ea" />
      ${paths}
      ${xLabels}
      <text x="${width / 2}" y="${height - 22}" text-anchor="middle" font-size="10" fill="#6a7f9f">Age</text>
      <text x="${padX}" y="${padY - 10}" text-anchor="start" font-size="10" fill="#6a7f9f">Left: Income/Expense (Lakh per month)</text>
      <text x="${width - padX}" y="${padY - 10}" text-anchor="end" font-size="10" fill="#6a7f9f">Right: Net Worth (Lakh)</text>
    </svg>
  `;

  for (const s of series) {
    const item = document.createElement("span");
    item.innerHTML = `<i class="dot" style="background:${s.color}"></i>${s.label}`;
    legend.appendChild(item);
  }
}

function colorForCategory(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
}

function format10kAxisLabel(value) {
  if (value === 0) return "0";
  return `${Math.round(value / 1000)}k`;
}

function getBreakdownPoints(flow, level) {
  if (!currentDashboardData) return [];
  const key = `monthly_${flow}_${level}_breakdown`;
  return currentDashboardData[key] || [];
}

function getRelevantCategories(points) {
  const set = new Set();
  for (const point of points || []) {
    for (const [category, value] of Object.entries(point.categories || {})) {
      if ((value || 0) > 0) set.add(category);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function populateCategorySelect(selectId, categories, selectedCategories) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    option.selected = selectedCategories.includes(category);
    select.appendChild(option);
  }
}

function getSelectedCategories(selectId) {
  const select = document.getElementById(selectId);
  return Array.from(select.selectedOptions).map((opt) => opt.value);
}

function buildPath(points, xScale, yScale, category) {
  return points
    .map((point, idx) => {
      const value = (point.categories && point.categories[category]) || 0;
      return `${idx === 0 ? "M" : "L"} ${xScale(point.month)} ${yScale(value)}`;
    })
    .join(" ");
}

function renderLineChart({ points, selectedCategories, chartId, legendId, ariaLabel }) {
  const chart = document.getElementById(chartId);
  const legend = document.getElementById(legendId);
  chart.innerHTML = "";
  legend.innerHTML = "";

  if (!points || !points.length) {
    chart.textContent = "No monthly points found.";
    return;
  }

  if (!selectedCategories.length) {
    chart.textContent = "No relevant categories found for this level.";
    return;
  }

  const width = 920;
  const height = 300;
  const padX = 65;
  const padY = 34;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;

  const maxValue = Math.max(
    ...points.flatMap((p) => selectedCategories.map((category) => ((p.categories || {})[category] || 0))),
    1,
  );

  const axisBase = 10000;
  const roundedMax = Math.max(axisBase, Math.ceil(maxValue / axisBase) * axisBase);
  let yStep = Math.ceil((roundedMax / 5) / axisBase) * axisBase;
  if (yStep < axisBase) yStep = axisBase;

  const xScale = (month) => {
    const idx = points.findIndex((p) => p.month === month);
    if (points.length === 1) return padX + innerWidth / 2;
    return padX + (idx * innerWidth) / (points.length - 1);
  };
  const yScale = (value) => padY + innerHeight - (value / roundedMax) * innerHeight;

  const yTicks = [];
  for (let value = 0; value <= roundedMax; value += yStep) {
    const y = yScale(value);
    yTicks.push(`
      <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#dfe7f5" stroke-width="1" />
      <text x="${padX - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#6a7f9f">${format10kAxisLabel(value)}</text>
    `);
  }

  const paths = selectedCategories
    .map((category) => {
      const color = colorForCategory(category);
      const path = buildPath(points, xScale, yScale, category);
      return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.8" />`;
    })
    .join("");

  const monthLabels = points
    .map(
      (p) =>
        `<text x="${xScale(p.month)}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#5f7395">${p.month}</text>`,
    )
    .join("");

  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
      ${yTicks.join("")}
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="#cdd8ea" />
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#cdd8ea" />
      ${paths}
      ${monthLabels}
    </svg>
  `;

  for (const category of selectedCategories) {
    const item = document.createElement("span");
    const color = colorForCategory(category);
    item.innerHTML = `<i class="dot" style="background:${color}"></i>${category}`;
    legend.appendChild(item);
  }
}

function renderTopExpenses(data) {
  const body = document.getElementById("topExpensesBody");
  body.innerHTML = "";
  const rows = data.top_expenses || [];
  if (!rows.length) {
    body.innerHTML = "<tr><td colspan='3'>No expense rows found.</td></tr>";
    return;
  }
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.description || "-"}</td>
      <td>${inr(row.amount)}</td>
    `;
    body.appendChild(tr);
  }
}

function refreshCategorySelectors() {
  const creditLevel = document.getElementById("creditLevelSelect").value;
  const debitLevel = document.getElementById("debitLevelSelect").value;

  const creditPoints = getBreakdownPoints("credit", creditLevel);
  const debitPoints = getBreakdownPoints("debit", debitLevel);

  const creditCategories = getRelevantCategories(creditPoints);
  const debitCategories = getRelevantCategories(debitPoints);

  populateCategorySelect("creditCategorySelect", creditCategories, creditCategories);
  populateCategorySelect("debitCategorySelect", debitCategories, debitCategories);
}

function renderCategoryCharts() {
  if (!currentDashboardData) return;

  const creditLevel = document.getElementById("creditLevelSelect").value;
  const debitLevel = document.getElementById("debitLevelSelect").value;

  const creditSelected = getSelectedCategories("creditCategorySelect");
  const debitSelected = getSelectedCategories("debitCategorySelect");

  renderLineChart({
    points: getBreakdownPoints("credit", creditLevel),
    selectedCategories: creditSelected,
    chartId: "creditCategoryLineGraph",
    legendId: "creditCategoryLegend",
    ariaLabel: `Monthly credit ${creditLevel.toUpperCase()} category lines`,
  });

  renderLineChart({
    points: getBreakdownPoints("debit", debitLevel),
    selectedCategories: debitSelected,
    chartId: "debitCategoryLineGraph",
    legendId: "debitCategoryLegend",
    ariaLabel: `Monthly debit ${debitLevel.toUpperCase()} category lines`,
  });
}

async function loadDashboard() {
  const apiUrl = localStorage.getItem(API_URL_STORAGE_KEY) || DEFAULT_API_URL;
  const status = document.getElementById("statusMessage");

  try {
    status.textContent = "";
    const { data, resolvedUrl } = await fetchWithLocalhostFallback(apiUrl);
    if (resolvedUrl !== apiUrl) status.textContent = `Auto-connected to ${resolvedUrl}`;
    localStorage.setItem(API_URL_STORAGE_KEY, resolvedUrl);
    currentDashboardData = data;

    const annualEstimate = estimateAnnualExpense(data);
    const preRetExpenseInput = document.getElementById("firePreRetExpense");
    if (!preRetExpenseInput.value || Number(preRetExpenseInput.value) === 0) {
      preRetExpenseInput.value = (annualEstimate / 12 / 100000).toFixed(1);
    }
    calculateFire();
  } catch (err) {
    status.textContent = `Failed to load dashboard data: ${err.message}. Ensure backend is running and API URL is correct.`;
    calculateFire();
  }
}

function getApiCandidates(apiUrl) {
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    return [apiUrl];
  }

  const host = parsed.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (!isLocal) return [apiUrl];

  const defaultPorts = ["8000", "8001", "8002"];
  const path = `${parsed.pathname}${parsed.search}`;
  const candidates = [`${parsed.protocol}//${host}:${parsed.port || "8000"}${path}`];
  for (const p of defaultPorts) {
    const candidate = `${parsed.protocol}//${host}:${p}${path}`;
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }
  return candidates;
}

async function fetchWithLocalhostFallback(apiUrl) {
  const candidates = getApiCandidates(apiUrl);
  let lastErr;
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      return { data, resolvedUrl: candidate };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Could not reach API");
}

document.getElementById("calculateFireBtn").addEventListener("click", calculateFire);
document.getElementById("fireValueMode").addEventListener("change", calculateFire);

loadDashboard();
