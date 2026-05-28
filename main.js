const DATA_PATH = "data/";

const files = {
  states: `${DATA_PATH}us_states.geojson`,
  stateStory: `${DATA_PATH}state_summer_heat_story_observed_cmip6_2000_2100.csv`,
  annualStory: `${DATA_PATH}state_annual_heat_story_observed_cmip6_2000_2100.csv`,
  monthlyStory: `${DATA_PATH}state_monthly_heat_story_observed_cmip6_2000_2100.csv`,
};

const OBS_START_YEAR = 2000;
const START_YEAR = 2020;
const END_YEAR = 2100;
const BASELINE_LABEL = "observed 2020";

document.body.classList.add("intro-locked");

const scenarioLabels = {
  observed: "Observed",
  ssp126: "Low emissions",
  ssp245: "Medium emissions",
  ssp585: "High emissions",
};

const scenarioOrder = ["ssp126", "ssp245", "ssp585"];

const metricLabels = {
  summer_tas_c_change_from_observed_2020: "Summer average temperature change from observed 2020",
  summer_hot_days_35c_change_from_observed_2020: "Additional 35°C+ summer days compared with observed 2020",
};

const metricShortLabels = {
  summer_tas_c_change_from_observed_2020: "Average warming delta",
  summer_hot_days_35c_change_from_observed_2020: "35°C+ days delta",
};

const metricUnits = {
  summer_tas_c_change_from_observed_2020: "°C",
  summer_hot_days_35c_change_from_observed_2020: "days",
};

const stepSettings = [
  {
    view: "line",
    year: 2020,
    scenario: "ssp245",
    metric: "summer_tas_c_change_from_observed_2020",
    title: "Start with the average",
    subtitle:
      "Observed annual average temperature anchors the recent past; CMIP6 futures rise above that range by 2100."
  },
  {
    view: "map",
    year: 2020,
    scenario: "ssp585",
    metric: "summer_tas_c_change_from_observed_2020",
    title: "Now place that trend on the map",
    subtitle:
      "We use observed 2020 as the baseline, then map the projected summer average-temperature delta across the United States.",
    note:
      "Animated from observed 2020 to 2100 under high emissions. Values show change from the observed 2020 baseline.",
    animateYears: true,
    animationStartYear: 2020,
    animationEndYear: 2100,
    animationStepYears: 10,
    animationFrameDelay: 450,
  },
  {
    view: "map",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_tas_c_change_from_observed_2020",
    title: "By 2100, the map gets warmer",
    subtitle:
      "Average warming delta becomes visible across many states under a high-emissions future.",
    note:
      "The map is warmer by 2100, but it is still showing a summer average.",
  },
  {
    view: "text-break",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_tas_c_change_from_observed_2020",
    title: "Average temperature smooths the real situation",
    subtitle:
      "A yearly average blends comfortable days and extreme days into one number.",
    note:
      "This transition shifts the story from average warming to extreme hot days.",
  },
  {
    view: "translation-card",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "A few degrees can fill a calendar",
    subtitle:
      "The °C figure is baseline-aligned with Plot 01, while the day count is kept as the direct change in 35°C+ summer days from observed 2020.",
    note:
      "Each month block represents one additional average 35°C+ summer day, assigned by projected monthly share.",
  },
  {
    view: "map",
    year: 2020,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Count extreme hot days instead",
    subtitle:
      "This map counts the delta in 35°C+ summer days compared with observed 2020.",
    note:
      "Animated from observed 2020 to 2100 under high emissions. Values show the delta in 35°C+ summer days compared with observed 2020.",
    animateYears: true,
    animationStartYear: 2020,
    animationEndYear: 2100,
    animationStepYears: 10,
    animationFrameDelay: 450,
  },
  {
    view: "map",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Extreme heat days do not increase evenly",
    subtitle:
      "By 2100, the largest increases appear in states that already sit near the 35°C threshold.",
    note:
      "The same average-warming future can create very different daily heat risks.",
    highlight: "top",
  },
  {
    view: "impact-placeholder",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Impact layer placeholder",
    subtitle:
      "This section will connect extra hot days to daily-life impacts.",
    note:
      "daily-life examples",
  },
  {
    view: "map",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Explore the difference yourself",
    subtitle:
      "Use the controls to compare average warming with extreme hot days.",
    note:
      "Explore mode: change the year, scenario, or metric.",
  },
];

let statesGeo;
let allStoryData = [];
let annualStoryData = [];
let annualStateData = [];
let stateData = [];
let tasData = [];
let monthlyData = [];
let allMonthlyData = [];
let currentStep = 0;

let currentState = {
  year: 2020,
  scenario: "ssp245",
  metric: "summer_tas_c_change_from_observed_2020",
  view: "line",
};

let selectedStateName = null;
let mapAnimationTimer = null;
let introCompleted = false;
let introEvaluationTimer = null;
let knownStateNames = [];

const svg = d3.select("#main-chart");
const monthlySvg = d3.select("#monthly-chart");

const title = d3.select("#chart-title");
const subtitle = d3.select("#chart-subtitle");
const stickyViz = d3.select(".sticky-viz");
const legendContainer = d3.select("#legend");
const mapNote = d3.select("#map-note");
const tooltip = d3.select("#tooltip");
const mapYearOverlay = d3.select("#map-year-overlay");

const scenarioSelect = d3.select("#scenario-select");
const yearSlider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");
const metricSelect = d3.select("#metric-select");
const statePicker = d3.select("#state-picker");

const hometownStateInput = d3.select("#hometown-state-input");
const expectationTempInput = d3.select("#expectation-temp-input");
const stateSuggestions = d3.select("#state-suggestions");
const introFormNote = d3.select("#intro-form-note");
const expectationResultSection = d3.select("#expectation-result");
const expectationResultTitle = d3.select("#expectation-result-title");
const expectationResultText = d3.select("#expectation-result-text");
const expectationResultValues = d3.select("#expectation-result-values");

const selectedStateTitle = d3.select("#selected-state-title");
const selectedStateSummary = d3.select("#selected-state-summary");
const selectedStateWarming = d3.select("#selected-state-warming");
const selectedStateHotdays = d3.select("#selected-state-hotdays");
const selectedStateWeeks = d3.select("#selected-state-weeks");

const snapshotStateTitle = d3.select("#snapshot-state-title");
const snapshotStateText = d3.select("#snapshot-state-text");
const snapshotScenario = d3.select("#snapshot-scenario");
const snapshotYear = d3.select("#snapshot-year");
const snapshotMetric = d3.select("#snapshot-metric");

const width = 920;
const height = 540;

const projection = d3.geoAlbersUsa()
  .translate([width / 2, height / 2 + 10])
  .scale(1120);

const path = d3.geoPath(projection);

svg.attr("viewBox", `0 0 ${width} ${height}`);

init();

async function init() {
  if (svg.empty()) {
    console.error("Missing #main-chart svg.");
    return;
  }

  const [states, storyRows, annualRows, monthlyRows] = await Promise.all([
    d3.json(files.states),
    d3.csv(files.stateStory, d3.autoType),
    d3.csv(files.annualStory, d3.autoType).catch(() => []),
    d3.csv(files.monthlyStory, d3.autoType),
  ]);

  statesGeo = states;
  allStoryData = storyRows;
  annualStoryData = annualRows.length ? annualRows : storyRows;
  stateData = storyRows.filter((d) => d.data_source !== "observed" && scenarioOrder.includes(d.scenario));
  annualStateData = annualStoryData.filter((d) => d.data_source !== "observed" && scenarioOrder.includes(d.scenario));
  tasData = stateData;
  allMonthlyData = monthlyRows;
  monthlyData = monthlyRows.filter((d) => d.data_source !== "observed" && scenarioOrder.includes(d.scenario));

  setupControls();
  setupStatePicker();
  setupIntroExpectation();
  setupScrollGate();
  setupScroll();
  setupInitialSelectedStateCard();
  updateStep(0);
}

function setupControls() {
  scenarioSelect.on("change", (event) => {
    currentState.scenario = event.target.value;
    updateManualTitle();
    updateMainView();
    updateSelectedStateFromCurrentView(false);
  });

  yearSlider.on("input", (event) => {
    currentState.year = +event.target.value;
    yearLabel.text(currentState.year);
    updateManualTitle();
    updateMainView();
    updateSelectedStateFromCurrentView(false);
  });

  metricSelect.on("change", (event) => {
    currentState.metric = event.target.value;
    updateManualTitle();
    updateMainView();
    updateSelectedStateFromCurrentView(false);
  });
}

function setupStatePicker() {
  if (statePicker.empty()) return;

  const stateNames = Array.from(
    new Set(stateData.map((d) => normalizeStateName(d.state)))
  ).sort(d3.ascending);

  statePicker
    .selectAll("option.state-option")
    .data(stateNames)
    .join("option")
    .attr("class", "state-option")
    .attr("value", (d) => d)
    .text((d) => d);

  statePicker.on("change", (event) => {
    const stateName = event.target.value;
    if (!stateName) return;

    selectedStateName = stateName;
    updateSelectedStateFromCurrentView(true);
  });
}


function setupIntroExpectation() {
  knownStateNames = Array.from(
    new Set([
      ...allMonthlyData.map((d) => normalizeStateName(d.state)),
      ...stateData.map((d) => normalizeStateName(d.state)),
    ].filter(Boolean))
  ).sort(d3.ascending);

  if (hometownStateInput.empty() || expectationTempInput.empty()) return;

  renderStateSuggestions("");

  const onIntroInput = () => {
    hometownStateInput.classed("is-invalid", false);
    expectationTempInput.classed("is-invalid", false);
    updateIntroPrompt();
  };

  hometownStateInput.on("input", () => {
    onIntroInput();
    renderStateSuggestions(hometownStateInput.property("value"));
  });

  hometownStateInput.on("focus", () => {
    renderStateSuggestions(hometownStateInput.property("value"));
  });

  hometownStateInput.on("keydown", (event) => {
    if (event.key !== "Enter") return;
    const firstSuggestion = stateSuggestions.select("button.state-suggestion-item");
    if (!firstSuggestion.empty()) {
      event.preventDefault();
      chooseStateSuggestion(firstSuggestion.datum());
    }
  });

  hometownStateInput.on("blur", () => {
    window.setTimeout(() => stateSuggestions.classed("is-open", false), 140);
  });

  expectationTempInput.on("input", onIntroInput);
  expectationTempInput.on("change", trySubmitIntroExpectation);
  expectationTempInput.on("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      trySubmitIntroExpectation();
    }
  });
  hometownStateInput.on("change", trySubmitIntroExpectation);
}

function renderStateSuggestions(query) {
  if (stateSuggestions.empty()) return;
  const cleaned = normalizeStateName(query || "").toLowerCase();
  const matches = knownStateNames
    .filter((name) => !cleaned || name.toLowerCase().includes(cleaned))
    .slice(0, 5);

  stateSuggestions
    .classed("is-open", Boolean(matches.length) && !introCompleted)
    .selectAll("button.state-suggestion-item")
    .data(matches, (d) => d)
    .join(
      (enter) => enter.append("button")
        .attr("type", "button")
        .attr("class", "state-suggestion-item")
        .attr("role", "option")
        .on("mousedown", (event) => event.preventDefault())
        .on("click", (event, d) => chooseStateSuggestion(d)),
      (update) => update,
      (exit) => exit.remove()
    )
    .text((d) => d);
}

function chooseStateSuggestion(stateName) {
  hometownStateInput.property("value", stateName);
  hometownStateInput.classed("is-invalid", false);
  stateSuggestions.classed("is-open", false);
  updateIntroPrompt();
  if (expectationTempInput.property("value").trim()) {
    trySubmitIntroExpectation();
  }
}

function trySubmitIntroExpectation() {
  window.clearTimeout(introEvaluationTimer);
  introEvaluationTimer = window.setTimeout(evaluateIntroIfReady, 120);
}

