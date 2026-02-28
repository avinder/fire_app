function formatAbsoluteCompact(value) {
  const safe = Math.max(0, Number(value) || 0);
  const lakhs = safe / 100000;
  if (lakhs >= 100) {
    return `${(safe / 10000000).toFixed(1)} Cr`;
  }
  return `${Math.round(lakhs)} L`;
}

function formatMonthlyCompact(value) {
  const monthly = Math.max(0, Number(value) || 0);
  const monthlyLakhs = monthly / 100000;
  if (monthlyLakhs >= 100) {
    return `${(monthly / 10000000).toFixed(1)} Cr/mo`;
  }
  return `${Math.round(monthlyLakhs)} L/mo`;
}

function formatTimeFromMonths(months) {
  if (months === null) return "100+ years";
  const safe = Math.max(0, Math.round(months));
  const years = Math.floor(safe / 12);
  const remMonths = safe % 12;
  if (years === 0) return `${remMonths} months`;
  if (remMonths === 0) return `${years} years`;
  return `${years}y ${remMonths}m`;
}

function annualToMonthlyRate(ratePct) {
  return Math.pow(1 + ratePct / 100, 1 / 12) - 1;
}

const HOME_PRICE_INFLATION_RATE = 8;
const HOME_LOAN_TENURE_YEARS = 20;

function monthlyEmi(principal, annualRatePct, tenureYears) {
  const safePrincipal = Math.max(0, principal || 0);
  if (safePrincipal === 0) return 0;
  const months = Math.max(1, Math.round((tenureYears || 0) * 12));
  const r = annualToMonthlyRate(Math.max(0, annualRatePct || 0));
  if (r === 0) return safePrincipal / months;
  const factor = Math.pow(1 + r, months);
  return (safePrincipal * r * factor) / (factor - 1);
}

function getHomeExpenseForMonth(monthOffset, homePlan) {
  if (!homePlan.enabled) return 0;
  if (monthOffset < homePlan.purchaseMonth) return 0;

  let expense = 0;
  if (monthOffset === homePlan.purchaseMonth) {
    expense += homePlan.downPayment;
  }

  const emiMonthIndex = monthOffset - homePlan.purchaseMonth;
  if (emiMonthIndex >= 0 && emiMonthIndex < homePlan.loanMonths) {
    expense += homePlan.emi;
  }

  return expense;
}

function buildHomePlan(currentAge, homeBuyAge, homeValueToday, downPaymentPct, homeLoanRate) {
  const enabled = homeValueToday > 0 && homeBuyAge >= currentAge;
  if (!enabled) {
    return {
      enabled: false,
      purchaseMonth: 0,
      inflatedPriceAtPurchase: 0,
      downPayment: 0,
      loanMonths: 0,
      emi: 0,
    };
  }

  const purchaseMonth = Math.round((homeBuyAge - currentAge) * 12);
  const yearsToBuy = purchaseMonth / 12;
  const inflatedPriceAtPurchase =
    homeValueToday * Math.pow(1 + HOME_PRICE_INFLATION_RATE / 100, yearsToBuy);
  const downPayment = inflatedPriceAtPurchase * (Math.max(0, downPaymentPct) / 100);
  const principal = Math.max(0, inflatedPriceAtPurchase - downPayment);
  const loanMonths = HOME_LOAN_TENURE_YEARS * 12;
  const emi = monthlyEmi(principal, homeLoanRate, HOME_LOAN_TENURE_YEARS);

  return {
    enabled: true,
    purchaseMonth,
    inflatedPriceAtPurchase,
    downPayment,
    loanMonths,
    emi,
  };
}

let currentDashboardData = null;
const API_URL_STORAGE_KEY = "finance_api_url";

function getDefaultApiUrl() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8000/api/dashboard/expenses";
  }
  if (host.endsWith("github.io")) {
    return "https://fire-app.onrender.com/api/dashboard/expenses";
  }
  return "/api/dashboard/expenses";
}

const DEFAULT_API_URL = getDefaultApiUrl();