function setupScrollGate() {
  const blockScroll = (event) => {
    if (introCompleted) return;
    const heroBottom = document.querySelector("#hero")?.getBoundingClientRect().bottom ?? 0;
    if (heroBottom <= 6) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  window.addEventListener("wheel", blockScroll, { passive: false });
  window.addEventListener("touchmove", blockScroll, { passive: false });
  window.addEventListener("keydown", (event) => {
    if (introCompleted) return;
    const keys = ["ArrowDown", "PageDown", " ", "Spacebar", "End"];
    if (keys.includes(event.key)) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  });
}

function updateIntroPrompt() {
  if (introCompleted || introFormNote.empty()) return;
  const rawState = hometownStateInput.property("value").trim();
  const rawExpectation = expectationTempInput.property("value").trim();

  if (!rawState && !rawExpectation) {
    introFormNote.html("<em>Please enter your information to continue.</em>");
  } else if (!rawState) {
    introFormNote.html("<em>Please enter your hometown state to continue.</em>");
  } else if (!rawExpectation) {
    introFormNote.html("<em>Please enter your expected average temperature to continue.</em>");
  } else {
    introFormNote.html("<em>Checking your expectation against the projections...</em>");
  }
}

function evaluateIntroIfReady() {
  if (introCompleted) return;
  const rawState = hometownStateInput.property("value").trim();
  const rawExpectation = expectationTempInput.property("value").trim();
  const expectation = +rawExpectation;

  if (!rawState || !rawExpectation || !Number.isFinite(expectation)) {
    updateIntroPrompt();
    return;
  }

  const stateName = matchStateName(rawState);
  const hasValidState = Boolean(stateName);
  hometownStateInput.classed("is-invalid", !hasValidState);
  expectationTempInput.classed("is-invalid", !Number.isFinite(expectation));

  if (!hasValidState) {
    introFormNote.html("<em>Please choose a valid state from the suggestion list.</em>");
    return;
  }

  const result = evaluateStateExpectation(stateName, expectation);
  if (!result) {
    introFormNote.html("<em>Projection data is not available for that state. Try another state.</em>");
    return;
  }

  introCompleted = true;
  document.body.classList.remove("intro-locked");
  document.body.classList.add("intro-complete");
  hometownStateInput.property("value", stateName);
  renderExpectationResult(result);

  selectedStateName = stateName;
  if (!statePicker.empty()) statePicker.property("value", stateName);
  updateSelectedStateFromCurrentView(false);

  setTimeout(() => {
    document.querySelector("#expectation-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 180);
}

function matchStateName(input) {
  const normalized = normalizeStateName(input).toLowerCase();
  return knownStateNames.find((name) => name.toLowerCase() === normalized) || null;
}

function evaluateStateExpectation(stateName, expectation) {
  const projections = getStateAlignedEndCenturyProjections(stateName);
  if (!projections.length) return null;

  const ranked = projections
    .map((d) => ({ ...d, diff: expectation - d.value, absDiff: Math.abs(expectation - d.value) }))
    .sort((a, b) => d3.ascending(a.absDiff, b.absDiff));
  const closest = ranked[0];

  let status = "far";
  if (closest.absDiff < 0.05) status = "correct";
  else if (closest.absDiff <= 1) status = "very close";
  else if (closest.absDiff <= 3) status = "approaching";

  return {
    stateName,
    expectation,
    closest,
    projections,
    status,
  };
}

function getStateAlignedEndCenturyProjections(stateName) {
  const annualRows = buildAnnualTemperatureRowsFromMonthly(allMonthlyData)
    .filter((d) => normalizeStateName(d.state) === stateName && Number.isFinite(d.annual_tas_c));

  if (!annualRows.length) return [];

  const observedYearly = annualRows
    .filter((d) => d.data_source === "observed" && d.year >= OBS_START_YEAR && d.year <= START_YEAR)
    .map((d) => ({ year: d.year, value: d.annual_tas_c }))
    .sort((a, b) => d3.ascending(a.year, b.year));

  const observedRolling = addCenteredRollingAverage(observedYearly, "value", 5);
  const observed2020 = observedRolling.find((d) => d.year === START_YEAR);
  if (!observed2020 || !Number.isFinite(observed2020.value)) return [];

  return scenarioOrder.map((scenario) => {
    const projectedYearly = annualRows
      .filter((d) => d.data_source !== "observed" && d.scenario === scenario && d.year >= START_YEAR && d.year <= END_YEAR)
      .map((d) => ({ year: d.year, value: d.annual_tas_c }))
      .sort((a, b) => d3.ascending(a.year, b.year));

    const projectedRolling = addCenteredRollingAverage(projectedYearly, "value", 5);
    const scenario2020 = projectedRolling.find((d) => d.year === START_YEAR);
    const scenario2100 = projectedRolling.find((d) => d.year === END_YEAR);
    if (!scenario2020 || !scenario2100) return null;

    const sourceGap = scenario2020.value - observed2020.value;
    const aligned2100 = scenario2100.value - sourceGap;
    return {
      scenario,
      label: scenarioLabels[scenario],
      value: aligned2100,
      raw2100: scenario2100.value,
      sourceGap,
      observed2020: observed2020.value,
      rollingWindow: scenario2100.rollingWindow,
    };
  }).filter(Boolean);
}

function renderExpectationResult(result) {
  if (expectationResultSection.empty()) return;

  const { stateName, expectation, closest, projections, status } = result;
  const scenarioPhrase = closest.label.toLowerCase();
  const diffAbs = Math.abs(closest.diff);
  const direction = closest.diff > 0 ? "higher than" : "lower than";
  const diffText = diffAbs < 0.05 ? "almost exactly the same as" : `${d3.format(".1f")(diffAbs)}°C ${direction}`;

  let titleText;
  if (status === "correct") {
    titleText = `You nailed it for ${stateName}.`;
  } else if (status === "very close") {
    titleText = `Your expectation is very close for ${stateName}.`;
  } else if (status === "approaching") {
    titleText = `Your expectation is in the same neighborhood for ${stateName}.`;
  } else {
    titleText = `Your expectation is far from the closest projection for ${stateName}.`;
  }

  let emissionContext;
  if (closest.scenario === "ssp585") {
    emissionContext = "This value is projected under the high-emissions pathway, a more extreme future with continued warming pressure.";
  } else if (closest.scenario === "ssp126") {
    emissionContext = "This value is projected under the low-emissions pathway, a more optimistic mitigation future.";
  } else {
    emissionContext = "This value is projected under the medium-emissions pathway, a moderated future between low and high emissions.";
  }

  let comparisonSentence;
  if (status === "correct") {
    comparisonSentence = `Your expectation matches the closest ${scenarioPhrase} projection.`;
  } else {
    comparisonSentence = `Your expectation is ${diffText} the closest projection, which appears under ${scenarioPhrase}.`;
  }

  expectationResultSection.attr("hidden", null);
  expectationResultTitle.text(titleText);
  expectationResultText.text(`${comparisonSentence} ${emissionContext}`);

  const cards = [
    {
      key: "you",
      label: "Your expectation",
      value: expectation,
      note: "Average annual temperature by 2100",
      closest: false,
    },
    ...projections.map((d) => ({
      key: d.scenario,
      label: d.label,
      value: d.value,
      note: d.scenario === closest.scenario ? "Closest projection" : "Baseline-aligned projection",
      closest: d.scenario === closest.scenario,
    })),
  ];

  expectationResultValues
    .selectAll("div.expectation-value-card")
    .data(cards, (d) => d.key)
    .join("div")
    .attr("class", (d) => `expectation-value-card${d.closest ? " is-closest" : ""}`)
    .html((d) => `
      <span>${d.label}</span>
      <strong>${d3.format(".1f")(d.value)}°C</strong>
      <small>${d.note}</small>
    `);
}

function updateSelectedStateFromCurrentView(rerenderMap = false) {
  if (!selectedStateName) return;

  const rows = stateData.filter((d) =>
    d.year === currentState.year &&
    d.scenario === currentState.scenario
  );

  const dataByState = new Map(
    rows.map((d) => [normalizeStateName(d.state), d])
  );

  const row = dataByState.get(selectedStateName);
  updateSelectedStateCard(selectedStateName, row);

  if (!statePicker.empty()) {
    statePicker.property("value", selectedStateName);
  }

  if (rerenderMap && currentState.view === "map") {
    renderMap();
  }
}

function setupScroll() {
  const scroller = scrollama();

  scroller
    .setup({
      step: ".step",
      offset: 0.55,
      debug: false,
    })
    .onStepEnter((response) => {
      d3.selectAll(".step").classed("is-active", false);
      d3.select(response.element).classed("is-active", true);

      const step = +response.element.dataset.step;
      updateStep(step);
    });

  window.addEventListener("resize", scroller.resize);
}

function updateStep(step) {
  const setting = stepSettings[step];
  if (!setting) return;

  currentStep = step;

  currentState.year = setting.year;
  currentState.scenario = setting.scenario;
  currentState.metric = setting.metric;
  currentState.view = setting.view;

  title.text(setting.title);
  subtitle.text(setting.subtitle);
  mapNote.text(setting.note);

  d3.select("body")
    .classed("explore-mode", step === 9)
    .classed("text-break-active", setting.view === "text-break");

  syncControls();
  pulseViz();
  updateMainView();

  if (!setting.animateYears) {
    updateSelectedStateFromCurrentView(false);
  }
}

function updateMainView() {
  cancelMapAnimation();
  hideTooltip();

  // step8-move summary
  svg.style("display", null);
  d3.select(".chart-wrap").selectAll(".impact-fill").remove();
  const summaryEl = document.getElementById("trend-summary");
  if (summaryEl) summaryEl.style.display = ""; 
  // step8-move summary

  const setting = stepSettings[currentStep];

  const noTooltipSteps = new Set([2, 6]);
  document.body.classList.toggle("no-tooltip", noTooltipSteps.has(currentStep));

  const viewsWithSummary = new Set(["line", "summer-change-line"]);
  if (!viewsWithSummary.has(currentState.view)) {
    hideTrendSummary();
  }

  if (currentState.view === "line") {
    renderLineChart();
  } else if (currentState.view === "summer-change-line") {
    renderSummerChangeLineChart();
  } else if (currentState.view === "text-break") {
    hideMapYearOverlay();
    legendContainer.html("");
    svg.selectAll("*").remove();
  } else if (currentState.view === "translation-card") {
    renderTranslationCard();
  } else if (currentState.view === "compare-line") {
    renderCompareLineChart();
  } else if (currentState.view === "impact-placeholder") {
    renderImpactPlaceholder();
  } else if (setting?.animateYears) {
    startMapYearAnimation(setting);
  } else {
    renderMap();
  }
}

function updateManualTitle() {
  if (currentStep !== 9) return;

  title.text(`${metricLabels[currentState.metric]} in ${currentState.year}`);
  subtitle.text(
    `${scenarioLabels[currentState.scenario]} scenario. Hover over a state to compare average warming and extreme heat.`
  );
  mapNote.text("Explore mode: change the controls to compare the map.");
}

function syncControls() {
  scenarioSelect.property("value", currentState.scenario);
  yearSlider.property("value", currentState.year);
  yearLabel.text(currentState.year);
  metricSelect.property("value", currentState.metric);
}

function setVizMode(mode) {
  if (svg.attr("data-viz-mode") !== mode) {
    svg.selectAll("*").remove();
    svg.attr("data-viz-mode", mode);
  }
}

function hideMapYearOverlay() {
  if (!mapYearOverlay.empty()) {
    mapYearOverlay.classed("is-visible", false).classed("is-animating", false);
  }
}

function drawMapYearLabel() {
  if (mapYearOverlay.empty()) return;

  mapYearOverlay
    .text(currentState.year)
    .classed("is-visible", currentState.view === "map")
    .classed("is-animating", Boolean(mapAnimationTimer));
}
/* ---------------------------------- */
/* ---------------------------------- */
/* ---------------------------------- */

function showTrendSummary(seriesByScenario, color) {
  const container = document.getElementById("trend-summary");
  const rowsEl = document.getElementById("trend-summary-rows");
  if (!container || !rowsEl) return;

  rowsEl.innerHTML = "";
  const summaryLabel = container.querySelector(".trend-summary-label");
  if (summaryLabel) summaryLabel.textContent = "Observed-anchored temperature by 2100";
  for (const scenario of scenarioOrder) {
    const series = seriesByScenario[scenario];
    if (!series || !series.length) continue;
    const last = series.find((d) => d.year === END_YEAR) || series[series.length - 1];
    const temp = last.value;
    const sign = "";
    const row = document.createElement("div");
    row.className = "trend-summary-row";
    row.innerHTML =
      `<span class="dot" style="background:${color(scenario)}"></span>` +
      `<span class="name">${scenarioLabels[scenario]} 2100</span>` +
      `<span class="value" style="color:${color(scenario)}">${temp.toFixed(1)} °C</span>`;
    rowsEl.appendChild(row);
  }
  container.classList.add("is-active");
  requestAnimationFrame(() => {
    container.classList.add("is-visible");
  });
}

function hideTrendSummary() {
  const el = document.getElementById("trend-summary");
  if (!el) return;
  el.classList.remove("is-visible");
  el.classList.remove("is-active");
}

function showCompareSummary(rowsBySeries) {
  const container = document.getElementById("trend-summary");
  const rowsEl = document.getElementById("trend-summary-rows");
  if (!container || !rowsEl) return;

  rowsEl.innerHTML = "";
  const summaryLabel = container.querySelector(".trend-summary-label");
  if (summaryLabel) summaryLabel.textContent = "Scenario change by 2100";

  const seriesConfig = [
    { name: "Average warming delta",        color: "#4f8fc0", unit: "°C",   decimals: 2 },
    { name: "35°C+ days delta",  color: "#c4512c", unit: "days", decimals: 1 },
  ];

  for (const cfg of seriesConfig) {
    const series = rowsBySeries.get(cfg.name);
    if (!series || !series.length) continue;

    const point2100 = series.find((d) => d.year === 2100);
    const value = point2100?.rawValue ?? series[series.length - 1].rawValue;
    const sign = value >= 0 ? "+" : "";

    const row = document.createElement("div");
    row.className = "trend-summary-row";
    row.innerHTML =
      `<span class="dot" style="background:${cfg.color}"></span>` +
      `<span class="name">${cfg.name}</span>` +
      `<span class="value" style="color:${cfg.color}">${sign}${value.toFixed(cfg.decimals)} ${cfg.unit}</span>`;
    rowsEl.appendChild(row);
  }

  container.classList.add("is-active");
  requestAnimationFrame(() => {
    container.classList.add("is-visible");
  });
}

/* ---------------------------------- */
/* ---------------------------------- */
/* ---------------------------------- */
function renderLineChart() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("line");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const margin = { top: 48, right: 18, bottom: 54, left: 74 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const chartData = getNationalAverageRows();
  const observedRows = chartData.observedRows;
  const observedYearlyRows = chartData.observedYearlyRows || observedRows;
  const projectedRowsRaw = chartData.projectedRows;
  const baselinePoint = chartData.baselinePoint;
  const baselineRawPoint = chartData.baselineRawPoint || baselinePoint;
  const temperatureScope = chartData.temperatureScope || "annual";
  const scopeLabel = temperatureScope === "annual" ? "annual" : "summer";

  if (!observedRows.length || !projectedRowsRaw.length || !baselinePoint) {
    mapNote.text("No observed/projected data available for the line chart.");
    return;
  }

  // Plot 01 first shows the raw NOAA-vs-CMIP6 source offset at 2020,
  // then applies a visual baseline adjustment so CMIP6 scenario lines start
  // from the observed 2020 point. The colored 2020 dots remain at their
  // original model positions to keep the source offset visible.
  const baselineVisualValue = baselinePoint.value;
  const sourceGapByScenario = new Map();
  for (const scenario of scenarioOrder) {
    const startPoint = projectedRowsRaw.find((d) => d.scenario === scenario && d.year === START_YEAR);
    if (startPoint && Number.isFinite(startPoint.value) && Number.isFinite(baselineVisualValue)) {
      sourceGapByScenario.set(scenario, startPoint.value - baselineVisualValue);
    }
  }

  const projectedRows = projectedRowsRaw.map((d) => {
    const sourceGap = sourceGapByScenario.get(d.scenario) ?? 0;
    const alignedValue = d.value - sourceGap;
    return {
      ...d,
      rawValue: d.value,
      alignedValue,
      value: alignedValue,
      visualSourceGap: sourceGap,
    };
  });

  const allYValues = [
    ...observedRows.map((d) => d.value),
    ...projectedRows.map((d) => d.rawValue),
    ...projectedRows.map((d) => d.alignedValue),
  ].filter(Number.isFinite);

  const x = d3.scaleLinear()
    .domain([OBS_START_YEAR, END_YEAR])
    .range([0, innerWidth]);

  const yExtent = d3.extent(allYValues);
  const yPadding = Math.max(0.25, (yExtent[1] - yExtent[0]) * 0.14);
  const y = d3.scaleLinear()
    .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
    .nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(scenarioOrder)
    .range(["#4f8fc0", "#d18f2f", "#c4512c"]);

  const g = svg.append("g")
    .attr("class", "line-chart")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const defs = g.append("defs");

  defs.append("marker")
    .attr("id", "annotation-arrow")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 9)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#5f6b73");

  // Light source-transition band around 2020. It marks the switch from observed data to model futures without making the gap the main story.
  g.append("rect")
    .attr("class", "source-transition-band")
    .style("pointer-events", "none")
    .attr("x", x(2019.35))
    .attr("y", 0)
    .attr("width", Math.max(2, x(2020.65) - x(2019.35)))
    .attr("height", innerHeight)
    .attr("fill", "rgba(23, 32, 42, 0.025)")
    .attr("rx", 3);

  g.append("g")
    .attr("class", "grid")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .selectAll("line")
    .attr("stroke", "rgba(23, 32, 42, 0.10)");

  g.select(".grid .domain").remove();

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .tickValues([2000, 2020, 2040, 2060, 2080, 2100])
        .tickFormat(d3.format("d"))
    );

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d.toFixed(1)}°C`));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 44)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Year");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -60)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text(`Average ${scopeLabel} temperature (°C)`);

  // Absolute-temperature view: no zero-change baseline is drawn.

  // observed 2020 baseline marker
  g.append("line")
    .attr("class", "baseline-line")
    .attr("x1", x(START_YEAR))
    .attr("x2", x(START_YEAR))
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#17202a")
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "5 5")
    .attr("opacity", 0.55);

  g.append("text")
    .attr("class", "baseline-label")
    .attr("x", x(START_YEAR))
    .attr("y", -18)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 10.5)
    .attr("font-weight", 900)
    .text("2020 source switch");

  const lineObserved = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  const lineProjectedRaw = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.rawValue))
    .curve(d3.curveMonotoneX);

  const lineProjectedAligned = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.alignedValue))
    .curve(d3.curveMonotoneX);

  // observed historical line
  const observedPath = g.append("path")
    .datum(observedRows)
    .attr("fill", "none")
    .attr("stroke", "#8a8f94")
    .attr("stroke-width", 3)
    .attr("d", lineObserved);

  const observedLength = observedPath.node().getTotalLength();
  observedPath
    .attr("stroke-dasharray", `${observedLength} ${observedLength}`)
    .attr("stroke-dashoffset", observedLength)
    .transition()
    .duration(950)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  // Key observed markers should sit on the same 5-year rolling line that is drawn,
  // not on the unsmoothed yearly values.
  const observedStartRollingPoint = observedRows[0];
  const observed2020RollingPoint = observedRows.find((d) => d.year === START_YEAR) || baselinePoint;

  g.selectAll(".observed-dot")
    .data([observedStartRollingPoint, observed2020RollingPoint].filter(Boolean))
    .join("circle")
    .attr("class", "observed-dot")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.value))
    .attr("r", 5)
    .attr("fill", "#6f7478")
    .attr("stroke", "white")
    .attr("stroke-width", 2.2);

  // Direct source-switch cue tied to the shaded 2020 band.
  g.append("text")
    .attr("class", "source-switch-inline-label")
    .attr("x", x(START_YEAR) + 10)
    .attr("y", 16)
    .attr("text-anchor", "start")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 10.5)
    .attr("font-weight", 900)
    .style("pointer-events", "none")
    .text("raw CMIP6 starts → aligned to NOAA 2020");

  const scenarioStartPoints = scenarioOrder
    .map((scenario) => projectedRows.find((d) => d.scenario === scenario && d.year === START_YEAR))
    .filter((d) => d && Number.isFinite(d.rawValue));

  const observed2020Y = y(baselineVisualValue);
  const lowestStartPoint = scenarioStartPoints.reduce((best, d) => {
    if (!best) return d;
    return d.rawValue < best.rawValue ? d : best;
  }, null);

  if (lowestStartPoint) {
    const sx = x(START_YEAR);
    const lowY = y(lowestStartPoint.rawValue);
    const y0 = Math.min(lowY, observed2020Y);
    const y1 = Math.max(lowY, observed2020Y);
    const waveAmp = 3.4;
    const waveSteps = 36;
    const wavePath = d3.line()
      .x((d, i) => sx + Math.sin(i * 0.95) * waveAmp)
      .y((d) => d)
      .curve(d3.curveCatmullRom.alpha(0.55))(
        d3.range(waveSteps + 1).map((i) => y0 + (i / waveSteps) * (y1 - y0))
      );

    // Put the source-offset connector directly on top of the 2020 source-switch line,
    // so it reads as an offset along the baseline year rather than a separate trend.
    g.append("path")
      .attr("class", "source-offset-connector")
      .attr("d", wavePath)
      .attr("fill", "none")
      .attr("stroke", "rgba(143,47,27,0.76)")
      .attr("stroke-width", 2.1)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none")
      .attr("opacity", 0)
      .transition()
      .delay(820)
      .duration(420)
      .attr("opacity", 1);

    const sourceLabel = g.append("g")
      .attr("class", "source-offset-label")
      .attr("transform", `translate(${sx + 14},${(y0 + y1) / 2 - 10})`)
      .style("pointer-events", "none")
      .attr("opacity", 0);

    sourceLabel.append("rect")
      .attr("x", 0)
      .attr("y", -14)
      .attr("width", 92)
      .attr("height", 24)
      .attr("rx", 8)
      .attr("fill", "rgba(255,255,255,0.92)")
      .attr("stroke", "rgba(143,47,27,0.22)");

    sourceLabel.append("text")
      .attr("x", 9)
      .attr("y", 2)
      .attr("fill", "#8f2f1b")
      .attr("font-size", 10)
      .attr("font-weight", 850)
      .text("source offset");

    sourceLabel.transition()
      .delay(900)
      .duration(420)
      .attr("opacity", 1);
  }

  g.selectAll(".scenario-start-dot-raw")
    .data(scenarioStartPoints)
    .join("circle")
    .attr("class", "scenario-start-dot-raw")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.rawValue))
    .attr("r", 4.8)
    .attr("fill", (d) => color(d.scenario))
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .style("pointer-events", "none")
    .attr("opacity", 0)
    .transition()
    .delay(850)
    .duration(420)
    .attr("opacity", 1);

  const grouped = d3.group(projectedRows, (d) => d.scenario);
  const seriesByScenario = {};

  for (const scenario of scenarioOrder) {
    const scenarioRows = grouped.get(scenario) || [];
    if (!scenarioRows.length) continue;

    seriesByScenario[scenario] = scenarioRows;

    const pathLine = g.append("path")
      .datum(scenarioRows)
      .attr("class", `scenario-line scenario-line-${scenario}`)
      .attr("fill", "none")
      .attr("stroke", color(scenario))
      .attr("stroke-width", scenario === "ssp585" ? 3.2 : 2.7)
      .attr("opacity", 0)
      .attr("d", lineProjectedRaw);

    const totalLength = pathLine.node().getTotalLength();
    pathLine
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .delay(1150)
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1)
      .attr("stroke-dashoffset", 0)
      .transition()
      .delay(450)
      .duration(850)
      .ease(d3.easeCubicInOut)
      .attr("d", lineProjectedAligned)
      .on("end", function() {
        if (scenario === scenarioOrder[scenarioOrder.length - 1]) {
          setTimeout(() => {
            addLineAnnotations();
            showTrendSummary(seriesByScenario, color);
            enableHover();
          }, 250);
        }
      });
  }

  function annotation(labelLines, point, dx, dy, colorValue = "#5f6b73", yAccessor = (d) => d.value) {
    const lines = Array.isArray(labelLines) ? labelLines : [labelLines];
    const pointValue = yAccessor(point);
    const px = x(point.year);
    const py = y(pointValue);
    const labelX = px + dx;
    const labelY = py + dy;
    const anchor = dx > 0 ? "start" : "end";
    const boxWidth = Math.max(128, d3.max(lines, (line) => line.length) * 6.2 + 20);
    const boxHeight = 18 + lines.length * 13;
    const boxX = anchor === "start" ? labelX - 10 : labelX - boxWidth + 10;
    const boxY = labelY - 18;
    const arrowX2 = anchor === "start" ? boxX : boxX + boxWidth;
    const arrowY2 = boxY + boxHeight / 2;

    const ann = g.append("g")
      .attr("class", "line-annotation")
      .attr("opacity", 0)
      .style("pointer-events", "none");

    ann.append("line")
      .attr("class", "annotation-arrow")
      .attr("x1", arrowX2)
      .attr("y1", arrowY2)
      .attr("x2", px)
      .attr("y2", py)
      .attr("stroke", colorValue)
      .attr("stroke-width", 1.1)
      .attr("marker-end", "url(#annotation-arrow)");

    ann.append("rect")
      .attr("x", boxX)
      .attr("y", boxY)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", 8)
      .attr("fill", "rgba(255,255,255,0.96)")
      .attr("stroke", "rgba(23,32,42,0.18)")
      .attr("stroke-width", 1.1);

    const text = ann.append("text")
      .attr("class", "line-annotation-label")
      .attr("x", anchor === "start" ? boxX + 10 : boxX + boxWidth - 10)
      .attr("y", boxY + 16)
      .attr("text-anchor", anchor)
      .attr("fill", colorValue)
      .attr("font-size", 10)
      .attr("font-weight", 850);

    lines.forEach((line, i) => {
      text.append("tspan")
        .attr("x", anchor === "start" ? boxX + 10 : boxX + boxWidth - 10)
        .attr("dy", i === 0 ? 0 : 13)
        .text(line);
    });

    ann.transition()
      .duration(400)
      .attr("opacity", 1);
  }

  function addLineAnnotations() {
    const startPoint = observedStartRollingPoint;
    const baselineLabelPoint = observed2020RollingPoint;
    // These two annotations point to the two grey markers on the plotted 5-year rolling line.
    annotation(["2000 observed", `${startPoint.value.toFixed(1)}°C 5-year avg`], startPoint, 44, 72, "#6f7478", (d) => d.value);
    annotation(["2020 observed", `${baselineLabelPoint.value.toFixed(1)}°C 5-year avg`], baselineLabelPoint, 96, -78, "#17202a", (d) => d.value);

    // Keep the future takeaway close to the red line it describes.
    const highSeries = seriesByScenario.ssp585 || [];
    const highEnd = highSeries.find((d) => d.year === END_YEAR) || highSeries[highSeries.length - 1];
    if (highEnd) {
      annotation(["High emissions", "above observed range"], highEnd, -18, -34, color("ssp585"));
    }
  }

  const hoverLine = g.append("line")
    .attr("class", "hover-line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .style("opacity", 0);

  const hoverDots = {};
  for (const scenario of scenarioOrder) {
    if (!seriesByScenario[scenario]) continue;
    hoverDots[scenario] = g.append("circle")
      .attr("class", "hover-dot")
      .attr("r", 4.5)
      .attr("fill", color(scenario))
      .style("opacity", 0);
  }
  hoverDots.observed = g.append("circle")
    .attr("class", "hover-dot")
    .attr("r", 4.5)
    .attr("fill", "#6f7478")
    .style("opacity", 0);

  const hoverRect = g.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .style("pointer-events", "none");

  function enableHover() {
    // Keep the transparent hover layer above annotations/callouts so the
    // 2020 and 2021 regions remain hoverable even when labels overlap them.
    hoverRect.raise();
    hoverLine.raise();
    Object.values(hoverDots).forEach((dot) => dot.raise().style("pointer-events", "none"));
    hoverRect.style("pointer-events", "all");
    hoverRect
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event, this);
        const yearAtMouse = Math.round(x.invert(mx));
        const clamped = Math.max(OBS_START_YEAR, Math.min(END_YEAR, yearAtMouse));
        const xPos = x(clamped);

        hoverLine.attr("x1", xPos).attr("x2", xPos).style("opacity", 1);

        const lines = [`<h3>${clamped}</h3>`];

        if (clamped <= START_YEAR) {
          const point = observedRows.find((d) => d.year === clamped);
          if (point) {
            hoverDots.observed
              .attr("cx", xPos)
              .attr("cy", y(point.value))
              .style("opacity", 1);
            lines.push(`<p>Observed 5-year rolling ${scopeLabel} temp: <strong>${point.value.toFixed(2)}°C</strong></p>`);
          }
        } else {
          hoverDots.observed.style("opacity", 0);
        }

        if (clamped >= START_YEAR) {
          if (clamped === START_YEAR) {
            lines.push(`<p class="tooltip-muted">2020 CMIP6 values are shown raw, before the baseline adjustment.</p>`);
          }
          for (const scenario of scenarioOrder) {
            const series = seriesByScenario[scenario];
            if (!series) continue;
            const point = series.find((d) => d.year === clamped);
            if (!point) continue;
            const c = color(scenario);
            const tooltipValue = (clamped === START_YEAR && Number.isFinite(point.rawValue)) ? point.rawValue : point.value;
            const tooltipLabel = clamped === START_YEAR
              ? `${scenarioLabels[scenario]} raw 5-year rolling temp`
              : `${scenarioLabels[scenario]} adjusted 5-year rolling temp`;
            hoverDots[scenario]
              .attr("cx", xPos)
              .attr("cy", y(tooltipValue))
              .style("opacity", 1);
            lines.push(
              `<p><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px;"></span>` +
              `${tooltipLabel}: <strong>${tooltipValue.toFixed(2)}°C</strong></p>`
            );
          }
          if (clamped === START_YEAR) {
            lines.push(`<p class="tooltip-muted">All adjusted to real baseline.</p>`);
          }
        } else {
          for (const scenario of scenarioOrder) {
            hoverDots[scenario]?.style("opacity", 0);
          }
        }

        tooltip
          .html(lines.join(""))
          .style("left", `${event.clientX + 14}px`)
          .style("top", `${event.clientY + 14}px`)
          .attr("hidden", null);
      })
      .on("mouseleave", function () {
        hoverLine.style("opacity", 0);
        Object.values(hoverDots).forEach((d) => d.style("opacity", 0));
        tooltip.attr("hidden", true);
      });
  }

  legendContainer
    .attr("class", "line-caption")
    .append("div")
    .attr("class", "legend-caption")
    .text(`Grey = NOAA observed annual average temperature. Colored dots show raw CMIP6 starts at 2020; scenario lines then use a baseline adjustment anchored to the observed 2020 point. Lines use centered 5-year rolling averages; endpoint windows use available years.`);
}


function showSummerChangeSummary(seriesByScenario, color) {
  const container = document.getElementById("trend-summary");
  const rowsEl = document.getElementById("trend-summary-rows");
  if (!container || !rowsEl) return;

  rowsEl.innerHTML = "";
  const summaryLabel = container.querySelector(".trend-summary-label");
  if (summaryLabel) summaryLabel.textContent = "Scenario change by 2100";

  for (const scenario of scenarioOrder) {
    const series = seriesByScenario[scenario];
    if (!series || !series.length) continue;
    const last = series.find((d) => d.year === END_YEAR) || series[series.length - 1];
    const delta = Number.isFinite(last.delta) ? last.delta : last.value;
    const sign = delta >= 0 ? "+" : "";
    const row = document.createElement("div");
    row.className = "trend-summary-row";
    row.innerHTML =
      `<span class="dot" style="background:${color(scenario)}"></span>` +
      `<span class="name">${scenarioLabels[scenario]} 2100</span>` +
      `<span class="value" style="color:${color(scenario)}">${sign}${delta.toFixed(2)} °C</span>`;
    rowsEl.appendChild(row);
  }

  container.classList.add("is-active");
  requestAnimationFrame(() => {
    container.classList.add("is-visible");
  });
}

function getSummerChangeNationalRows() {
  const observedRaw = d3.rollups(
    allStoryData.filter((d) => d.data_source === "observed" && Number.isFinite(d.summer_tas_c)),
    (v) => d3.mean(v, (d) => d.summer_tas_c),
    (d) => d.year
  ).map(([year, absoluteValue]) => ({
    series: "observed",
    scenario: "observed",
    year,
    absoluteValue,
  }))
    .filter((d) => d.year >= OBS_START_YEAR && d.year <= START_YEAR && Number.isFinite(d.absoluteValue))
    .sort((a, b) => d3.ascending(a.year, b.year));

  const observed2000 = observedRaw.find((d) => d.year === OBS_START_YEAR)?.absoluteValue ?? observedRaw[0]?.absoluteValue;

  const observedRows = observedRaw.map((d) => ({
    ...d,
    value: Number.isFinite(observed2000) ? d.absoluteValue - observed2000 : NaN,
    delta: Number.isFinite(observed2000) ? d.absoluteValue - observed2000 : NaN,
  })).filter((d) => Number.isFinite(d.value));

  const baselinePoint = observedRows.find((d) => d.year === START_YEAR);
  const observed2020VisualValue = baselinePoint?.value ?? 0;

  const projectedRows = d3.rollups(
    stateData.filter((d) => Number.isFinite(d.summer_tas_c_change_from_observed_2020)),
    (v) => ({
      deltaFromObserved2020: d3.mean(v, (d) => d.summer_tas_c_change_from_observed_2020),
      deltaFromCMIP62020: d3.mean(v, (d) => d.summer_tas_c_change_from_cmip6_2020),
    }),
    (d) => d.scenario,
    (d) => d.year
  ).flatMap(([scenario, yearValues]) => {
    const rows = yearValues.map(([year, values]) => ({
      series: scenario,
      scenario,
      year,
      // The main story keeps observed 2020 as the real-world baseline.
      // To place projection lines in the same chart as the observed 2000-2020 line,
      // add the observed 2020 visual offset to the model-vs-observed-2020 delta.
      deltaFromObserved2020: values.deltaFromObserved2020,
      deltaFromCMIP62020: values.deltaFromCMIP62020,
      value: observed2020VisualValue + values.deltaFromObserved2020,
    }))
      .filter((d) => scenarioOrder.includes(d.scenario) && d.year >= START_YEAR && d.year <= END_YEAR)
      .sort((a, b) => d3.ascending(a.year, b.year));

    const modelStartVisualValue = rows.find((d) => d.year === START_YEAR)?.value;
    const sourceGap = Number.isFinite(modelStartVisualValue)
      ? modelStartVisualValue - observed2020VisualValue
      : NaN;

    return rows.map((d) => ({
      ...d,
      futureDelta: d.deltaFromObserved2020,
      delta: d.deltaFromObserved2020,
      modelStartVisualValue,
      sourceGap,
    }));
  })
    .filter((d) => Number.isFinite(d.deltaFromObserved2020) && Number.isFinite(d.value))
    .sort((a, b) => d3.ascending(a.year, b.year));

  return { observedRows, projectedRows, baselinePoint };
}