function estimateAnnualExpense(data) {
  const monthly = data.monthly_expenses || [];
  if (!monthly.length) return data.total_expense || 0;
  const monthlyTotal = monthly.reduce((sum, row) => sum + (row.amount || 0), 0);
  const monthlyAverage = monthlyTotal / monthly.length;
  return monthlyAverage * 12;
}

function renderKidsBirthAgeInputs() {
  const count = Number(document.getElementById("fireKidsCount").value || 0);
  const currentAge = Number(document.getElementById("fireCurrentAge").value || 30);
  const container = document.getElementById("kidsBirthAgesContainer");
  container.innerHTML = "";

  for (let idx = 1; idx <= count; idx += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "kids-birth-item";
    const suggestedBirthAge = Math.max(16, currentAge - idx * 3);
    wrapper.innerHTML = `
      <label>Kid ${idx} Birth Age (Your Age)</label>
      <input id="kidBirthAge${idx}" type="number" min="0" max="${currentAge}" step="1" value="${suggestedBirthAge}" />
    `;
    container.appendChild(wrapper);
  }
}

function getKidsBirthAges() {
  const count = Number(document.getElementById("fireKidsCount").value || 0);
  const ages = [];
  for (let idx = 1; idx <= count; idx += 1) {
    const el = document.getElementById(`kidBirthAge${idx}`);
    if (!el) continue;
    const value = Number(el.value || 0);
    if (Number.isFinite(value)) ages.push(value);
  }
  return ages;
}

function monthlyKidExpenseBaseByKidAge(kidAge) {
  if (kidAge >= 1 && kidAge < 7) return 10000;
  if (kidAge >= 7 && kidAge < 17) return 20000;
  if (kidAge >= 17 && kidAge < 19) return 30000;
  if (kidAge >= 19 && kidAge < 23) return 50000;
  return 0;
}

function monthlyKidsExpenseForOffset(monthOffset, currentAge, birthAges, kidsInflationRate) {
  const yearOffset = monthOffset / 12;
  const parentAge = currentAge + yearOffset;
  const inflationFactor = Math.pow(1 + kidsInflationRate / 100, Math.max(0, yearOffset));
  let total = 0;
  for (const birthAge of birthAges) {
    const kidAge = parentAge - birthAge;
    const base = monthlyKidExpenseBaseByKidAge(kidAge);
    total += base * inflationFactor;
  }
  return total;
}