function renderSummerChangeLineChart() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("summer-change-line");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const margin = { top: 58, right: 22, bottom: 56, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const chartData = getSummerChangeNationalRows();
  const observedRows = chartData.observedRows;
  const projectedRowsRaw = chartData.projectedRows;
  const baselinePoint = chartData.baselinePoint;

  if (!observedRows.length || !projectedRowsRaw.length || !baselinePoint) {
    mapNote.text("No observed/projected data available for the line chart.");
    return;
  }

  // Plot 01 first shows the raw NOAA-vs-CMIP6 source offset at 2020,
  // then applies a visual baseline adjustment so CMIP6 scenario lines start
  // from the observed 2020 point. The colored 2020 dots remain at their
  // original model positions to keep the source offset visible.
  const baselineVisualValue = baselinePoint.value;
  const sourceGapByScenario = new Map();
  for (const scenario of scenarioOrder) {
    const startPoint = projectedRowsRaw.find((d) => d.scenario === scenario && d.year === START_YEAR);
    if (startPoint && Number.isFinite(startPoint.value) && Number.isFinite(baselineVisualValue)) {
      sourceGapByScenario.set(scenario, startPoint.value - baselineVisualValue);
    }
  }

  const projectedRows = projectedRowsRaw.map((d) => {
    const sourceGap = sourceGapByScenario.get(d.scenario) ?? 0;
    const alignedValue = d.value - sourceGap;
    return {
      ...d,
      rawValue: d.value,
      alignedValue,
      value: alignedValue,
      visualSourceGap: sourceGap,
    };
  });

  const allYValues = [
    ...observedRows.map((d) => d.value),
    ...projectedRows.map((d) => d.rawValue),
    ...projectedRows.map((d) => d.alignedValue),
  ].filter(Number.isFinite);

  const x = d3.scaleLinear()
    .domain([OBS_START_YEAR, END_YEAR])
    .range([0, innerWidth]);

  const yExtent = d3.extent(allYValues);
  const yPadding = Math.max(0.25, (yExtent[1] - yExtent[0]) * 0.14);
  const y = d3.scaleLinear()
    .domain([Math.min(0, yExtent[0] - yPadding), yExtent[1] + yPadding])
    .nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(scenarioOrder)
    .range(["#4f8fc0", "#d18f2f", "#c4512c"]);

  const g = svg.append("g")
    .attr("class", "line-chart")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const defs = g.append("defs");

  defs.append("marker")
    .attr("id", "annotation-arrow")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 9)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#5f6b73");

  // Light source-transition band around 2020. It turns the visual gap into a designed cue.
  g.append("rect")
    .attr("class", "source-transition-band")
    .style("pointer-events", "none")
    .attr("x", x(2019.35))
    .attr("y", 0)
    .attr("width", Math.max(2, x(2020.65) - x(2019.35)))
    .attr("height", innerHeight)
    .attr("fill", "rgba(23, 32, 42, 0.035)")
    .attr("rx", 3);

  g.append("g")
    .attr("class", "grid")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .selectAll("line")
    .attr("stroke", "rgba(23, 32, 42, 0.10)");

  g.select(".grid .domain").remove();

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .tickValues([2000, 2020, 2040, 2060, 2080, 2100])
        .tickFormat(d3.format("d"))
    );

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d.toFixed(1)}°C`));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 44)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Year");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -60)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Average summer temperature change (°C)");

  // horizontal zero baseline for the observed 2000 reference.
  g.append("line")
    .attr("class", "zero-baseline")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "rgba(23, 32, 42, 0.25)")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3 4");


  // observed 2020 baseline marker
  g.append("line")
    .attr("class", "baseline-line")
    .attr("x1", x(START_YEAR))
    .attr("x2", x(START_YEAR))
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#17202a")
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "5 5")
    .attr("opacity", 0.55);

  g.append("text")
    .attr("class", "baseline-label")
    .attr("x", x(START_YEAR))
    .attr("y", -18)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 10.5)
    .attr("font-weight", 900)
    .text("2020 source gap");

  const lineObserved = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  const lineProjectedRaw = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.rawValue))
    .curve(d3.curveMonotoneX);

  const lineProjectedAligned = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.alignedValue))
    .curve(d3.curveMonotoneX);

  // observed historical line
  const observedPath = g.append("path")
    .datum(observedRows)
    .attr("fill", "none")
    .attr("stroke", "#8a8f94")
    .attr("stroke-width", 3)
    .attr("d", lineObserved);

  const observedLength = observedPath.node().getTotalLength();
  observedPath
    .attr("stroke-dasharray", `${observedLength} ${observedLength}`)
    .attr("stroke-dashoffset", observedLength)
    .transition()
    .duration(950)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  g.selectAll(".observed-dot")
    .data([observedRows[0], baselinePoint])
    .join("circle")
    .attr("class", "observed-dot")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.value))
    .attr("r", 4.5)
    .attr("fill", "#6f7478")
    .attr("stroke", "white")
    .attr("stroke-width", 2);

  const gapRemark = g.append("g")
    .attr("class", "gap-remark")
    .attr("transform", `translate(${x(2057)},${18})`)
    .attr("opacity", 0)
    .style("pointer-events", "none");

  gapRemark.append("rect")
    .attr("x", -10)
    .attr("y", -22)
    .attr("width", 284)
    .attr("height", 50)
    .attr("rx", 12)
    .attr("fill", "rgba(255, 248, 240, 0.95)")
    .attr("stroke", "rgba(143,47,27,0.20)");

  const gapRemarkText = gapRemark.append("text")
    .attr("x", 0)
    .attr("y", -5)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 10.5)
    .attr("font-weight", 900)
    .text("2020 source gap");

  gapRemark.append("text")
    .attr("class", "gap-remark-subtitle")
    .attr("x", 0)
    .attr("y", 12)
    .attr("fill", "#5f6b73")
    .attr("font-size", 9.5)
    .attr("font-weight", 700)
    .text("Shaded band marks NOAA ↔ CMIP6 source gap.");

  gapRemark.append("text")
    .attr("class", "gap-remark-subtitle-2")
    .attr("x", 0)
    .attr("y", 26)
    .attr("fill", "#5f6b73")
    .attr("font-size", 9.5)
    .attr("font-weight", 700)
    .text("Solid lines remain measured from observed 2020.");

  gapRemark.transition()
    .delay(950)
    .duration(450)
    .attr("opacity", 1);

  const grouped = d3.group(projectedRows, (d) => d.scenario);
  const seriesByScenario = {};

  for (const scenario of scenarioOrder) {
    const scenarioRows = grouped.get(scenario) || [];
    if (!scenarioRows.length) continue;

    seriesByScenario[scenario] = scenarioRows;

    const pathLine = g.append("path")
      .datum(scenarioRows)
      .attr("class", `scenario-line scenario-line-${scenario}`)
      .attr("fill", "none")
      .attr("stroke", color(scenario))
      .attr("stroke-width", scenario === "ssp585" ? 3.2 : 2.7)
      .attr("opacity", 0)
      .attr("d", lineProjected);

    const totalLength = pathLine.node().getTotalLength();
    pathLine
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .delay(1150)
      .duration(1050)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1)
      .attr("stroke-dashoffset", 0)
      .on("end", function() {
        if (scenario === scenarioOrder[scenarioOrder.length - 1]) {
          setTimeout(() => {
            addLineAnnotations();
            showSummerChangeSummary(seriesByScenario, color);
            enableHover();
          }, 250);
        }
      });
  }

  function annotation(labelLines, point, dx, dy, colorValue = "#5f6b73", yAccessor = (d) => d.value) {
    const lines = Array.isArray(labelLines) ? labelLines : [labelLines];
    const pointValue = yAccessor(point);
    const px = x(point.year);
    const py = y(pointValue);
    const labelX = px + dx;
    const labelY = py + dy;
    const anchor = dx > 0 ? "start" : "end";
    const boxWidth = Math.max(128, d3.max(lines, (line) => line.length) * 6.2 + 20);
    const boxHeight = 18 + lines.length * 13;
    const boxX = anchor === "start" ? labelX - 10 : labelX - boxWidth + 10;
    const boxY = labelY - 18;
    const arrowX2 = anchor === "start" ? boxX : boxX + boxWidth;
    const arrowY2 = boxY + boxHeight / 2;

    const ann = g.append("g")
      .attr("class", "line-annotation")
      .attr("opacity", 0)
      .style("pointer-events", "none");

    ann.append("line")
      .attr("class", "annotation-arrow")
      .attr("x1", arrowX2)
      .attr("y1", arrowY2)
      .attr("x2", px)
      .attr("y2", py)
      .attr("stroke", colorValue)
      .attr("stroke-width", 1.1)
      .attr("marker-end", "url(#annotation-arrow)");

    ann.append("rect")
      .attr("x", boxX)
      .attr("y", boxY)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", 8)
      .attr("fill", "rgba(255,255,255,0.96)")
      .attr("stroke", "rgba(23,32,42,0.18)")
      .attr("stroke-width", 1.1);

    const text = ann.append("text")
      .attr("class", "line-annotation-label")
      .attr("x", anchor === "start" ? boxX + 10 : boxX + boxWidth - 10)
      .attr("y", boxY + 16)
      .attr("text-anchor", anchor)
      .attr("fill", colorValue)
      .attr("font-size", 10)
      .attr("font-weight", 850);

    lines.forEach((line, i) => {
      text.append("tspan")
        .attr("x", anchor === "start" ? boxX + 10 : boxX + boxWidth - 10)
        .attr("dy", i === 0 ? 0 : 13)
        .text(line);
    });

    ann.transition()
      .duration(400)
      .attr("opacity", 1);
  }

  function addLineAnnotations() {
    const startPoint = observedRows[0];
    annotation(["2000 observed", `${startPoint.absoluteValue.toFixed(1)}°C baseline temp`], startPoint, 42, 54, "#6f7478");
    annotation(["2020 observed baseline", `${baselinePoint.absoluteValue.toFixed(1)}°C actual temp`], baselinePoint, 78, -74, "#17202a");

    // Keep the right side clean: the 2100 scenario values are shown in the
    // summary card, so we do not add endpoint arrows or numeric callouts here.
  }

  const hoverLine = g.append("line")
    .attr("class", "hover-line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .style("opacity", 0);

  const hoverDots = {};
  for (const scenario of scenarioOrder) {
    if (!seriesByScenario[scenario]) continue;
    hoverDots[scenario] = g.append("circle")
      .attr("class", "hover-dot")
      .attr("r", 4.5)
      .attr("fill", color(scenario))
      .style("opacity", 0);
  }
  hoverDots.observed = g.append("circle")
    .attr("class", "hover-dot")
    .attr("r", 4.5)
    .attr("fill", "#6f7478")
    .style("opacity", 0);

  const hoverRect = g.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .style("pointer-events", "none");

  function enableHover() {
    // Keep the transparent hover layer above annotations/callouts so the
    // 2020 and 2021 regions remain hoverable even when labels overlap them.
    hoverRect.raise();
    hoverLine.raise();
    Object.values(hoverDots).forEach((dot) => dot.raise().style("pointer-events", "none"));
    hoverRect.style("pointer-events", "all");
    hoverRect
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event, this);
        const yearAtMouse = Math.round(x.invert(mx));
        const clamped = Math.max(OBS_START_YEAR, Math.min(END_YEAR, yearAtMouse));
        const xPos = x(clamped);

        hoverLine.attr("x1", xPos).attr("x2", xPos).style("opacity", 1);

        const lines = [`<h3>${clamped}</h3>`];

        if (clamped <= START_YEAR) {
          const point = observedRows.find((d) => d.year === clamped);
          if (point) {
            hoverDots.observed
              .attr("cx", xPos)
              .attr("cy", y(point.value))
              .style("opacity", 1);
            const sign = point.value >= 0 ? "+" : "";
            lines.push(`<p>Observed change from 2000: <strong>${sign}${point.value.toFixed(2)}°C</strong></p>`);
          }
        } else {
          hoverDots.observed.style("opacity", 0);
        }

        if (clamped >= START_YEAR) {
          lines.push(`<p class="tooltip-muted">The shaded 2020 band marks the NOAA observation → CMIP6 source gap. Solid lines stay measured from observed 2020.</p>`);
          for (const scenario of scenarioOrder) {
            const series = seriesByScenario[scenario];
            if (!series) continue;
            const point = series.find((d) => d.year === clamped);
            if (!point) continue;
            const sign = point.futureDelta >= 0 ? "+" : "";
            const c = color(scenario);
            hoverDots[scenario]
              .attr("cx", xPos)
              .attr("cy", y(point.value))
              .style("opacity", 1);
            lines.push(
              `<p><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px;"></span>` +
              `${scenarioLabels[scenario]} vs observed 2020: <strong>${sign}${point.futureDelta.toFixed(2)}°C</strong></p>`
            );
          }
        } else {
          for (const scenario of scenarioOrder) {
            hoverDots[scenario]?.style("opacity", 0);
          }
        }

        tooltip
          .html(lines.join(""))
          .style("left", `${event.clientX + 14}px`)
          .style("top", `${event.clientY + 14}px`)
          .attr("hidden", null);
      })
      .on("mouseleave", function () {
        hoverLine.style("opacity", 0);
        Object.values(hoverDots).forEach((d) => d.style("opacity", 0));
        tooltip.attr("hidden", true);
      });
  }

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Grey line: NOAA observed 2000–2020. Shaded band marks the 2020 NOAA ↔ CMIP6 source gap. Solid colored lines show CMIP6 scenarios compared with observed 2020.");
}