function monthsToTarget(
  targetCorpus,
  currentCorpus,
  monthlyIncome,
  annualReturnRate,
  salaryHikeRate,
  homePlan,
) {
  if (currentCorpus >= targetCorpus) return 0;
  let corpus = currentCorpus;
  let contribution = monthlyIncome;
  const monthlyReturn = annualToMonthlyRate(annualReturnRate);
  const monthlyHike = annualToMonthlyRate(salaryHikeRate);

  for (let month = 1; month <= 1200; month += 1) {
    const homeExpense = getHomeExpenseForMonth(month, homePlan);
    corpus = corpus * (1 + monthlyReturn) + contribution - homeExpense;
    if (corpus >= targetCorpus) return month;
    contribution *= 1 + monthlyHike;
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
  const kidsInflationRate = Number(document.getElementById("fireKidsInflationRate").value || 10);
  const preRetReturnRate = Number(document.getElementById("firePreRetReturnRate").value || 0);
  const postRetReturnRate = Number(document.getElementById("firePostRetReturnRate").value || 0);
  const currentCorpusLakh = Number(document.getElementById("fireCurrentCorpus").value || 0);
  const monthlyIncomeLakh = Number(document.getElementById("fireAnnualInvestment").value || 0);
  const salaryHikeRate = Number(document.getElementById("fireSalaryHikeRate").value || 0);
  const homeBuyAge = Number(document.getElementById("fireHomeBuyAge").value || 0);
  const homeValueTodayLakh = Number(document.getElementById("fireHomeValueToday").value || 0);
  const homeDownPaymentPct = Number(document.getElementById("fireHomeDownPaymentPct").value || 0);
  const homeLoanRate = Number(document.getElementById("fireHomeLoanRate").value || 0);
  const valueMode = document.getElementById("fireValueMode").value;
  const kidsBirthAges = getKidsBirthAges();

  const preRetExpenseMonthly = preRetExpenseMonthlyLakh * 100000;
  const postRetExpenseMonthly = preRetExpenseMonthly * (postRetExpensePct / 100);
  const currentCorpus = currentCorpusLakh * 100000;
  const monthlyIncome = monthlyIncomeLakh * 100000;
  const homeValueToday = homeValueTodayLakh * 100000;
  const homePlan = buildHomePlan(
    currentAge,
    homeBuyAge,
    homeValueToday,
    homeDownPaymentPct,
    homeLoanRate,
  );

  const fireNumberEl = document.getElementById("fireNumber");
  const fireTodayValueEl = document.getElementById("fireTodayValue");
  const fireYearsEl = document.getElementById("fireYears");
  const fireMonthlyEl = document.getElementById("fireMonthlyExpense");
  const fireReadinessEl = document.getElementById("fireReadinessText");
  const fireNumberCardEl = document.getElementById("fireNumberCard");
  const fireProgressPctEl = document.getElementById("fireProgressPct");
  const fireProgressFillEl = document.getElementById("fireProgressFill");
  const fireScenarioFasterEl = document.getElementById("fireScenarioFaster");
  const fireScenarioSlowerEl = document.getElementById("fireScenarioSlower");
  const fireHomeDownPaymentHintEl = document.getElementById("fireHomeDownPaymentHint");

  if (
    postRetExpenseMonthly <= 0 ||
    preRetExpenseMonthly <= 0 ||
    monthlyIncome < 0 ||
    retirementAgeInput <= currentAge ||
    lifeExpectancy <= currentAge ||
    homeBuyAge < currentAge ||
    homeBuyAge > lifeExpectancy ||
    homeDownPaymentPct < 0 ||
    homeDownPaymentPct > 100 ||
    homeLoanRate < 0 ||
    homeValueToday < 0 ||
    kidsInflationRate < 0 ||
    salaryHikeRate < 0 ||
    preRetReturnRate < 0 ||
    postRetReturnRate < 0 ||
    inflationRate < 0
  ) {
    fireReadinessEl.textContent = "Enter valid age, expense, and return values.";
    fireNumberCardEl.classList.remove("not-ready");
    fireNumberEl.textContent = "-";
    fireTodayValueEl.textContent = "(Today's Value: -)";
    fireYearsEl.textContent = "-";
    fireMonthlyEl.textContent = "-";
    fireProgressPctEl.textContent = "0%";
    fireProgressFillEl.style.width = "0%";
    fireScenarioFasterEl.textContent = "Cut expense by 10%: -";
    fireScenarioSlowerEl.textContent = "Increase expense by 10%: -";
    fireHomeDownPaymentHintEl.textContent = "Home downpayment check: -";
    fireHomeDownPaymentHintEl.classList.remove("warn");
    return;
  }

  const monthsToRetirement = Math.round((retirementAgeInput - currentAge) * 12);
  const retirementMonths = Math.round((lifeExpectancy - retirementAgeInput) * 12);
  if (retirementMonths <= 0) {
    fireReadinessEl.textContent = "Life expectancy must be greater than retirement age.";
    fireNumberCardEl.classList.remove("not-ready");
    fireNumberEl.textContent = "-";
    fireTodayValueEl.textContent = "(Today's Value: -)";
    fireYearsEl.textContent = "-";
    fireMonthlyEl.textContent = "-";
    fireProgressPctEl.textContent = "0%";
    fireProgressFillEl.style.width = "0%";
    fireScenarioFasterEl.textContent = "Cut expense by 10%: -";
    fireScenarioSlowerEl.textContent = "Increase expense by 10%: -";
    fireHomeDownPaymentHintEl.textContent = "Home downpayment check: -";
    fireHomeDownPaymentHintEl.classList.remove("warn");
    return;
  }

  const inflationAnnual = inflationRate / 100;
  const monthlyPostRetRate = annualToMonthlyRate(postRetReturnRate);

  function requiredAtRetirementForExpense(preRetExpenseMonthlyInput) {
    const adjustedPostRetExpenseMonthly = preRetExpenseMonthlyInput * (postRetExpensePct / 100);
    let required = 0;

    for (let month = 0; month < retirementMonths; month += 1) {
      const monthOffsetFromNow = monthsToRetirement + month;
      const yearsFromNow = monthOffsetFromNow / 12;
      const baseExpenseFuture =
        adjustedPostRetExpenseMonthly * Math.pow(1 + inflationAnnual, yearsFromNow);
      const kidsExpenseFuture = monthlyKidsExpenseForOffset(
        monthOffsetFromNow,
        currentAge,
        kidsBirthAges,
        kidsInflationRate,
      );
      const homeExpenseFuture = getHomeExpenseForMonth(monthOffsetFromNow, homePlan);
      const totalExpenseFuture = baseExpenseFuture + kidsExpenseFuture + homeExpenseFuture;
      required += totalExpenseFuture / Math.pow(1 + monthlyPostRetRate, month);
    }

    return required;
  }

  const requiredAtRetirement = requiredAtRetirementForExpense(preRetExpenseMonthly);
  const fireNumberToday = requiredAtRetirement / Math.pow(1 + inflationAnnual, monthsToRetirement / 12);

  const months = monthsToTarget(
    requiredAtRetirement,
    currentCorpus,
    monthlyIncome,
    preRetReturnRate,
    salaryHikeRate,
    homePlan,
  );

  fireNumberEl.textContent = formatAbsoluteCompact(requiredAtRetirement);
  fireTodayValueEl.textContent = `(Today's Value: ${formatAbsoluteCompact(fireNumberToday)})`;
  fireYearsEl.textContent = formatTimeFromMonths(months);
  fireMonthlyEl.textContent = `${formatMonthlyCompact(preRetExpenseMonthly)} -> ${formatMonthlyCompact(postRetExpenseMonthly)}`;
  const progressPct = fireNumberToday > 0 ? Math.min(100, (currentCorpus / fireNumberToday) * 100) : 0;
  fireProgressPctEl.textContent = `${progressPct.toFixed(1)}%`;
  fireProgressFillEl.style.width = `${progressPct}%`;

  const reducedExpenseRequired = requiredAtRetirementForExpense(preRetExpenseMonthly * 0.9);
  const increasedExpenseRequired = requiredAtRetirementForExpense(preRetExpenseMonthly * 1.1);
  const monthsWithReducedExpense = monthsToTarget(
    reducedExpenseRequired,
    currentCorpus,
    monthlyIncome,
    preRetReturnRate,
    salaryHikeRate,
    homePlan,
  );
  const monthsWithIncreasedExpense = monthsToTarget(
    increasedExpenseRequired,
    currentCorpus,
    monthlyIncome,
    preRetReturnRate,
    salaryHikeRate,
    homePlan,
  );

  let fasterLine = `Cut expense by 10%: ${formatTimeFromMonths(monthsWithReducedExpense)}`;
  if (months !== null && monthsWithReducedExpense !== null) {
    const fasterBy = Math.max(0, months - monthsWithReducedExpense);
    fasterLine += ` (${fasterBy} months faster)`;
  } else if (months === null && monthsWithReducedExpense !== null) {
    fasterLine += " (becomes achievable within planning horizon)";
  }

  let slowerLine = `Increase expense by 10%: ${formatTimeFromMonths(monthsWithIncreasedExpense)}`;
  if (months !== null && monthsWithIncreasedExpense !== null) {
    const laterBy = Math.max(0, monthsWithIncreasedExpense - months);
    slowerLine += ` (${laterBy} months later)`;
  } else if (months !== null && monthsWithIncreasedExpense === null) {
    slowerLine += " (moves beyond planning horizon)";
  }

  fireScenarioFasterEl.textContent = fasterLine;
  fireScenarioSlowerEl.textContent = slowerLine;

  const monthlyPreRetReturn = annualToMonthlyRate(preRetReturnRate);
  const monthlyPostRetReturnForHint = annualToMonthlyRate(postRetReturnRate);
  const monthlySalaryHikeForHint = annualToMonthlyRate(salaryHikeRate);
  let corpusBeforeMonth = currentCorpus;
  let purchaseMonthCorpusAfterDownPayment = null;
  let maxDownPaymentAmount = 0;

  if (homePlan.enabled) {
    for (let month = 0; month <= homePlan.purchaseMonth; month += 1) {
      const yearOffset = month / 12;
      const isWorking = month < monthsToRetirement;
      const growthRate = isWorking ? monthlyPreRetReturn : monthlyPostRetReturnForHint;
      const incomeFuture = isWorking
        ? monthlyIncome * Math.pow(1 + monthlySalaryHikeForHint, month)
        : 0;
      const inflationFactor = Math.pow(1 + inflationAnnual, yearOffset);
      const baseExpenseFuture =
        (isWorking ? preRetExpenseMonthly : postRetExpenseMonthly) * inflationFactor;
      const kidsExpenseFuture = monthlyKidsExpenseForOffset(
        month,
        currentAge,
        kidsBirthAges,
        kidsInflationRate,
      );
      const emiExpense = month === homePlan.purchaseMonth ? homePlan.emi : 0;

      if (month === homePlan.purchaseMonth) {
        maxDownPaymentAmount =
          corpusBeforeMonth * (1 + growthRate) + incomeFuture - baseExpenseFuture - kidsExpenseFuture - emiExpense;
        purchaseMonthCorpusAfterDownPayment = maxDownPaymentAmount - homePlan.downPayment;
        break;
      }

      corpusBeforeMonth =
        corpusBeforeMonth * (1 + growthRate) + incomeFuture - baseExpenseFuture - kidsExpenseFuture;
    }
  }

  if (homePlan.enabled && purchaseMonthCorpusAfterDownPayment !== null && purchaseMonthCorpusAfterDownPayment < 0) {
    const suggestedPct = Math.max(
      0,
      Math.min(100, (Math.max(0, maxDownPaymentAmount) / homePlan.inflatedPriceAtPurchase) * 100),
    );
    fireHomeDownPaymentHintEl.textContent =
      `Home downpayment check: Net worth goes negative at purchase. Suggested max downpayment: ${suggestedPct.toFixed(1)}%`;
    fireHomeDownPaymentHintEl.classList.add("warn");
  } else if (homePlan.enabled) {
    fireHomeDownPaymentHintEl.textContent =
      `Home downpayment check: Current ${homeDownPaymentPct.toFixed(1)}% is sustainable at purchase.`;
    fireHomeDownPaymentHintEl.classList.remove("warn");
  } else {
    fireHomeDownPaymentHintEl.textContent = "Home downpayment check: Not applicable.";
    fireHomeDownPaymentHintEl.classList.remove("warn");
  }

  const projectionPoints = buildFireProjection({
    currentAge,
    lifeExpectancy,
    retirementAge: retirementAgeInput,
    currentCorpus,
    monthlyIncome,
    salaryHikeRate,
    preRetExpenseMonthly,
    postRetExpenseMonthly,
    inflationRate,
    kidsInflationRate,
    kidsBirthAges,
    homePlan,
    preRetReturnRate,
    postRetReturnRate,
    valueMode,
  });
  renderFireProjectionChart(projectionPoints, valueMode);

  const endingNetWorth = projectionPoints.length
    ? projectionPoints[projectionPoints.length - 1].netWorth
    : 0;
  const notReady = endingNetWorth < 0;
  fireReadinessEl.textContent = notReady ? "You are not ready to FIRE." : "You are FIRE ready.";
  fireNumberCardEl.classList.toggle("not-ready", notReady);
}

function buildFireProjection(params) {
  const {
    currentAge,
    lifeExpectancy,
    retirementAge,
    currentCorpus,
    monthlyIncome,
    salaryHikeRate,
    preRetExpenseMonthly,
    postRetExpenseMonthly,
    inflationRate,
    kidsInflationRate,
    kidsBirthAges,
    homePlan,
    preRetReturnRate,
    postRetReturnRate,
    valueMode,
  } = params;

  const points = [];
  const inflation = inflationRate / 100;
  const monthlySalaryHike = annualToMonthlyRate(salaryHikeRate);
  const monthlyPreRetReturn = annualToMonthlyRate(preRetReturnRate);
  const monthlyPostRetReturn = annualToMonthlyRate(postRetReturnRate);
  const totalMonths = Math.round((lifeExpectancy - currentAge) * 12);
  const retirementMonth = Math.round((retirementAge - currentAge) * 12);
  let corpus = currentCorpus;

  for (let month = 0; month <= totalMonths; month += 1) {
    const yearOffset = month / 12;
    const inflationFactor = Math.pow(1 + inflation, yearOffset);
    const isWorking = month < retirementMonth;
    const incomeFuture = isWorking ? monthlyIncome * Math.pow(1 + monthlySalaryHike, month) : 0;

    const baseExpenseFuture =
      (isWorking ? preRetExpenseMonthly : postRetExpenseMonthly) * inflationFactor;
    const kidsExpenseFuture = monthlyKidsExpenseForOffset(
      month,
      currentAge,
      kidsBirthAges,
      kidsInflationRate,
    );
    const homeExpenseFuture = getHomeExpenseForMonth(month, homePlan);
    const expenseFuture = baseExpenseFuture + kidsExpenseFuture + homeExpenseFuture;

    const divisor = valueMode === "present" ? inflationFactor : 1;
    if (month % 12 === 0 || month === totalMonths) {
      points.push({
        age: Math.round(currentAge + yearOffset),
        netWorth: corpus / divisor,
        income: incomeFuture / divisor,
        expense: expenseFuture / divisor,
      });
    }

    const growthRate = isWorking ? monthlyPreRetReturn : monthlyPostRetReturn;
    if (isWorking) {
      corpus = corpus * (1 + growthRate) + incomeFuture - expenseFuture;
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
      transform: (v) => v / 100000,
    },
    {
      key: "expense",
      label: "Expense Monthly (Lakh, Left Axis)",
      color: "#e45858",
      transform: (v) => v / 100000,
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
  let leftStep = Math.max(0.2, Math.ceil((roundedLeftMax / 5) * 10) / 10);
  let rightStep = Math.max(0.2, Math.ceil((roundedRightMax / 5) * 10) / 10);

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
    parsed = new URL(apiUrl, window.location.origin);
  } catch {
    return [apiUrl];
  }

  const host = parsed.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const sameOriginCandidate = `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}${parsed.search}`;
  if (!isLocal) return [sameOriginCandidate];

  const defaultPorts = ["8000", "8001", "8002"];
  const path = `${parsed.pathname}${parsed.search}`;
  const candidates = [sameOriginCandidate];
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
document.getElementById("fireKidsCount").addEventListener("change", () => {
  renderKidsBirthAgeInputs();
  calculateFire();
});
document.getElementById("fireKidsInflationRate").addEventListener("input", calculateFire);
document.getElementById("kidsBirthAgesContainer").addEventListener("input", calculateFire);
document.getElementById("fireCurrentAge").addEventListener("input", () => {
  renderKidsBirthAgeInputs();
  calculateFire();
});
document.getElementById("fireHomeBuyAge").addEventListener("input", calculateFire);
document.getElementById("fireHomeValueToday").addEventListener("input", calculateFire);
document.getElementById("fireHomeDownPaymentPct").addEventListener("input", calculateFire);
document.getElementById("fireHomeLoanRate").addEventListener("input", calculateFire);

renderKidsBirthAgeInputs();
loadDashboard();