function renderTextBreak() {
  hideMapYearOverlay();
  setVizMode("text-break");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const g = svg.append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`)
    .attr("opacity", 0);

  g.append("text")
    .attr("class", "text-break-svg-title")
    .attr("text-anchor", "middle")
    .attr("font-size", 42)
    .attr("y", -50)
    .text("Average temperature smooths");

  g.append("text")
    .attr("class", "text-break-svg-title")
    .attr("text-anchor", "middle")
    .attr("font-size", 42)
    .attr("y", 0)
    .text("the real situation.");

  g.append("text")
    .attr("class", "text-break-svg-body")
    .attr("text-anchor", "middle")
    .attr("font-size", 16)
    .attr("y", 52)
    .text("A yearly average blends comfortable days and extreme days into one number.");

  g.append("text")
    .attr("class", "text-break-svg-body")
    .attr("text-anchor", "middle")
    .attr("font-size", 16)
    .attr("y", 80)
    .text("But people experience heat as specific days.");

  g.transition()
    .duration(500)
    .attr("opacity", 1);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Transition: from average warming to daily heat risk.");
}

function renderTranslationCard() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("translation-card");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const stats = getTranslationStats();

  if (!stats) {
    mapNote.text("No translation data available for 2100 under high emissions.");
    return;
  }

  const avgChange = stats.avgChange;
  const hotDays = Math.max(0, stats.hotDaysChange);
  const hotDaysRounded = Math.round(hotDays);
  const weeks = hotDays / 7;

  const g = svg.append("g")
    .attr("class", "translation-card-viz")
    .attr("transform", "translate(0,0)");

  const cardX = 18;
  const cardY = 22;
  const cardW = width - 36;
  const cardH = height - 44;
  const leftX = cardX + 36;
  const rightX = cardX + 452;
  const arrowX = cardX + 330;
  const topY = cardY + 30;

  // Background card
  g.append("rect")
    .attr("x", cardX)
    .attr("y", cardY)
    .attr("width", cardW)
    .attr("height", cardH)
    .attr("rx", 26)
    .attr("fill", "rgba(255, 255, 255, 0.84)")
    .attr("stroke", "rgba(23, 32, 42, 0.10)");

  // Left: average warming thermometer/gauge
  g.append("text")
    .attr("x", leftX)
    .attr("y", topY)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text("ANNUAL WARMING");

  g.append("text")
    .attr("x", leftX)
    .attr("y", topY + 46)
    .attr("fill", "#17202a")
    .attr("font-size", 44)
    .attr("font-weight", 900)
    .attr("letter-spacing", "-0.055em")
    .text(`${d3.format("+.1f")(avgChange)}°C`);

  g.append("text")
    .attr("x", leftX)
    .attr("y", topY + 70)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("aligned with Plot 01, SSP585 by 2100");

  const gaugeX = leftX + 36;
  const gaugeY = topY + 122;
  const gaugeH = 172;
  const gaugeW = 34;
  const gaugeMax = Math.max(4, Math.ceil(avgChange));
  const fillH = Math.max(8, Math.min(gaugeH, (avgChange / gaugeMax) * gaugeH));
  const baselineY = gaugeY + gaugeH;

  g.append("rect")
    .attr("x", gaugeX)
    .attr("y", gaugeY)
    .attr("width", gaugeW)
    .attr("height", gaugeH)
    .attr("rx", 18)
    .attr("fill", "#f3f0ed")
    .attr("stroke", "rgba(23,32,42,0.18)");

  g.append("circle")
    .attr("cx", gaugeX + gaugeW / 2)
    .attr("cy", gaugeY + gaugeH + 25)
    .attr("r", 30)
    .attr("fill", "#f3f0ed")
    .attr("stroke", "rgba(23,32,42,0.18)");

  g.append("line")
    .attr("x1", gaugeX - 10)
    .attr("x2", gaugeX + 94)
    .attr("y1", baselineY)
    .attr("y2", baselineY)
    .attr("stroke", "#8f2f1b")
    .attr("stroke-width", 1.3)
    .attr("stroke-dasharray", "4 4")
    .attr("opacity", 0)
    .transition()
    .delay(250)
    .duration(450)
    .attr("opacity", 0.82);

  const baselineLabel = g.append("g")
    .attr("transform", `translate(${gaugeX + 108},${baselineY - 14})`)
    .attr("opacity", 0);

  baselineLabel.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.04em")
    .text("OBSERVED 2020");

  baselineLabel.append("text")
    .attr("x", 0)
    .attr("y", 16)
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .text(`${d3.format(".1f")(stats.observed2020AnnualTemp)}°C annual temp`);

  baselineLabel.transition()
    .delay(300)
    .duration(450)
    .attr("opacity", 1);

  const fillRect = g.append("rect")
    .attr("x", gaugeX + 5)
    .attr("y", gaugeY + gaugeH)
    .attr("width", gaugeW - 10)
    .attr("height", 0)
    .attr("rx", 12)
    .attr("fill", "#c4512c");

  fillRect.transition()
    .duration(900)
    .ease(d3.easeCubicOut)
    .attr("y", gaugeY + gaugeH - fillH)
    .attr("height", fillH);

  g.append("circle")
    .attr("cx", gaugeX + gaugeW / 2)
    .attr("cy", gaugeY + gaugeH + 25)
    .attr("r", 22)
    .attr("fill", "#c4512c")
    .attr("opacity", 0)
    .transition()
    .delay(450)
    .duration(550)
    .attr("opacity", 1);

  // Middle arrow / translation phrase
  const arrow = g.append("g")
    .attr("class", "translation-arrow")
    .attr("opacity", 0)
    .attr("transform", `translate(${arrowX},${cardY + 270})`);

  arrow.append("line")
    .attr("x1", -72)
    .attr("x2", 72)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", "#8f2f1b")
    .attr("stroke-width", 3)
    .attr("stroke-linecap", "round");

  arrow.append("path")
    .attr("d", "M70,-8 L88,0 L70,8 Z")
    .attr("fill", "#8f2f1b");

  arrow.append("text")
    .attr("x", 0)
    .attr("y", -16)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.07em")
    .text("TRANSLATED INTO DAILY HEAT");

  arrow.transition()
    .delay(550)
    .duration(500)
    .attr("opacity", 1);

  // Right: month-based calendar for additional 35C+ days
  g.append("text")
    .attr("x", rightX)
    .attr("y", topY)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text("EXTRA 35°C+ DAYS BY MONTH");

  g.append("text")
    .attr("x", rightX)
    .attr("y", topY + 46)
    .attr("fill", "#17202a")
    .attr("font-size", 44)
    .attr("font-weight", 900)
    .attr("letter-spacing", "-0.055em")
    .text(`${d3.format("+.0f")(hotDaysRounded)} days`);

  g.append("text")
    .attr("x", rightX)
    .attr("y", topY + 70)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text(`distributed across months by monthly hot-day deltas`);

  const calX = rightX - 4;
  const calY = topY + 106;
  const monthCardW = 90;
  const monthCardH = 66;
  const monthGapX = 10;
  const monthGapY = 10;
  const monthCols = 4;
  const blockSize = 6.6;
  const blockGap = 2.8;
  const blocksPerRow = 7;

  const monthBlocks = stats.monthlyHotDayBlocks || distributeBlocksAcrossMonths([], hotDaysRounded);
  const monthValues = stats.monthlyHotDayValues || d3.range(1, 13).map((month) => ({ month, value: 0 }));
  const monthValueByMonth = new Map(monthValues.map((d) => [d.month, d.value]));

  const monthCards = d3.range(1, 13).map((month, i) => ({
    month,
    label: monthShortName(month),
    blocks: monthBlocks.find((d) => d.month === month)?.blocks || 0,
    value: monthValueByMonth.get(month) || 0,
    x: calX + (i % monthCols) * (monthCardW + monthGapX),
    y: calY + Math.floor(i / monthCols) * (monthCardH + monthGapY),
  }));

  const monthWrap = g.append("g")
    .attr("class", "month-calendar")
    .attr("opacity", 0);

  const monthGroups = monthWrap.selectAll("g.month-card")
    .data(monthCards)
    .join("g")
    .attr("class", "month-card")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  monthGroups.append("rect")
    .attr("width", monthCardW)
    .attr("height", monthCardH)
    .attr("rx", 12)
    .attr("fill", (d) => d.blocks > 0 ? "rgba(196,81,44,0.065)" : "rgba(255,255,255,0.70)")
    .attr("stroke", (d) => d.blocks > 0 ? "rgba(196,81,44,0.22)" : "rgba(23,32,42,0.10)");

  monthGroups.append("text")
    .attr("x", 8)
    .attr("y", 14)
    .attr("fill", (d) => d.blocks > 0 ? "#8f2f1b" : "#7a858d")
    .attr("font-size", 9.5)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.04em")
    .text((d) => d.label.toUpperCase());

  monthGroups.append("text")
    .attr("x", monthCardW - 8)
    .attr("y", 14)
    .attr("text-anchor", "end")
    .attr("fill", (d) => d.blocks > 0 ? "#c4512c" : "#9aa3aa")
    .attr("font-size", 9.5)
    .attr("font-weight", 900)
    .text((d) => d.blocks > 0 ? `+${d.blocks}` : "0");

  const blockData = monthCards.flatMap((monthCard) =>
    d3.range(monthCard.blocks).map((j) => ({
      ...monthCard,
      blockIndex: j,
      bx: 10 + (j % blocksPerRow) * (blockSize + blockGap),
      by: 25 + Math.floor(j / blocksPerRow) * (blockSize + blockGap),
    }))
  );

  monthWrap.selectAll("rect.month-day-block")
    .data(blockData)
    .join("rect")
    .attr("class", "month-day-block")
    .attr("x", (d) => d.x + d.bx)
    .attr("y", (d) => d.y + d.by)
    .attr("width", blockSize)
    .attr("height", blockSize)
    .attr("rx", 1.5)
    .attr("fill", "#c4512c")
    .attr("opacity", 0)
    .transition()
    .delay((d, i) => 800 + i * 28)
    .duration(220)
    .attr("opacity", 0.86);

  monthWrap.transition()
    .delay(650)
    .duration(350)
    .attr("opacity", 1);

  const monthNote = g.append("text")
    .attr("x", calX)
    .attr("y", calY + 3 * monthCardH + 2 * monthGapY + 24)
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("opacity", 0);

  [
    "Blocks wrap after 7 per row; more filled blocks mean",
    "more projected extra hot days in that month."
  ].forEach((line, i) => {
    monthNote.append("tspan")
      .attr("x", calX)
      .attr("dy", i === 0 ? 0 : 14)
      .text(line);
  });

  monthNote.transition()
    .delay(1550)
    .duration(450)
    .attr("opacity", 1);

  const takeaway = g.append("text")
    .attr("x", width / 2)
    .attr("y", cardY + cardH - 28)
    .attr("text-anchor", "middle")
    .attr("fill", "#17202a")
    .attr("font-size", 15)
    .attr("font-weight", 800)
    .attr("opacity", 0)
    .text("The same 2100 high-emissions future is small in degrees, but tangible as calendar days.");

  takeaway.transition()
    .delay(1600)
    .duration(600)
    .attr("opacity", 1);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .html("°C figure: baseline-aligned with Plot 01.<br>Days figure: direct additional 35°C+ days from observed 2020.");
}


function distributeBlocksAcrossMonths(monthValues, totalBlocks) {
  const cleanTotal = Math.max(0, Math.round(totalBlocks || 0));
  const baseMonths = d3.range(1, 13).map((month) => {
    const found = monthValues.find((d) => d.month === month);
    return {
      month,
      value: Math.max(0, found?.value || 0),
    };
  });

  const totalValue = d3.sum(baseMonths, (d) => d.value);

  // If monthly values are missing, put the blocks into the main summer months
  // so the calendar remains readable instead of failing silently.
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    const summerMonths = [6, 7, 8];
    const even = Math.floor(cleanTotal / summerMonths.length);
    let remainder = cleanTotal - even * summerMonths.length;
    return baseMonths.map((d) => {
      if (!summerMonths.includes(d.month)) return { month: d.month, blocks: 0, value: 0 };
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return { month: d.month, blocks: even + extra, value: even + extra };
    });
  }

  const allocated = baseMonths.map((d) => {
    const exact = (d.value / totalValue) * cleanTotal;
    return {
      ...d,
      exact,
      blocks: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let remaining = cleanTotal - d3.sum(allocated, (d) => d.blocks);
  allocated
    .slice()
    .sort((a, b) => d3.descending(a.remainder, b.remainder) || d3.ascending(a.month, b.month))
    .forEach((d) => {
      if (remaining <= 0) return;
      const original = allocated.find((m) => m.month === d.month);
      original.blocks += 1;
      remaining -= 1;
    });

  return allocated.map((d) => ({
    month: d.month,
    value: d.value,
    blocks: d.blocks,
  }));
}

function getMonthlyHotDayDistributionForTranslation(totalBlocks) {
  const monthlyRows = monthlyData.filter((d) =>
    d.scenario === "ssp585" &&
    d.year >= 2020 && d.year <= 2100 &&
    Number.isFinite(getMonthNumber(d)) &&
    Number.isFinite(getMonthlyHotDaysValue(d))
  );

  if (!monthlyRows.length) {
    const fallbackValues = d3.range(1, 13).map((month) => ({ month, value: 0 }));
    return {
      monthlyHotDayValues: fallbackValues,
      monthlyHotDayBlocks: distributeBlocksAcrossMonths(fallbackValues, totalBlocks),
    };
  }

  const monthlyYearMeans = Array.from(
    d3.rollup(
      monthlyRows,
      (v) => ({
        year: v[0].year,
        month: getMonthNumber(v[0]),
        value: d3.mean(v, (d) => getMonthlyHotDaysValue(d)),
      }),
      (d) => getMonthNumber(d),
      (d) => d.year
    ),
    ([month, yearMap]) => ({
      month,
      values: Array.from(yearMap.values()).sort((a, b) => d3.ascending(a.year, b.year)),
    })
  );

  const monthValues = d3.range(1, 13).map((month) => {
    const monthSeries = monthlyYearMeans.find((d) => d.month === month)?.values || [];
    const rolling = addCenteredRollingAverage(
      monthSeries.map((d) => ({ year: d.year, value: Math.max(0, d.value) })),
      "value",
      5
    );
    const endpoint = rolling.find((d) => d.year === 2100);
    return {
      month,
      value: Math.max(0, endpoint?.value || 0),
    };
  });

  return {
    monthlyHotDayValues: monthValues,
    monthlyHotDayBlocks: distributeBlocksAcrossMonths(monthValues, totalBlocks),
  };
}

function getTranslationStats() {
  // Keep Plot 05 consistent with the CURRENT Plot 01 visual logic.
  // Plot 01 first shows the raw CMIP6 2020 source offset, then visually aligns
  // each scenario line to the observed 2020 rolling value. Therefore, the Plot 05
  // temperature figure should use the aligned high-emissions 2100 value, not the
  // raw CMIP6 value that still includes the 2020 source offset.
  const lineStats = getNationalAverageRows();
  const observed2020 = lineStats.baselinePoint;
  const high2020 = lineStats.projectedRows.find((d) =>
    d.scenario === "ssp585" && d.year === START_YEAR && Number.isFinite(d.value)
  );
  const high2100 = lineStats.projectedRows.find((d) =>
    d.scenario === "ssp585" && d.year === END_YEAR && Number.isFinite(d.value)
  );

  if (
    !observed2020 || !high2020 || !high2100 ||
    !Number.isFinite(observed2020.value) ||
    !Number.isFinite(high2020.value) ||
    !Number.isFinite(high2100.value)
  ) {
    return null;
  }

  const sourceGap = high2020.value - observed2020.value;
  const high2100AlignedAnnualTemp = high2100.value - sourceGap;
  const avgChange = high2100AlignedAnnualTemp - observed2020.value;

  const hotRows = stateData.filter((d) =>
    d.scenario === "ssp585" &&
    d.year >= 2020 && d.year <= 2100 &&
    Number.isFinite(d.summer_hot_days_35c_change_from_observed_2020)
  );

  if (!hotRows.length) return null;

  const hotByYear = Array.from(
    d3.rollup(
      hotRows,
      (v) => ({
        year: v[0].year,
        hotDaysChangeRaw: d3.mean(v, (d) => d.summer_hot_days_35c_change_from_observed_2020),
      }),
      (d) => d.year
    ).values()
  ).sort((a, b) => d3.ascending(a.year, b.year));

  const hotRolling = addCenteredRollingAverage(
    hotByYear.map((d) => ({ year: d.year, value: d.hotDaysChangeRaw })),
    "value",
    5
  );

  const hot2100 = hotRolling.find((d) => d.year === 2100);

  if (!hot2100) return null;

  const monthlyDistribution = getMonthlyHotDayDistributionForTranslation(Math.round(Math.max(0, hot2100.value)));

  return {
    avgChange,
    hotDaysChange: hot2100.value,
    avgRollingWindow: high2100.rollingWindow,
    hotDaysRollingWindow: hot2100.rollingWindow,
    observed2020AnnualTemp: lineStats.baselineRawPoint?.absoluteValue ?? observed2020.value,
    high2100AnnualTemp: high2100AlignedAnnualTemp,
    plot01SourceGap: sourceGap,
    ...monthlyDistribution,
  };
}

function renderCompareLineChart() {
  hideTrendSummary(); 
  hideMapYearOverlay();
  setVizMode("compare-line");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const margin = { top: 42, right: 170, bottom: 54, left: 68 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const rows = getCompareRows();

  if (!rows.length) {
    mapNote.text("No comparison data available.");
    return;
  }

  const x = d3.scaleLinear()
    .domain(d3.extent(rows, (d) => d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(["Average warming delta", "35°C+ days delta"])
    .range(["#4f8fc0", "#c4512c"]);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .selectAll("line")
    .attr("stroke", "rgba(23, 32, 42, 0.10)");

  g.select(".grid .domain").remove();

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .ticks(6)
        .tickFormat(d3.format("d"))
    );

  g.append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickFormat((d) => `${Math.round(d * 100)}%`)
    );

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 42)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Year");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Normalized change since observed 2020");

  const line = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.normalized))
    .curve(d3.curveMonotoneX);

  const grouped = d3.group(rows, (d) => d.series);

  let pathsAnimating = 0;

  for (const [series, seriesRows] of grouped) {
      const pathLine = g.append("path")
        .datum(seriesRows)
        .attr("fill", "none")
        .attr("stroke", color(series))
        .attr("stroke-width", 3)
        .attr("d", line);

      const totalLength = pathLine.node().getTotalLength();
      pathsAnimating += 1;

      pathLine
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0)
        .on("end", () => {
          pathsAnimating -= 1;
          if (pathsAnimating === 0) {
            setTimeout(() => showCompareSummary(grouped), 300);
          }
        });

    const last = seriesRows[seriesRows.length - 1];

    g.append("text")
      .attr("x", x(last.year) + 10)
      .attr("y", y(last.normalized))
      .attr("dominant-baseline", "middle")
      .attr("fill", color(series))
      .attr("font-size", 12)
      .attr("font-weight", 900)
      .text(series);
  }

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Both lines are normalized so different units can be compared.");
}

// step8impact
function renderImpactPlaceholder() {
  hideMapYearOverlay();

  const summaryEl = document.getElementById("trend-summary");
  if (summaryEl) {
    summaryEl.classList.remove("is-active", "is-visible");
    summaryEl.style.display = "none";
    const rowsEl = document.getElementById("trend-summary-rows");
    if (rowsEl) rowsEl.innerHTML = "";
  }

  setVizMode("impact-placeholder");
  svg.selectAll("*").remove();
  legendContainer.html("");

  title.text("What changes when hot days add up?");
  subtitle.text("Four daily-life impacts of the extra heat days projected for California by 2050.");

  svg.style("display", "none");

  const chartWrap = d3.select(".chart-wrap");
  chartWrap.selectAll(".impact-fill").remove();

  const container = chartWrap.append("div")
    .attr("class", "impact-fill")
    .style("opacity", 0);

  container.html(`
    <div class="impact-viz-content">
      <div class="impact-viz-rows">
        <div class="impact-viz-row">
          <div class="ivr-num">01</div>
          <div class="ivr-body">
            <div class="ivr-head">
              <span class="ivr-label">SLEEP</span>
              <span class="ivr-stat">&minus;11 <span class="ivr-unit">hrs / yr</span></span>
            </div>
            <p class="ivr-desc">Warm nights shorten sleep. By 2099 the gap could double &mdash; the West Coast hit roughly twice as hard as inland.</p>
            <p class="ivr-cite">Minor et al. (2022), <i>One Earth</i></p>
          </div>
        </div>

        <div class="impact-viz-row">
          <div class="ivr-num">02</div>
          <div class="ivr-body">
            <div class="ivr-head">
              <span class="ivr-label">LEARNING</span>
              <span class="ivr-stat">&minus;5% <span class="ivr-unit">of a school year</span></span>
            </div>
            <p class="ivr-desc">Days above 90&deg;F lower PSAT scores. Without AC the loss is ~30% larger, and 3&times; larger for Black and Hispanic students.</p>
            <p class="ivr-cite">Park, Goodman et al. (2020), <i>AEJ</i></p>
          </div>
        </div>

        <div class="impact-viz-row">
          <div class="ivr-num">03</div>
          <div class="ivr-body">
            <div class="ivr-head">
              <span class="ivr-label">COOLING COST</span>
              <span class="ivr-stat">+$200 <span class="ivr-unit">/ summer</span></span>
            </div>
            <p class="ivr-desc">AC alone can add $72&ndash;$108 a month per household &mdash; and 1 in 5 low-income U.S. households have no AC at all.</p>
            <p class="ivr-cite">U.S. EIA (2024)</p>
          </div>
        </div>

        <div class="impact-viz-row">
          <div class="ivr-num">04</div>
          <div class="ivr-body">
            <div class="ivr-head">
              <span class="ivr-label">ER VISITS</span>
              <span class="ivr-stat">+35k <span class="ivr-unit">/ summer statewide</span></span>
            </div>
            <p class="ivr-desc">Hot days drive cardiovascular, respiratory, and mental-health ER visits &mdash; costing roughly $1B per summer nationally.</p>
            <p class="ivr-cite">Stanford / UCSD (2025)</p>
          </div>
        </div>
      </div>

      <div class="impact-viz-equity">
        <span class="ive-tag">BUT NOT EVERYONE FEELS IT EQUALLY</span>
        <p>Low-income students lose <em>3&times;</em> more learning. Outdoor workers lose <em>14%</em> of their labor capacity above 90&deg;F. <em>1 in 5</em> households can't afford to turn on AC.</p>
      </div>
    </div>
  `);

  container.transition()
    .duration(500)
    .style("opacity", 1);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("The impact of high emissions by 2100 on people's lives");
}
// step8impact

function addCenteredRollingAverage(rows, valueKey = "value", windowSize = 5) {
  const halfWindow = Math.floor(windowSize / 2);
  return rows.map((d, i) => {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(rows.length, i + halfWindow + 1);
    const windowRows = rows.slice(start, end);
    return {
      ...d,
      rawValue: d[valueKey],
      value: d3.mean(windowRows, (r) => r[valueKey]),
      rollingWindow: windowRows.length,
    };
  }).filter((d) => Number.isFinite(d.value));
}

function getNationalAverageRows() {
  // Plot 01 uses AVERAGE ANNUAL temperature, not temperature change.
  // We derive annual values from the monthly story file already in data/:
  //   annual_tas = mean(monthly_tas_c for Jan-Dec)
  // Then we smooth the annual temperature series with a centered 5-year
  // rolling average. Endpoint windows use available years.
  const monthlyAnnualRows = buildAnnualTemperatureRowsFromMonthly(allMonthlyData);
  const useMonthlyDerivedAnnual = monthlyAnnualRows.some((d) =>
    d.data_source === "observed" && Number.isFinite(d.annual_tas_c)
  ) && monthlyAnnualRows.some((d) =>
    d.data_source !== "observed" && scenarioOrder.includes(d.scenario) && Number.isFinite(d.annual_tas_c)
  );

  let annualRowsForPlot = monthlyAnnualRows;

  // Fallback only if monthly story data is missing or malformed.
  if (!useMonthlyDerivedAnnual) {
    const observedAnnualAvailable = annualStoryData.some((d) =>
      d.data_source === "observed" && Number.isFinite(d.tas_c)
    );
    const projectedAnnualAvailable = annualStateData.some((d) =>
      d.data_source === "projected" && Number.isFinite(d.tas_c)
    );

    if (observedAnnualAvailable && projectedAnnualAvailable) {
      annualRowsForPlot = annualStoryData
        .filter((d) => Number.isFinite(d.tas_c))
        .map((d) => ({
          data_source: d.data_source,
          scenario: d.scenario,
          scenario_label: d.scenario_label,
          year: d.year,
          annual_tas_c: d.tas_c,
        }));
    } else {
      // Last-resort fallback: use summer average temperature if no annual data exists.
      annualRowsForPlot = allStoryData
        .filter((d) => Number.isFinite(d.summer_tas_c))
        .map((d) => ({
          data_source: d.data_source,
          scenario: d.scenario,
          scenario_label: d.scenario_label,
          year: d.year,
          annual_tas_c: d.summer_tas_c,
        }));
    }
  }

  const temperatureScope = useMonthlyDerivedAnnual ? "annual" : "summer";

  const observedRaw = d3.rollups(
    annualRowsForPlot.filter((d) =>
      d.data_source === "observed" &&
      Number.isFinite(d.annual_tas_c)
    ),
    (v) => d3.mean(v, (d) => d.annual_tas_c),
    (d) => d.year
  ).map(([year, absoluteValue]) => ({
    series: "observed",
    scenario: "observed",
    year,
    absoluteValue,
    yearlyValue: absoluteValue,
    value: absoluteValue,
    temperatureScope,
  }))
    .filter((d) => d.year >= OBS_START_YEAR && d.year <= START_YEAR && Number.isFinite(d.absoluteValue))
    .sort((a, b) => d3.ascending(a.year, b.year));

  const observedYearlyRows = observedRaw.map((d) => ({
    ...d,
    yearlyValue: d.absoluteValue,
    value: d.absoluteValue,
    delta: NaN,
  }));

  const observedRows = addCenteredRollingAverage(observedYearlyRows, "yearlyValue", 5);

  const baselineRawPoint = observedYearlyRows.find((d) => d.year === START_YEAR);
  const baselinePoint = observedRows.find((d) => d.year === START_YEAR) || baselineRawPoint;
  const observed2020Absolute = baselineRawPoint?.absoluteValue;

  const projectedYearlyRows = d3.rollups(
    annualRowsForPlot.filter((d) =>
      d.data_source !== "observed" &&
      scenarioOrder.includes(d.scenario) &&
      Number.isFinite(d.annual_tas_c)
    ),
    (v) => d3.mean(v, (d) => d.annual_tas_c),
    (d) => d.scenario,
    (d) => d.year
  ).flatMap(([scenario, yearValues]) => {
    return yearValues.map(([year, absoluteValue]) => ({
      series: scenario,
      scenario,
      year,
      absoluteValue,
      yearlyValue: absoluteValue,
      value: absoluteValue,
      deltaFromObserved2020: Number.isFinite(observed2020Absolute) ? absoluteValue - observed2020Absolute : NaN,
      temperatureScope,
    }))
      .filter((d) => scenarioOrder.includes(d.scenario) && d.year >= START_YEAR && d.year <= END_YEAR)
      .sort((a, b) => d3.ascending(a.year, b.year));
  });

  const projectedRows = [];
  for (const scenario of scenarioOrder) {
    const scenarioRows = projectedYearlyRows.filter((d) => d.scenario === scenario);
    const rolledRows = addCenteredRollingAverage(scenarioRows, "yearlyValue", 5);
    const modelStartValue = rolledRows.find((d) => d.year === START_YEAR)?.value;
    const sourceGap = Number.isFinite(modelStartValue) && Number.isFinite(observed2020Absolute)
      ? modelStartValue - observed2020Absolute
      : NaN;

    projectedRows.push(...rolledRows.map((d) => ({
      ...d,
      rawDeltaFromObserved2020: d.deltaFromObserved2020,
      futureDelta: Number.isFinite(observed2020Absolute) ? d.value - observed2020Absolute : NaN,
      delta: Number.isFinite(observed2020Absolute) ? d.value - observed2020Absolute : NaN,
      modelStartVisualValue: modelStartValue,
      sourceGap,
      temperatureScope,
    })));
  }

  projectedRows.sort((a, b) => d3.ascending(a.year, b.year));

  return {
    observedRows,
    observedYearlyRows,
    projectedRows,
    baselinePoint,
    baselineRawPoint,
    temperatureScope,
    useAnnual: temperatureScope === "annual",
  };
}

function buildAnnualTemperatureRowsFromMonthly(rows) {
  if (!rows || !rows.length) return [];

  // First average months within each state/year/scenario, then average states.
  // This preserves the state-level structure before forming the national trend.
  const stateAnnualRows = d3.rollups(
    rows.filter((d) => Number.isFinite(d.monthly_tas_c)),
    (v) => d3.mean(v, (d) => d.monthly_tas_c),
    (d) => d.data_source,
    (d) => d.scenario,
    (d) => d.year,
    (d) => d.state
  ).flatMap(([data_source, scenarioGroups]) =>
    scenarioGroups.flatMap(([scenario, yearGroups]) =>
      yearGroups.flatMap(([year, stateGroups]) =>
        stateGroups.map(([state, annual_tas_c]) => ({
          data_source,
          scenario,
          year,
          state,
          annual_tas_c,
        }))
      )
    )
  );

  return stateAnnualRows;
}

function getCompareRows() {
  const scenario = "ssp585";

  const avgRows = d3.rollups(
    tasData.filter((d) => d.scenario === scenario),
    (v) => d3.mean(v, (d) => d.summer_tas_c_change_from_observed_2020),
    (d) => d.year
  ).map(([year, value]) => ({
    year,
    rawValue: value,
    series: "Average warming delta",
  }));

  const hotRows = d3.rollups(
    stateData.filter((d) => d.scenario === scenario),
    (v) => d3.mean(v, (d) => d.summer_hot_days_35c_change_from_observed_2020),
    (d) => d.year
  ).map(([year, value]) => ({
    year,
    rawValue: value,
    series: "35°C+ days delta",
  }));

  const normalizeSeries = (rows) => {
    const maxValue = d3.max(rows, (d) => Math.abs(d.rawValue)) || 1;
    return rows.map((d) => ({
      ...d,
      normalized: Math.max(0, d.rawValue / maxValue),
    }));
  };

  return [
    ...normalizeSeries(avgRows),
    ...normalizeSeries(hotRows),
  ]
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.normalized))
    .sort((a, b) => d3.ascending(a.year, b.year));
}

function renderMap(transitionDuration = 750) {
  setVizMode("map");

  let mapG = svg.select("g.map-layer");

  if (mapG.empty()) {
    svg.selectAll("*").remove();
    mapG = svg.append("g").attr("class", "map-layer");
  }

  const filtered = stateData.filter((d) =>
    d.year === currentState.year &&
    d.scenario === currentState.scenario
  );

  const dataByState = new Map(
    filtered.map((d) => [normalizeStateName(d.state), d])
  );

  const metric = currentState.metric;
  const values = filtered
    .map((d) => d[metric])
    .filter((v) => Number.isFinite(v));

  const color = getColorScale(metric, values);
  const topStates = getTopStates(filtered, metric, 5);

  const paths = mapG.selectAll("path")
    .data(statesGeo.features, getFeatureStateName)
    .join(
      (enter) =>
        enter.append("path")
          .attr("class", "state")
          .attr("d", path)
          .attr("fill", "#e3e8ea")
          .attr("opacity", 1)
          .on("mousemove", function (event, feature) {
            const stateName = getFeatureStateName(feature);
            const row = dataByState.get(normalizeStateName(stateName));
            showTooltip(event, stateName, row, metric);
          })
          .on("mouseleave", hideTooltip)
          .on("click", function (event, feature) {
            const stateName = getFeatureStateName(feature);
            const row = dataByState.get(normalizeStateName(stateName));

            selectedStateName = normalizeStateName(stateName);

            if (!statePicker.empty()) {
              statePicker.property("value", selectedStateName);
            }

            updateSelectedStateCard(stateName, row);
            renderMap();
          }),
      (update) => update
    );

  paths
    .classed("highlighted", (feature) => {
      const setting = stepSettings[currentStep];
      if (setting?.highlight !== "top") return false;

      const stateName = normalizeStateName(getFeatureStateName(feature));
      return topStates.has(stateName);
    })
    .classed("selected", (feature) => {
      const stateName = normalizeStateName(getFeatureStateName(feature));
      return selectedStateName === stateName;
    })
    .transition()
    .duration(transitionDuration)
    .ease(d3.easeCubicOut)
    .attr("fill", (feature) => {
      const stateName = getFeatureStateName(feature);
      const row = dataByState.get(normalizeStateName(stateName));
      const value = row?.[metric];

      if (!Number.isFinite(value)) return "#e3e8ea";
      return color(value);
    })
    .attr("opacity", (feature) => {
      const setting = stepSettings[currentStep];

      if (setting?.highlight !== "top") return 1;

      const stateName = normalizeStateName(getFeatureStateName(feature));
      return topStates.has(stateName) || selectedStateName === stateName ? 1 : 0.48;
    });

  drawLegend(color, metric);
  updateMapNote(filtered, metric);
  drawMapYearLabel();

  if (selectedStateName) {
    const selectedRow = dataByState.get(selectedStateName);
    updateSelectedStateCard(selectedStateName, selectedRow);
  }
}

function startMapYearAnimation(setting) {
  const startYear = setting.animationStartYear ?? START_YEAR;
  const endYear = setting.animationEndYear ?? END_YEAR;
  const stepYears = setting.animationStepYears ?? 2;
  const frameDelay = setting.animationFrameDelay ?? 300;

  let year = startYear;

  currentState.year = year;
  currentState.scenario = setting.scenario;
  currentState.metric = setting.metric;

  syncControls();
  renderMap(0);

  mapAnimationTimer = d3.interval(() => {
    year += stepYears;

    if (year > endYear) {
      year = endYear;
    }

    currentState.year = year;
    syncControls();
    renderMap(260);

    if (year >= endYear) {
      cancelMapAnimation();

      currentState.year = endYear;
      syncControls();
      renderMap(650);
      updateSelectedStateFromCurrentView(false);
    }
  }, frameDelay);
}

function cancelMapAnimation() {
  if (mapAnimationTimer) {
    mapAnimationTimer.stop();
    mapAnimationTimer = null;
  }

  if (!mapYearOverlay.empty()) {
    mapYearOverlay.classed("is-animating", false);
  }
}

function renderMonthlyChart(stateName) {
  if (monthlySvg.empty()) return;

  const chartWidth = 720;
  const chartHeight = 260;
  const margin = { top: 24, right: 24, bottom: 42, left: 48 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  monthlySvg.attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  monthlySvg.selectAll("*").remove();

  if (!stateName) {
    monthlySvg.append("text")
      .attr("class", "monthly-empty-text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight / 2)
      .text("Choose a state to see monthly 35°C+ day deltas.");
    return;
  }

  const rows = monthlyData
    .filter((d) =>
      normalizeStateName(d.state) === normalizeStateName(stateName) &&
      d.year === currentState.year &&
      d.scenario === currentState.scenario
    )
    .map((d) => ({
      ...d,
      monthNumber: getMonthNumber(d),
      hotDays: getMonthlyHotDaysValue(d),
    }))
    .filter((d) =>
      Number.isFinite(d.monthNumber) &&
      Number.isFinite(d.hotDays)
    )
    .sort((a, b) => d3.ascending(a.monthNumber, b.monthNumber));

  if (!rows.length) {
    monthlySvg.append("text")
      .attr("class", "monthly-empty-text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight / 2)
      .text(`No monthly data available for ${stateName}.`);
    return;
  }

  const x = d3.scaleBand()
    .domain(d3.range(1, 13))
    .range([0, innerWidth])
    .padding(0.22);

  const y = d3.scaleLinear()
    .domain([0, Math.max(1, d3.max(rows, (d) => d.hotDays))])
    .nice()
    .range([innerHeight, 0]);

  const g = monthlySvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "grid")
    .call(
      d3.axisLeft(y)
        .ticks(4)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .selectAll("line")
    .attr("stroke", "rgba(23, 32, 42, 0.10)");

  g.select(".grid .domain").remove();

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .tickFormat((d) => monthShortName(d))
    );

  g.append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(y)
        .ticks(4)
        .tickFormat((d) => `${d}`)
    );

  g.append("text")
    .attr("x", 0)
    .attr("y", -8)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 800)
    .text(`${stateName}: monthly 35°C+ day delta in ${currentState.year}`);

  g.append("text")
    .attr("x", innerWidth)
    .attr("y", -8)
    .attr("text-anchor", "end")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 800)
    .text(scenarioLabels[currentState.scenario]);

  g.selectAll(".month-bar")
    .data(rows, (d) => d.monthNumber)
    .join(
      (enter) =>
        enter.append("rect")
          .attr("class", "month-bar")
          .attr("x", (d) => x(d.monthNumber))
          .attr("width", x.bandwidth())
          .attr("y", innerHeight)
          .attr("height", 0)
          .call((enter) =>
            enter.transition()
              .duration(650)
              .ease(d3.easeCubicOut)
              .attr("y", (d) => y(d.hotDays))
              .attr("height", (d) => innerHeight - y(d.hotDays))
          ),
      (update) =>
        update.call((update) =>
          update.transition()
            .duration(650)
            .ease(d3.easeCubicOut)
            .attr("x", (d) => x(d.monthNumber))
            .attr("width", x.bandwidth())
            .attr("y", (d) => y(d.hotDays))
            .attr("height", (d) => innerHeight - y(d.hotDays))
        ),
      (exit) =>
        exit.call((exit) =>
          exit.transition()
            .duration(300)
            .attr("y", innerHeight)
            .attr("height", 0)
            .remove()
        )
    );

  g.selectAll(".bar-label")
    .data(rows.filter((d) => d.hotDays > 0), (d) => d.monthNumber)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(d.monthNumber) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.hotDays) - 6)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 10)
    .attr("font-weight", 800)
    .text((d) => d3.format(".0f")(d.hotDays));
}

function getColorScale(metric, values) {
  if (metric === "summer_tas_c_change_from_observed_2020") {
    return d3.scaleDiverging()
      .domain([-4, 0, 4])
      .interpolator((t) => d3.interpolateRdBu(1 - t))
      .clamp(true);
  }

  if (metric === "summer_hot_days_35c_change_from_observed_2020") {
    return d3.scaleSequential()
      .domain([0, 25])
      .interpolator(d3.interpolateYlOrRd)
      .clamp(true);
  }


  const maxValue = d3.max(values) || 1;

  return d3.scaleSequential()
    .domain([0, maxValue])
    .interpolator(d3.interpolateYlOrRd)
    .clamp(true);
}

function drawLegend(color, metric) {
  legendContainer.attr("class", "placeholder-legend");
  const legendWidth = 280;
  const legendHeight = 48;

  legendContainer.html("");

  const legend = legendContainer
    .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight);

  const defs = legend.append("defs");
  const gradientId = `legend-gradient-${metric}-${currentStep}`;

  const gradient = defs.append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const domain = color.domain();
  const start = domain[0];
  const end = domain[domain.length - 1];

  d3.range(0, 1.01, 0.1).forEach((d) => {
    const value = start + d * (end - start);
    gradient.append("stop")
      .attr("offset", `${d * 100}%`)
      .attr("stop-color", color(value));
  });

  legend.append("rect")
    .attr("x", 8)
    .attr("y", 8)
    .attr("width", legendWidth - 16)
    .attr("height", 12)
    .attr("rx", 6)
    .attr("fill", `url(#${gradientId})`);

  const unit = metricUnits[metric];

  legend.append("text")
    .attr("x", 8)
    .attr("y", 38)
    .attr("font-size", 11)
    .attr("fill", "#555")
    .text(formatValue(start, unit));

  legend.append("text")
    .attr("x", legendWidth - 8)
    .attr("y", 38)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#555")
    .text(formatValue(end, unit));
}

function updateMapNote(filtered, metric) {
  const maxRow = filtered
    .filter((d) => Number.isFinite(d[metric]))
    .sort((a, b) => d3.descending(a[metric], b[metric]))[0];

  if (!maxRow) {
    mapNote.text("Hover over a state to see details.");
    return;
  }

  const setting = stepSettings[currentStep];
  const baseNote = setting?.note || "Hover over a state to see details.";

  mapNote.text(
    `${baseNote} Highest value: ${maxRow.state}, ${formatValue(maxRow[metric], metricUnits[metric])}.`
  );
}

function getTopStates(rows, metric, n) {
  const top = rows
    .filter((d) => Number.isFinite(d[metric]))
    .sort((a, b) => d3.descending(a[metric], b[metric]))
    .slice(0, n)
    .map((d) => normalizeStateName(d.state));

  return new Set(top);
}

function showTooltip(event, stateName, row, metric) {
  if (tooltip.empty()) return;

  const left = Math.min(event.clientX + 16, window.innerWidth - 290);
  const top = Math.min(event.clientY + 16, window.innerHeight - 180);

  if (!row) {
    tooltip
      .attr("hidden", null)
      .style("left", `${left}px`)
      .style("top", `${top}px`)
      .html(`
        <h3>${stateName}</h3>
        <p>No data available.</p>
      `);
    return;
  }

  const avgWarming = row.summer_tas_c_change_from_observed_2020;
  const hotDaysChange = row.summer_hot_days_35c_change_from_observed_2020;
  let tooltipRows = "";

  if (metric === "summer_tas_c_change_from_observed_2020") {
    tooltipRows = `
      <p>Average warming delta: <strong>${formatValue(avgWarming, "°C")}</strong></p>
      <p>35°C+ days delta: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
    `;
  } else if (metric === "summer_hot_days_35c_change_from_observed_2020") {
    tooltipRows = `
      <p>35°C+ days delta: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
      <p>Average warming delta: <strong>${formatValue(avgWarming, "°C")}</strong></p>
    `;
  }

  tooltip
    .attr("hidden", null)
    .style("left", `${left}px`)
    .style("top", `${top}px`)
    .html(`
      <h3>${stateName}</h3>
      <p><strong>${scenarioLabels[currentState.scenario]}</strong>, ${currentState.year}</p>
      ${tooltipRows}
    `);
}

function hideTooltip() {
  if (tooltip.empty()) return;
  tooltip.attr("hidden", true);
}

function setupInitialSelectedStateCard() {
  if (
    selectedStateTitle.empty() ||
    selectedStateSummary.empty() ||
    selectedStateWarming.empty() ||
    selectedStateHotdays.empty() ||
    selectedStateWeeks.empty()
  ) {
    return;
  }

  selectedStateTitle.text("Choose a state.");
  selectedStateSummary.text(
    "Use the dropdown above or click a state in the main map to translate average warming and extreme hot days into a daily-life statement."
  );
  selectedStateWarming.text("[ +X °C ]");
  selectedStateHotdays.text("[ +Y days ]");
  selectedStateWeeks.text("[ about Z extra weeks ]");

  if (!snapshotStateTitle.empty()) {
    snapshotStateTitle.text("No state selected yet");
    snapshotStateText.text(
      "Choose a state here, or click a state in the main map, to connect the national story to a local daily-life summary."
    );
    snapshotScenario.text("—");
    snapshotYear.text("—");
    snapshotMetric.text("—");
  }

  renderMonthlyChart(null);
}

function updateSelectedStateCard(stateName, row) {
  if (
    selectedStateTitle.empty() ||
    selectedStateSummary.empty() ||
    selectedStateWarming.empty() ||
    selectedStateHotdays.empty() ||
    selectedStateWeeks.empty()
  ) {
    return;
  }

  if (!row) {
    selectedStateTitle.text(stateName);
    selectedStateSummary.text("No data available for this state.");
    selectedStateWarming.text("N/A");
    selectedStateHotdays.text("N/A");
    selectedStateWeeks.text("N/A");

    if (!snapshotStateTitle.empty()) {
      snapshotStateTitle.text(stateName);
      snapshotStateText.text("No data available for this state.");
      snapshotScenario.text("—");
      snapshotYear.text("—");
      snapshotMetric.text("—");
    }

    renderMonthlyChart(null);
    return;
  }

  const avgWarming = row.summer_tas_c_change_from_observed_2020;
  const hotDaysChange = row.summer_hot_days_35c_change_from_observed_2020;
  const weeks = Number.isFinite(hotDaysChange) ? hotDaysChange / 7 : NaN;

  selectedStateTitle.text(stateName);

  selectedStateSummary.text(
    `By ${currentState.year} under ${scenarioLabels[currentState.scenario].toLowerCase()}, ${stateName} is projected to have ${formatValue(hotDaysChange, "days")} more days with daily highs above 35°C than in 2020.`
  );

  selectedStateWarming.text(formatValue(avgWarming, "°C"));
  selectedStateHotdays.text(formatValue(hotDaysChange, "days"));
  selectedStateWeeks.text(formatWeeks(weeks));

  if (!snapshotStateTitle.empty()) {
    snapshotStateTitle.text(stateName);
    snapshotStateText.text(
      `${stateName} connects the national pattern to a local question: how much the number of 35°C+ summer days changes from observed 2020?`
    );
    snapshotScenario.text(scenarioLabels[currentState.scenario]);
    snapshotYear.text(currentState.year);
    snapshotMetric.text(metricShortLabels[currentState.metric]);
  }

  renderMonthlyChart(stateName);
}

function getMonthNumber(d) {
  if (Number.isFinite(d.month)) return d.month;
  if (Number.isFinite(d.month_number)) return d.month_number;

  if (typeof d.month === "string") {
    const parsed = +d.month;
    if (Number.isFinite(parsed)) return parsed;
  }

  return NaN;
}

function getMonthlyHotDaysValue(d) {
  const possibleColumns = [
    "monthly_hot_days_35c_change_from_observed_2020",
    "monthly_hot_days_35c_change_from_cmip6_2020",
    "monthly_hot_days_35c",
    "summer_hot_days_35c_change_from_observed_2020",
    "summer_hot_days_35c",
  ];

  for (const col of possibleColumns) {
    if (Number.isFinite(d[col])) return d[col];
  }

  return NaN;
}

function monthShortName(monthNumber) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[monthNumber - 1] || monthNumber;
}

function getFeatureStateName(feature) {
  return (
    feature.properties.state ||
    feature.properties.NAME ||
    feature.properties.name
  );
}

function normalizeStateName(name) {
  return String(name).trim();
}

function formatValue(value, unit) {
  if (!Number.isFinite(value)) return "N/A";

  if (unit === "°C") {
    return `${d3.format("+.2f")(value)} ${unit}`;
  }

  if (unit === "days") {
    return `${d3.format("+.1f")(value)} ${unit}`;
  }

  return d3.format(".2f")(value);
}

function formatWeeks(value) {
  if (!Number.isFinite(value)) return "N/A";

  if (Math.abs(value) < 1) {
    return `${d3.format(".1f")(value * 7)} extra days`;
  }

  return `about ${d3.format(".1f")(value)} extra weeks`;
}

function pulseViz() {
  if (stickyViz.empty()) return;

  stickyViz.classed("step-pulse", false);
  void stickyViz.node().offsetWidth;
  stickyViz.classed("step-pulse", true);
}