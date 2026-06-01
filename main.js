const DATA_PATH = "data/";

const files = {
  states: `${DATA_PATH}us_states.geojson`,
  stateStory: `${DATA_PATH}state_summer_heat_story_observed_cmip6_2000_2100.csv`,
  annualStory: `${DATA_PATH}state_annual_heat_story_observed_cmip6_2000_2100.csv`,
  monthlyStory: `${DATA_PATH}state_monthly_heat_story_observed_cmip6_2000_2100.csv`,
  impactContext: `${DATA_PATH}state_impact_context_2100.csv`,
};

const OBS_START_YEAR = 2000;
const START_YEAR = 2020;
const END_YEAR = 2100;
const BASELINE_LABEL = "observed 2020";

// Prevent browser scroll restoration from landing users in the middle of the
// intro-gated story after a refresh. This was especially noticeable when the
// state-change animation was running: the browser could restore the old scroll
// position while the intro gate was locked again, making the page look stuck.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo({ top: 0, left: 0, behavior: "auto" });
document.body.classList.remove("intro-complete");
document.body.classList.add("intro-locked");

const scenarioLabels = {
  observed: "Observed",
  ssp126: "Low emissions",
  ssp245: "Medium emissions",
  ssp585: "High emissions",
};

const scenarioOrder = ["ssp126", "ssp245", "ssp585"];

const metricLabels = {
  summer_tas_c_change_from_observed_2020: "Summer average temperature change after 2020 baseline alignment",
  summer_hot_days_35c_change_from_observed_2020: "Extra very hot summer days",
};

const metricShortLabels = {
  summer_tas_c_change_from_observed_2020: "Avg warming change",
  summer_hot_days_35c_change_from_observed_2020: "Extra very hot days",
};

const metricUnits = {
  summer_tas_c_change_from_observed_2020: "°C",
  summer_hot_days_35c_change_from_observed_2020: "days",
};

// Sequential white-to-red scale for very-hot-day counts.
// Keep this named interpolator defined before any map rendering functions run;
// otherwise D3 callbacks throw and the map disappears.
const interpolateHotDaysWhiteToRed = d3.interpolateRgbBasis([
  "#ffffff",
  "#fee5d9",
  "#fcbba1",
  "#fb6a4a",
  "#cb181d",
  "#67000d"
]);

const stepSettings = [
  {
    view: "line",
    year: 2020,
    scenario: "ssp245",
    metric: "summer_tas_c_change_from_observed_2020",
    title: "Average warming can look small and abstract",
    subtitle:
      "Observed temperature anchors the recent past, then CMIP6 futures show how average warming changes through 2100.",
    note:
      "IF we only look at average temperature, climate risk can feel like a small number."
  },
  {
    view: "translation-card",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Averages hide threshold-crossing days",
    subtitle:
      "Average temperature is only the first layer. Daily heat risk appears when more summer days cross the fixed 35°C threshold.",
    note:
      "Both the °C figure and the very hot day count use centered 5-year rolling averages and baseline alignment.",
  },
  {
    view: "state-hotday-small-multiples",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Extra Very hot days do not land evenly",
    subtitle:
      "The same national warming story turns into different threshold-crossing patterns across states.",
    note:
      "Color shows baseline-aligned 5-year average increases in very hot summer days under high emissions.",
  },
  {
    view: "threshold-explanation",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Track baseline-aligned extra very hot summer days",
    subtitle:
      "A fixed threshold turns small temperature shifts into larger changes in the number of threshold-crossing days.",
    note:
      "THEREFORE, the story follows baseline-aligned 5-year average increases in very hot summer days.",
  },
  {
    view: "animated-exposure-map",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Hazard alone is not exposure",
    subtitle:
      "The animated map advances in consistent 10-year steps from observed history to the 2100 projection. Bubbles stay anchored inside states and grow where hot-day hazard and exposed population combine.",
    note:
      "10-year loop. Fill = very hot summer days; bubble size = exposure-days proxy. 2000–2020 uses observed hot days; 2030–2100 uses baseline-aligned projected hot days under high emissions.",
  },
  {
    view: "exposure-layer-cards",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Carry your selected state into exposure",
    subtitle:
      "For your selected state, exposure-days are built from added very hot days and projected population, then compared with the highest-exposure benchmark.",
    note:
      "Exposure-days proxy = added very hot summer days × projected population. It is not a health-outcome prediction.",
  },
  {
    view: "us-exposure-comparison",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "By 2100, U.S. heat exposure becomes much larger",
    subtitle:
      "Each block represents the same amount of heat exposure. One exposure-day means one person experiencing one additional 35°C+ summer day.",
    note:
      "2020 baseline = observed 2020 hot-day hazard × population projection baseline. 2100 projection = projected 2100 hot-day hazard × projected 2100 population.",
  },
  {
    view: "impact-placeholder",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Common knowledge on the left, sourced impacts on the right",
    subtitle:
      "Step 08 separates context/proxy layers from outside-source examples, using color to make the two kinds of evidence easier to compare.",
    note:
      "Left = common-knowledge context/proxy layers. Right = source-backed daily-life examples."
  },
  {
    view: "map",
    year: 2100,
    scenario: "ssp585",
    metric: "summer_hot_days_35c_change_from_observed_2020",
    title: "Compare states and metrics yourself",
    subtitle:
      "Use the controls to compare average warming with extra very hot days. Very hot means daily highs above 35°C.",
    note:
      "Explore mode: hover previews values; click selects a state with a solid yellow outline for local detail.",
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
let impactContextData = [];
let currentStep = 0;

let currentState = {
  year: 2020,
  scenario: "ssp245",
  metric: "summer_tas_c_change_from_observed_2020",
  view: "line",
};

let selectedStateName = null;
let showExposureBubbles = false;
let mapAnimationTimer = null;
let introCompleted = false;
let introEvaluationTimer = null;
let knownStateNames = [];

const excludedSelectableStates = new Set(["Alaska", "Hawaii"]);
function isSelectableStateName(stateName) {
  return Boolean(stateName) && !excludedSelectableStates.has(normalizeStateName(stateName));
}
let stateChangeTimer = null;
let stateChangeYearIndex = 0;
let stateChangePaused = false;
let stateChangeLoopCards = [];
let stateChangeLoopYears = [];
let stateChangeCurrentYear = START_YEAR;
let stateChangeStartDelayTimer = null;
let stateChangeObserver = null;
let stateChangeHasStarted = false;
let annualRowsFromMonthlyCache = null;
let highEmissionStateChangeCache = null;
let highEmissionHotdayStateChangeCache = null;
let hotDayAlignmentBaselineCache = null;
let monthlyHotDayAlignmentBaselineCache = null;
let hotDayRollingLookupCache = null;
let monthlyHotDayRollingLookupCache = null;
let renderCycleId = 0;
let stateHotdaySmallMultipleTimer = null;

function clearStoryTimers() {
  if (mapAnimationTimer) {
    mapAnimationTimer.stop();
    mapAnimationTimer = null;
  }
  window.clearTimeout(introEvaluationTimer);
  window.clearInterval(stateChangeTimer);
  window.clearTimeout(stateChangeTimer);
  window.clearTimeout(stateChangeStartDelayTimer);
  window.clearInterval(stateHotdaySmallMultipleTimer);
  stateChangeTimer = null;
  stateHotdaySmallMultipleTimer = null;
  stateChangeStartDelayTimer = null;
  if (stateChangeObserver) {
    stateChangeObserver.disconnect();
    stateChangeObserver = null;
  }
}

window.addEventListener("pagehide", clearStoryTimers);
window.addEventListener("beforeunload", clearStoryTimers);
window.addEventListener("pageshow", () => {
  if (!introCompleted) {
    document.body.classList.remove("intro-complete");
    document.body.classList.add("intro-locked");
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }
});

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
const bubbleToggle = d3.select("#bubble-toggle");
const statePicker = d3.select("#state-picker");

const hometownStateInput = d3.select("#hometown-state-input");
const expectationTempInput = d3.select("#expectation-temp-input");
const stateSuggestions = d3.select("#state-suggestions");
const introFormNote = d3.select("#intro-form-note");
const expectationResultSection = d3.select("#expectation-result");
const expectationResultTitle = d3.select("#expectation-result-title");
const expectationResultText = d3.select("#expectation-result-text");
const expectationResultValues = d3.select("#expectation-result-values");
const stateChangeResultSection = d3.select("#state-change-result");
const stateChangeTitle = d3.select("#state-change-title");
const stateChangeText = d3.select("#state-change-text");
const stateChangeBlocks = d3.select("#state-change-blocks");
const stateChangeNote = d3.select("#state-change-note");
const stateChangeContinue = d3.select("#state-change-continue");

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

  // Fresh loads should always start at the intro prompt. Browsers may restore
  // form values and scroll position on refresh; reset the gated state so users
  // do not get trapped below the hero with scrolling disabled.
  introCompleted = false;
  document.body.classList.remove("intro-complete");
  document.body.classList.add("intro-locked");
  document.querySelector("#expectation-result")?.setAttribute("hidden", "");
  document.querySelector("#state-change-result")?.setAttribute("hidden", "");
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));

  const [states, storyRows, annualRows, monthlyRows, impactRows] = await Promise.all([
    d3.json(files.states),
    d3.csv(files.stateStory, d3.autoType),
    d3.csv(files.annualStory, d3.autoType).catch(() => []),
    d3.csv(files.monthlyStory, d3.autoType),
    d3.csv(files.impactContext, d3.autoType).catch(() => []),
  ]);

  statesGeo = states;
  allStoryData = storyRows;
  annualStoryData = annualRows.length ? annualRows : storyRows;
  stateData = storyRows.filter((d) => d.data_source !== "observed" && scenarioOrder.includes(d.scenario));
  annualStateData = annualStoryData.filter((d) => d.data_source !== "observed" && scenarioOrder.includes(d.scenario));
  tasData = stateData;
  allMonthlyData = monthlyRows;
  monthlyData = monthlyRows.filter((d) => d.data_source !== "observed" && scenarioOrder.includes(d.scenario));
  impactContextData = impactRows;

  setupControls();
  setupStatePicker();
  setupIntroExpectation();
  setupStateChangeContinue();
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

  if (!bubbleToggle.empty()) {
    bubbleToggle.on("change", (event) => {
      showExposureBubbles = event.target.checked;
      updateManualTitle();
      if (currentState.view === "map") {
        renderMap(350);
      }
    });
  }
}

function setupStatePicker() {
  if (statePicker.empty()) return;

  const stateNames = Array.from(
    new Set(stateData.map((d) => normalizeStateName(d.state)))
  )
    .filter(isSelectableStateName)
    .sort(d3.ascending);

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


function setupStateChangeContinue() {
  if (stateChangeContinue.empty()) return;

  stateChangeContinue.on("click", () => {
    document.querySelector("#us-transition")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function setupIntroExpectation() {
  knownStateNames = Array.from(
    new Set([
      ...allMonthlyData.map((d) => normalizeStateName(d.state)),
      ...stateData.map((d) => normalizeStateName(d.state)),
    ].filter(isSelectableStateName))
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
    .filter((name) => !cleaned || name.toLowerCase().includes(cleaned));

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

    // Let the state dropdown scroll internally while the intro page itself is locked.
    const suggestionsEl = document.querySelector("#state-suggestions");
    if (suggestionsEl?.classList.contains("is-open") && suggestionsEl.contains(event.target)) {
      return;
    }

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
  renderStateChangeFollowup(result);

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
  const annualRows = getAnnualTemperatureRowsFromMonthly()
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
  const diffText =
    diffAbs < 0.05
      ? "almost exactly the same as"
      : `${d3.format(".1f")(diffAbs)}°C ${direction}`;

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
    emissionContext =
      "This value is projected under the high-emissions pathway, a more extreme future with continued warming pressure.";
  } else if (closest.scenario === "ssp126") {
    emissionContext =
      "This value is projected under the low-emissions pathway, a more optimistic mitigation future.";
  } else {
    emissionContext =
      "This value is projected under the medium-emissions pathway, a moderated future between low and high emissions.";
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

  const formatTemp = (v) => `${d3.format(".1f")(v)}°C`;

  const projectionValues = projections.map((d) => d.value);
  const allValues = [expectation, ...projectionValues];

  const rawMin = d3.min(allValues);
  const rawMax = d3.max(allValues);
  const spread = Math.max(4, rawMax - rawMin);

  const domainMin = Math.max(0, Math.floor((rawMin - spread * 0.18) / 2) * 2);
  const domainMax = Math.ceil((rawMax + spread * 0.18) / 2) * 2;
  const domainSpan = Math.max(1, domainMax - domainMin);

  const clampPct = (v) => Math.max(0, Math.min(100, v));
  const toPct = (v) => clampPct(((v - domainMin) / domainSpan) * 100);

  const expectationPct = toPct(expectation);
  const projectionMin = d3.min(projectionValues);
  const projectionMax = d3.max(projectionValues);
  const bandBottom = toPct(projectionMin);
  const bandTop = toPct(projectionMax);
  const bandHeight = Math.max(3, bandTop - bandBottom);

  const gapText =
    closest.diff >= 0
      ? `+${d3.format(".1f")(closest.diff)}°C above`
      : `${d3.format(".1f")(closest.diff)}°C below`;

  const tickMarkup = projections
    .map(
      (d) => `
      <div
        class="thermometer-projection-tick tick-${d.scenario}${d.scenario === closest.scenario ? " is-closest" : ""}"
        style="bottom: calc(${toPct(d.value)}% + 46px);"
        aria-hidden="true"
      ></div>
    `
    )
    .join("");

  const legendMarkup = projections
    .map(
      (d) => `
      <div class="thermometer-legend-row${d.scenario === closest.scenario ? " is-closest" : ""}">
        <span class="thermometer-swatch swatch-${d.scenario}"></span>
        <div class="thermometer-legend-copy">
          <strong>${d.label}</strong>
          <small>
            ${formatTemp(d.value)}
            ${d.scenario === closest.scenario ? " · closest projection" : ""}
          </small>
        </div>
      </div>
    `
    )
    .join("");

  expectationResultValues.html(`
    <div class="thermometer-panel">
      <div class="thermometer-panel-heading">Where does your expectation land?</div>

      <div class="thermometer-wrap">
        <div class="thermometer-figure">
          <div class="thermometer-scale-label thermometer-scale-top">${formatTemp(domainMax)}</div>

          <div class="thermometer-meter">
            <div class="thermometer-track">
              <div
                class="thermometer-projection-band"
                style="bottom: ${bandBottom}%; height: ${bandHeight}%;"
                aria-hidden="true"
              ></div>

              <div
                class="thermometer-liquid"
                style="height: ${Math.max(expectationPct, 6)}%;"
                aria-hidden="true"
              ></div>
            </div>

            ${tickMarkup}

            <div
              class="thermometer-user-marker"
              style="bottom: calc(${expectationPct}% + 46px);"
            >
              <span class="thermometer-user-line"></span>
              <div class="thermometer-user-bubble">
                <span>Your expectation</span>
                <strong>${formatTemp(expectation)}</strong>
              </div>
            </div>

            <div class="thermometer-bulb" aria-hidden="true"></div>
          </div>

          <div class="thermometer-scale-label thermometer-scale-bottom">${formatTemp(domainMin)}</div>
        </div>

        <div class="thermometer-side">
          <div class="thermometer-you-card">
            <span>Your expectation</span>
            <strong>${formatTemp(expectation)}</strong>
            <small>Compared against 2100 temperature projections</small>
          </div>

          <div class="thermometer-range-note">
            Projection range:
            <strong>${formatTemp(projectionMin)} – ${formatTemp(projectionMax)}</strong>
          </div>

          <div class="thermometer-legend">
            ${legendMarkup}
          </div>
        </div>
      </div>

      <p class="thermometer-summary">
        Closest projection:
        <strong>${closest.label}</strong>
        at <strong>${formatTemp(closest.value)}</strong>.
        Your expectation is <strong>${gapText}</strong> that closest projection.
      </p>
    </div>
  `);
}


function renderStateChangeFollowup(result) {
  if (stateChangeResultSection.empty()) return;

  const selectedState = result.stateName;
  const comparison = getHighEmissionStateChangeComparison(selectedState);
  if (!comparison) return;

  const { selected, top, years } = comparison;
  const selectedIsTop = selected.stateName === top.stateName;
  const selectedFinal = selected.series.find((d) => d.year === END_YEAR) || selected.series[selected.series.length - 1];
  const topFinal = top.series.find((d) => d.year === END_YEAR) || top.series[top.series.length - 1];
  const diff = topFinal.change - selectedFinal.change;

  let titleText;
  let bodyText;
  if (selectedIsTop) {
    titleText = `${selectedState} is the state projected to grow the most.`;
    bodyText = `And how much has it changed from 2020? Under high emissions, ${selectedState} has the largest baseline-aligned increase among states by the end of the century.`;
  } else {
    titleText = `${selectedState} warms, but ${top.stateName} grows faster.`;
    bodyText = `By 2100 under high emissions, ${selectedState} reaches ${d3.format(".1f")(selectedFinal.change)}°C above the 2020 baseline. ${top.stateName} reaches ${d3.format(".1f")(topFinal.change)}°C.`;
    if (Number.isFinite(diff) && diff > 0) {
      bodyText += ` That is about ${d3.format(".1f")(diff)}°C more than your selected state.`;
    }
  }

  stateChangeResultSection.attr("hidden", null);
  stateChangeTitle.text(titleText);
  stateChangeText.text(bodyText);
  stateChangeNote.text("High-emissions pathway · baseline-aligned 5-year rolling annual average · color shows °C change since 2020");

  const cards = selectedIsTop
    ? [{ role: "Your state + largest increase", kind: "selected top", ...selected }]
    : [
        { role: "Your hometown state", kind: "selected", ...selected },
        { role: "Largest increase", kind: "top", ...top },
      ];

  stateChangeBlocks.html("");
  renderStateChangeControls();
  renderStateShapeCards(cards);
  startStateChangeLoop(cards, years);
}

function renderStateChangeControls() {
  const controls = stateChangeBlocks
    .append("div")
    .attr("class", "state-change-controls");

  controls
    .append("button")
    .attr("type", "button")
    .attr("id", "state-change-play-toggle")
    .attr("class", "state-change-play-toggle")
    .text("Pause")
    .on("click", toggleStateChangePlayback);

  const sliderWrap = controls.append("div").attr("class", "state-change-slider-wrap");
  const sliderTop = sliderWrap.append("div")
    .attr("class", "state-change-slider-top");

  sliderTop.append("span")
    .attr("class", "state-change-slider-label")
    .text("Year");

  sliderTop.append("output")
    .attr("id", "state-change-year-output")
    .attr("class", "state-change-year-output")
    .text(START_YEAR);

  const sliderBody = sliderWrap.append("div")
    .attr("class", "state-change-slider-body");

  const customSlider = sliderBody
    .append("div")
    .attr("id", "state-change-year-slider")
    .attr("class", "state-change-custom-slider is-disabled")
    .attr("role", "slider")
    .attr("aria-valuemin", START_YEAR)
    .attr("aria-valuemax", END_YEAR)
    .attr("aria-valuenow", START_YEAR)
    .attr("aria-disabled", "true")
    .attr("tabindex", 0);

  customSlider.append("div")
    .attr("class", "state-change-custom-track");

  customSlider.append("div")
    .attr("class", "state-change-custom-fill");

  customSlider.append("div")
    .attr("class", "state-change-custom-thumb");

  customSlider
    .on("pointerdown", stateChangeSliderPointerDown)
    .on("keydown", stateChangeSliderKeydown);

  sliderBody.append("div")
    .attr("class", "state-change-slider-ticks")
    .html('<button type="button" data-year="2020">2020</button><button type="button" data-year="2040">2040</button><button type="button" data-year="2060">2060</button><button type="button" data-year="2080">2080</button><button type="button" data-year="2100">2100</button>');

  sliderBody.selectAll(".state-change-slider-ticks button")
    .on("click", function() {
      if (!stateChangePaused) return;
      const year = +this.dataset.year;
      stateChangeCurrentYear = year;
      setStateChangeControlYear(year);
      updateStateChangeMapCards(stateChangeLoopCards, year);
    });

  sliderWrap
    .append("div")
    .attr("class", "state-change-slider-help")
    .text("Pause to inspect a year.");
}

function setStateChangeControlYear(year) {
  const boundedYear = Math.max(START_YEAR, Math.min(END_YEAR, Number(year) || START_YEAR));
  const progressRatio = (boundedYear - START_YEAR) / (END_YEAR - START_YEAR);

  d3.select("#state-change-year-slider").attr("aria-valuenow", boundedYear);
  d3.select("#state-change-year-output").text(boundedYear);
  d3.select(".state-change-slider-wrap")
    .style("--state-year-progress-ratio", progressRatio);
}


function setStateChangeSliderDisabled(disabled) {
  const slider = d3.select("#state-change-year-slider");
  if (slider.empty()) return;
  slider
    .classed("is-disabled", !!disabled)
    .attr("aria-disabled", disabled ? "true" : "false")
    .attr("tabindex", disabled ? -1 : 0);
}

function setStateChangeYearFromRatio(ratio) {
  if (!stateChangePaused) return;
  const clamped = Math.max(0, Math.min(1, ratio));
  const year = Math.round(START_YEAR + clamped * (END_YEAR - START_YEAR));
  stateChangeCurrentYear = year;
  setStateChangeControlYear(year);
  updateStateChangeMapCards(stateChangeLoopCards, year);
}

function stateChangeSliderPointerDown(event) {
  if (!stateChangePaused) return;
  const sliderNode = event.currentTarget;
  sliderNode.setPointerCapture?.(event.pointerId);

  const updateFromEvent = (evt) => {
    const rect = sliderNode.getBoundingClientRect();
    const ratio = rect.width ? (evt.clientX - rect.left) / rect.width : 0;
    setStateChangeYearFromRatio(ratio);
  };

  updateFromEvent(event);

  const move = (evt) => updateFromEvent(evt);
  const up = (evt) => {
    sliderNode.releasePointerCapture?.(evt.pointerId);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}

function stateChangeSliderKeydown(event) {
  if (!stateChangePaused) return;
  let nextYear = stateChangeCurrentYear || START_YEAR;
  if (event.key === "ArrowLeft") nextYear -= 1;
  else if (event.key === "ArrowRight") nextYear += 1;
  else if (event.key === "PageDown") nextYear -= 10;
  else if (event.key === "PageUp") nextYear += 10;
  else if (event.key === "Home") nextYear = START_YEAR;
  else if (event.key === "End") nextYear = END_YEAR;
  else return;

  event.preventDefault();
  stateChangeCurrentYear = Math.max(START_YEAR, Math.min(END_YEAR, nextYear));
  setStateChangeControlYear(stateChangeCurrentYear);
  updateStateChangeMapCards(stateChangeLoopCards, stateChangeCurrentYear);
}

function renderStateShapeCards(cards) {
  const maxChange = d3.max(cards.flatMap((d) => d.series.map((row) => row.change))) || 1;
  const color = d3.scaleSequential()
    .domain([0, Math.max(0.1, maxChange)])
    .interpolator(d3.interpolateOrRd);

  const cardsWrap = stateChangeBlocks
    .append("div")
    .attr("class", "state-change-map-cards");

  const card = cardsWrap
    .selectAll("div.state-change-state-card")
    .data(cards, (d) => d.stateName + d.role)
    .join("div")
    .attr("class", (d) => `state-change-state-card state-shape-card ${d.kind === "top" || d.kind === "selected top" ? "is-top" : "is-selected"}`);

  card.html((d) => {
    const final = d.series.find((row) => row.year === END_YEAR) || d.series[d.series.length - 1];
    return `
      <div class="state-change-card-header">
        <div>
          <span>${d.role}</span>
          <h3>${d.stateName}</h3>
        </div>
        <div class="state-change-year-pill" data-role="year">2020</div>
      </div>
      <div class="state-shape-stage">
        <svg class="state-shape-svg" viewBox="0 0 320 190" role="img" aria-label="${d.stateName} map shape"></svg>
      </div>
      <div class="state-change-value-row">
        <strong data-role="value">+0.0</strong>
        <small>°C since 2020</small>
      </div>
      <p class="state-change-state-note">By 2100: ${d3.format("+.1f")(final.change)}°C baseline-aligned change from 2020.</p>
    `;
  });

  card.each(function(d) {
    const feature = getStateFeature(d.stateName);
    const svgEl = d3.select(this).select("svg.state-shape-svg");
    svgEl.selectAll("*").remove();

    if (!feature) {
      svgEl.append("text")
        .attr("x", 160)
        .attr("y", 95)
        .attr("text-anchor", "middle")
        .attr("fill", "#7a858d")
        .attr("font-size", 13)
        .text("State shape unavailable");
      return;
    }

    const bounds = path.bounds(feature);
    const dx = Math.max(1, bounds[1][0] - bounds[0][0]);
    const dy = Math.max(1, bounds[1][1] - bounds[0][1]);
    const scale = Math.min(260 / dx, 140 / dy);
    const tx = 160 - scale * (bounds[0][0] + bounds[1][0]) / 2;
    const ty = 95 - scale * (bounds[0][1] + bounds[1][1]) / 2;

    svgEl.append("path")
      .datum(feature)
      .attr("class", "state-shape-path")
      .attr("d", path)
      .attr("transform", `translate(${tx},${ty}) scale(${scale})`)
      .attr("fill", "#f3f0ed")
      .attr("stroke", "rgba(23,32,42,0.28)")
      .attr("stroke-width", 1 / scale);
  });

  stateChangeBlocks.datum({ color });
}

function startStateChangeLoop(cards, years) {
  window.clearInterval(stateChangeTimer);
  window.clearTimeout(stateChangeTimer);
  window.clearTimeout(stateChangeStartDelayTimer);
  if (stateChangeObserver) {
    stateChangeObserver.disconnect();
    stateChangeObserver = null;
  }

  stateChangeYearIndex = 1;
  stateChangePaused = false;
  stateChangeHasStarted = false;
  stateChangeLoopCards = cards;
  stateChangeLoopYears = years;
  stateChangeCurrentYear = START_YEAR;

  d3.select("#state-change-play-toggle").text("Pause");
  setStateChangeSliderDisabled(true);
  setStateChangeControlYear(START_YEAR);
  updateStateChangeMapCards(cards, START_YEAR);

  scheduleStateChangeLoopWhenVisible();
}

function isStateChangeSectionInView() {
  const section = document.querySelector("#state-change-result");
  if (!section || section.hasAttribute("hidden")) return false;
  const rect = section.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  // Require the section to be meaningfully on screen before starting.
  return rect.top < vh * 0.42 && rect.bottom > vh * 0.52;
}

function scheduleStateChangeLoopWhenVisible() {
  const section = document.querySelector("#state-change-result");
  if (!section) return;

  const requestStart = () => {
    if (stateChangeHasStarted || stateChangePaused || !stateChangeLoopCards.length) return;
    window.clearTimeout(stateChangeStartDelayTimer);
    stateChangeStartDelayTimer = window.setTimeout(() => {
      if (stateChangeHasStarted || stateChangePaused || !isStateChangeSectionInView()) return;
      stateChangeHasStarted = true;
      playStateChangeLoopFromCurrent(false);
    }, 1000);
  };

  if (isStateChangeSectionInView()) {
    requestStart();
    return;
  }

  stateChangeObserver = new IntersectionObserver((entries) => {
    const entry = entries.find((d) => d.target === section);
    if (!entry || !entry.isIntersecting) return;
    if (entry.intersectionRatio < 0.42) return;
    requestStart();
  }, {
    threshold: [0.42, 0.55, 0.7],
    rootMargin: "0px 0px -12% 0px",
  });

  stateChangeObserver.observe(section);
}

function playStateChangeLoopFromCurrent(startImmediately = true) {
  window.clearInterval(stateChangeTimer);
  window.clearTimeout(stateChangeTimer);
  window.clearTimeout(stateChangeStartDelayTimer);

  stateChangePaused = false;
  d3.select("#state-change-play-toggle").text("Pause");
  setStateChangeSliderDisabled(true);

  const current = Number.isFinite(stateChangeCurrentYear) ? stateChangeCurrentYear : START_YEAR;
  const nextIndex = stateChangeLoopYears.findIndex((y) => y > current);
  stateChangeYearIndex = nextIndex >= 0 ? nextIndex : 0;

  if (current >= END_YEAR || stateChangeYearIndex === 0) {
    stateChangeCurrentYear = START_YEAR;
    setStateChangeControlYear(START_YEAR);
    updateStateChangeMapCards(stateChangeLoopCards, START_YEAR);
    stateChangeYearIndex = Math.min(1, stateChangeLoopYears.length);
  }

  const update = () => {
    if (stateChangeYearIndex >= stateChangeLoopYears.length) {
      stopStateChangeLoop();
      return;
    }

    const year = stateChangeLoopYears[stateChangeYearIndex];
    stateChangeCurrentYear = year;
    updateStateChangeMapCards(stateChangeLoopCards, year);
    setStateChangeControlYear(year);
    stateChangeYearIndex += 1;

    if (stateChangeYearIndex >= stateChangeLoopYears.length) {
      window.clearInterval(stateChangeTimer);
      stateChangeTimer = window.setTimeout(stopStateChangeLoop, 650);
    }
  };

  if (startImmediately) update();
  stateChangeTimer = window.setInterval(update, 800);
}

function stopStateChangeLoop() {
  window.clearInterval(stateChangeTimer);
  window.clearTimeout(stateChangeTimer);
  window.clearTimeout(stateChangeStartDelayTimer);
  window.clearInterval(stateHotdaySmallMultipleTimer);
  stateChangeTimer = null;
  stateHotdaySmallMultipleTimer = null;
  stateChangeStartDelayTimer = null;
  stateChangePaused = true;
  d3.select("#state-change-play-toggle").text("Start");
  setStateChangeSliderDisabled(false);
  setStateChangeControlYear(stateChangeCurrentYear);
}

function toggleStateChangePlayback() {
  if (stateChangePaused) {
    stateChangeHasStarted = true;
    playStateChangeLoopFromCurrent(true);
  } else {
    stopStateChangeLoop();
  }
}

function updateStateChangeMapCards(cards, year) {
  const meta = stateChangeBlocks.datum() || {};
  const allMax = d3.max(cards.flatMap((d) => d.series.map((row) => row.change))) || 1;
  const color = meta.color || d3.scaleSequential().domain([0, Math.max(0.1, allMax)]).interpolator(d3.interpolateOrRd);

  stateChangeBlocks
    .selectAll("div.state-change-state-card")
    .each(function(d) {
      const card = d3.select(this);
      const row = getNearestYearRow(d.series, year);
      const change = Math.max(0, row.change || 0);

      card.select('[data-role="year"]').text(row.year);
      card.select('[data-role="value"]').text(d3.format("+.1f")(change));
      card.select("path.state-shape-path")
        .transition()
        .duration(260)
        .attr("fill", color(change));
    });
}

function getNearestYearRow(series, year) {
  return series.reduce((best, row) => {
    if (!best) return row;
    return Math.abs(row.year - year) < Math.abs(best.year - year) ? row : best;
  }, null);
}

function getStateFeature(stateName) {
  if (!statesGeo?.features) return null;
  return statesGeo.features.find((feature) => normalizeStateName(getFeatureStateName(feature)) === normalizeStateName(stateName));
}

function getHighEmissionStateChangeComparison(selectedState) {
  const allSeries = getHighEmissionStateChangeSeries();

  if (!allSeries.length) return null;

  const top = allSeries
    .map((d) => ({
      ...d,
      finalChange: (d.series.find((row) => row.year === END_YEAR) || d.series[d.series.length - 1])?.change,
    }))
    .filter((d) => Number.isFinite(d.finalChange))
    .sort((a, b) => d3.descending(a.finalChange, b.finalChange))[0];

  const selected = allSeries.find((d) => d.stateName === selectedState);
  if (!selected || !top) return null;

  return {
    selected,
    top,
    years: d3.range(START_YEAR, END_YEAR + 1, 10),
  };
}

function getHighEmissionStateChangeSeries() {
  if (highEmissionStateChangeCache) return highEmissionStateChangeCache;

  const annualRows = getAnnualTemperatureRowsFromMonthly();
  const states = Array.from(new Set(annualRows.map((d) => normalizeStateName(d.state)).filter(Boolean))).sort(d3.ascending);

  highEmissionStateChangeCache = states
    .map((stateName) => getStateAlignedAnnualChangeSeries(stateName, "ssp585", annualRows))
    .filter((d) => d && d.series && d.series.length);

  return highEmissionStateChangeCache;
}

function getStateAlignedAnnualChangeSeries(stateName, scenario = "ssp585", precomputedAnnualRows = null) {
  const annualRows = (precomputedAnnualRows || getAnnualTemperatureRowsFromMonthly())
    .filter((d) => normalizeStateName(d.state) === stateName && Number.isFinite(d.annual_tas_c));

  if (!annualRows.length) return null;

  const observedYearly = annualRows
    .filter((d) => d.data_source === "observed" && d.year >= OBS_START_YEAR && d.year <= START_YEAR)
    .map((d) => ({ year: d.year, value: d.annual_tas_c }))
    .sort((a, b) => d3.ascending(a.year, b.year));

  const observedRolling = addCenteredRollingAverage(observedYearly, "value", 5);
  const observed2020 = observedRolling.find((d) => d.year === START_YEAR);
  if (!observed2020 || !Number.isFinite(observed2020.value)) return null;

  const projectedYearly = annualRows
    .filter((d) => d.data_source !== "observed" && d.scenario === scenario && d.year >= START_YEAR && d.year <= END_YEAR)
    .map((d) => ({ year: d.year, value: d.annual_tas_c }))
    .sort((a, b) => d3.ascending(a.year, b.year));

  const projectedRolling = addCenteredRollingAverage(projectedYearly, "value", 5);
  const scenario2020 = projectedRolling.find((d) => d.year === START_YEAR);
  if (!scenario2020 || !Number.isFinite(scenario2020.value)) return null;

  const sourceGap = scenario2020.value - observed2020.value;
  const series = d3.range(START_YEAR, END_YEAR + 1, 1).map((year) => {
    const row = projectedRolling.find((d) => d.year === year);
    if (!row) return null;
    const alignedTemp = row.value - sourceGap;
    return {
      year,
      temp: alignedTemp,
      change: alignedTemp - observed2020.value,
    };
  }).filter(Boolean);

  return {
    stateName,
    scenario,
    observed2020: observed2020.value,
    sourceGap,
    series,
  };
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
    .classed("explore-mode", step === stepSettings.length - 1)
    .classed("text-break-active", setting.view === "text-break")
    .classed("impact-fullpage-active", setting.view === "impact-placeholder");

  syncControls();
  pulseViz();
  updateMainView();

  if (!setting.animateYears) {
    updateSelectedStateFromCurrentView(false);
  }
}

function updateMainView() {
  renderCycleId += 1;
  cancelMapAnimation();
  cancelStateHotdaySmallMultipleAnimation();
  hideTooltip();

  // step8-move summary
  svg.style("display", null);
  d3.select(".chart-wrap").selectAll(".impact-fill").remove();
  const summaryEl = document.getElementById("trend-summary");
  if (summaryEl && !new Set(["line", "summer-change-line", "compare-line"]).has(currentState.view)) {
    summaryEl.style.display = "none";
  }
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
  } else if (currentState.view === "state-hotday-small-multiples") {
    renderStateHotdaySmallMultiples();
  } else if (currentState.view === "threshold-explanation") {
    renderThresholdExplanation();
  } else if (currentState.view === "risk-transition") {
    renderRiskTransition();
  } else if (currentState.view === "animated-exposure-map") {
    renderAnimatedExposureMap();
  } else if (currentState.view === "exposure-layer-cards") {
    renderExposureLayerCards();
  } else if (currentState.view === "us-exposure-comparison") {
    renderUSExposureComparison();
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
  if (currentStep !== stepSettings.length - 1) return;

  title.text(`${metricLabels[currentState.metric]} in ${currentState.year}`);
  subtitle.text(
    `${scenarioLabels[currentState.scenario]} scenario. Hover previews values; click selects a state with a solid yellow outline. ${showExposureBubbles ? "Bubbles show exposure-days proxy." : "Turn on bubbles to compare exposure-days proxy."}`
  );
  mapNote.text("Explore mode: color shows the selected climate metric. Very hot days = daily highs above 35°C. Hover previews values; click selects a state for detail.");
}

function syncControls() {
  scenarioSelect.property("value", currentState.scenario);
  yearSlider.property("value", currentState.year);
  yearLabel.text(currentState.year);
  metricSelect.property("value", currentState.metric);
  if (!bubbleToggle.empty()) {
    bubbleToggle.property("checked", showExposureBubbles);
  }
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

  const showYearOverlay = currentState.view === "map" && currentStep !== stepSettings.length - 1;
  mapYearOverlay
    .text(currentState.year)
    .classed("is-visible", showYearOverlay)
    .classed("is-animating", showYearOverlay && Boolean(mapAnimationTimer));
}
/* ---------------------------------- */
/* ---------------------------------- */
/* ---------------------------------- */

function showTrendSummary(seriesByScenario, color, cycleId = renderCycleId) {
  if (cycleId !== renderCycleId || currentState.view !== "line") return;
  const container = document.getElementById("trend-summary");
  const rowsEl = document.getElementById("trend-summary-rows");
  if (!container || !rowsEl) return;

  container.style.display = "";
  rowsEl.innerHTML = "";
  const summaryLabel = container.querySelector(".trend-summary-label");
  if (summaryLabel) summaryLabel.textContent = "Aligned baseline temperature";
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
  el.style.display = "none";
  const rowsEl = document.getElementById("trend-summary-rows");
  if (rowsEl) rowsEl.innerHTML = "";
}

function showCompareSummary(rowsBySeries, cycleId = renderCycleId) {
  if (cycleId !== renderCycleId || currentState.view !== "compare-line") return;
  const container = document.getElementById("trend-summary");
  const rowsEl = document.getElementById("trend-summary-rows");
  if (!container || !rowsEl) return;

  container.style.display = "";
  rowsEl.innerHTML = "";
  const summaryLabel = container.querySelector(".trend-summary-label");
  if (summaryLabel) summaryLabel.textContent = "Scenario change by 2100";

  const seriesConfig = [
    { name: "Avg warming change",        color: "#4f8fc0", unit: "°C",   decimals: 2 },
    { name: "Extra very hot days",  color: "#c4512c", unit: "days", decimals: 1 },
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
  const chartCycleId = renderCycleId;
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("line");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const margin = { top: 78, right: 18, bottom: 54, left: 74 };
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
            showTrendSummary(seriesByScenario, color, chartCycleId);
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
    .text(`Grey = NOAA observed annual average temperature. Colored dots show raw CMIP6 starts at 2020; scenario lines then use an aligned baseline at observed 2020. Lines use centered 5-year rolling averages; endpoint windows use available years.`);
}


function showSummerChangeSummary(seriesByScenario, color, cycleId = renderCycleId) {
  if (cycleId !== renderCycleId || currentState.view !== "summer-change-line") return;
  const container = document.getElementById("trend-summary");
  const rowsEl = document.getElementById("trend-summary-rows");
  if (!container || !rowsEl) return;

  container.style.display = "";
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
  const chartCycleId = renderCycleId;
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
            showSummerChangeSummary(seriesByScenario, color, chartCycleId);
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
    .attr("fill", "rgba(255, 248, 240, 0.16)")
    .attr("stroke", "none");

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
    .text(`${d3.format("+.1f")(hotDays)} days`);

  g.append("text")
    .attr("x", rightX)
    .attr("y", topY + 70)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text(`distributed across months by monthly summer very hot day changes`);

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
    .text((d) => d.value > 0 ? d3.format("+.1f")(d.value) : "0.0");

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
    "more 5-year avg. extra very hot summer days in that month."
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
    .html("°C figure: baseline-aligned with Plot 01.<br>Days figure: baseline-aligned using the same 2020 source-offset logic.");
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
    d.year === END_YEAR &&
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

  const monthValues = d3.range(1, 13).map((month) => {
    const rows = monthlyRows.filter((d) => getMonthNumber(d) === month);
    return {
      month,
      value: Math.max(0, d3.mean(rows, (d) => getMonthlyHotDaysValue(d)) || 0),
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
    d.year >= START_YEAR && d.year <= END_YEAR &&
    Number.isFinite(getAlignedHotDaysValue(d))
  );

  if (!hotRows.length) return null;

  const hotByYear = Array.from(
    d3.rollup(
      hotRows,
      (v) => ({
        year: v[0].year,
        value: d3.mean(v, (d) => getAlignedHotDaysValue(d)),
        rollingWindow: d3.max(v, (d) => getHotDayRollingInfo(d)?.rollingWindow || 1),
      }),
      (d) => d.year
    ).values()
  ).sort((a, b) => d3.ascending(a.year, b.year));

  const hot2100 = hotByYear.find((d) => d.year === END_YEAR);

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


function getStateHotdayComparison() {
  const selected = selectedStateName && knownStateNames.includes(selectedStateName)
    ? selectedStateName
    : (selectedStateName || "California");

  const allHotdaySeries = getHighEmissionStateHotdayChangeSeries();
  if (!allHotdaySeries.length) return null;

  const finalHotdayValue = (d) => {
    const final = d.series.find((row) => row.year === END_YEAR) || d.series[d.series.length - 1];
    return final?.days ?? -Infinity;
  };

  // Left side: keep the same states introduced in the average-temperature comparison.
  const tempComparison = getHighEmissionStateChangeComparison(selected);
  const topTempStateName = tempComparison?.top?.stateName;
  const selectedHotday = allHotdaySeries.find((d) => normalizeStateName(d.stateName) === normalizeStateName(selected));
  const topTempHotday = topTempStateName
    ? allHotdaySeries.find((d) => normalizeStateName(d.stateName) === normalizeStateName(topTempStateName))
    : null;

  if (!selectedHotday) return null;

  const sameAsTopTemp = topTempHotday && normalizeStateName(selectedHotday.stateName) === normalizeStateName(topTempHotday.stateName);

  const leftPanels = [{
    stateName: selectedHotday.stateName,
    series: selectedHotday.series,
    label: sameAsTopTemp
      ? "Your state + largest average-temp increase"
      : "Your state",
    kind: sameAsTopTemp ? "selected top-temperature" : "selected",
  }];

  if (topTempHotday && !sameAsTopTemp) {
    leftPanels.push({
      stateName: topTempHotday.stateName,
      series: topTempHotday.series,
      label: "Largest average-temp increase",
      kind: "top-temperature",
    });
  }

  // Right side: independently show the state with the largest summer very hot day increase.
  const topHotday = allHotdaySeries.reduce((best, d) =>
    finalHotdayValue(d) > finalHotdayValue(best) ? d : best,
    allHotdaySeries[0]
  );

  const rightPanel = topHotday ? {
    stateName: topHotday.stateName,
    series: topHotday.series,
    label: "Largest summer very hot day increase",
    kind: "top-hotday",
  } : null;

  const maxValue = d3.max(allHotdaySeries, finalHotdayValue) || 1;

  return {
    panels: [...leftPanels, ...(rightPanel ? [rightPanel] : [])],
    leftPanels,
    rightPanel,
    maxValue,
    years: d3.range(START_YEAR, END_YEAR + 1, 10),
    sameAsTopTemp,
    topTempStateName,
    topHotdayStateName: topHotday?.stateName,
  };
}

function getHighEmissionStateHotdayChangeSeries() {
  if (highEmissionHotdayStateChangeCache) return highEmissionHotdayStateChangeCache;

  const rows = stateData.filter((d) =>
    d.scenario === "ssp585" &&
    d.year >= START_YEAR && d.year <= END_YEAR &&
    Number.isFinite(getAlignedHotDaysValue(d)) &&
    d.state
  );

  const byState = d3.group(rows, (d) => normalizeStateName(d.state));
  highEmissionHotdayStateChangeCache = Array.from(byState, ([stateName, values]) => {
    const yearly = Array.from(
      d3.rollup(
        values,
        (v) => ({
          year: v[0].year,
          days: Math.max(0, d3.mean(v, (d) => getAlignedHotDaysValue(d)) || 0),
          rawRollingDays: Math.max(0, d3.mean(v, (d) => getHotDayRollingInfo(d)?.rawRolling ?? NaN) || 0),
          rollingWindow: d3.max(v, (d) => getHotDayRollingInfo(d)?.rollingWindow || 1),
        }),
        (d) => d.year
      ).values()
    ).sort((a, b) => d3.ascending(a.year, b.year));

    return {
      stateName,
      scenario: "ssp585",
      series: yearly.filter((d) => Number.isFinite(d.days)),
    };
  }).filter((d) => d.series.length);

  return highEmissionHotdayStateChangeCache;
}

function drawMiniStateShape(g, feature, x, y, boxW, boxH, fill) {
  const box = g.append("g").attr("transform", `translate(${x},${y})`);
  if (!feature) {
    box.append("rect")
      .attr("class", "mini-state-shape")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("rx", 18)
      .attr("fill", fill)
      .attr("stroke", "rgba(23,32,42,0.12)");
    box.append("text")
      .attr("x", boxW / 2)
      .attr("y", boxH / 2 + 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#5f6b73")
      .attr("font-size", 12)
      .attr("font-weight", 800)
      .text("U.S. avg");
    return;
  }

  const bounds = path.bounds(feature);
  const dx = Math.max(1, bounds[1][0] - bounds[0][0]);
  const dy = Math.max(1, bounds[1][1] - bounds[0][1]);
  const scale = Math.min((boxW - 34) / dx, (boxH - 30) / dy);
  const tx = boxW / 2 - scale * (bounds[0][0] + bounds[1][0]) / 2;
  const ty = boxH / 2 - scale * (bounds[0][1] + bounds[1][1]) / 2;

  box.append("path")
    .attr("class", "mini-state-shape")
    .datum(feature)
    .attr("d", path)
    .attr("transform", `translate(${tx},${ty}) scale(${scale})`)
    .attr("fill", fill)
    .attr("stroke", "rgba(23,32,42,0.34)")
    .attr("stroke-width", Math.max(0.7 / scale, 0.002));
}

function cancelStateHotdaySmallMultipleAnimation() {
  if (stateHotdaySmallMultipleTimer) {
    stateHotdaySmallMultipleTimer.stop?.();
    window.clearInterval(stateHotdaySmallMultipleTimer);
    stateHotdaySmallMultipleTimer = null;
  }
}

function renderStateHotdaySmallMultiples() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("state-hotday-small-multiples");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const comparison = getStateHotdayComparison();
  if (!comparison) {
    mapNote.text("No state-level summer very hot day data available for high emissions.");
    return;
  }

  const { leftPanels, rightPanel, maxValue, years, sameAsTopTemp } = comparison;
  const color = d3.scaleSequential()
    .domain([0, Math.max(1, maxValue)])
    .interpolator(interpolateHotDaysWhiteToRed);

  const g = svg.append("g").attr("class", "state-hotday-small-multiples immersive-state-compare");

  g.append("text")
    .attr("x", 54)
    .attr("y", 58)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text("STATE-LEVEL EXTREME HEAT");

  g.append("text")
    .attr("x", 54)
    .attr("y", 94)
    .attr("fill", "#17202a")
    .attr("font-size", 27)
    .attr("font-weight", 900)
    .text("Extreme heat days follow a different map.");

  g.append("text")
    .attr("x", 54)
    .attr("y", 122)
    .attr("fill", "#5f6b73")
    .attr("font-size", 13)
    .text("The earlier warming states are compared with the state adding the most extreme-heat days.");

  const yearDisplay = g.append("g")
    .attr("transform", `translate(${width - 205},${-6})`);

  yearDisplay.append("text")
    .attr("x", 0)
    .attr("y", 28)
    .attr("fill", "#7a858d")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text("YEAR");

  const yearText = yearDisplay.append("text")
    .attr("x", 56)
    .attr("y", 29)
    .attr("fill", "#17202a")
    .attr("font-size", 36)
    .attr("font-weight", 950)
    .text(START_YEAR);

  const leftGroupX = leftPanels.length === 1 ? 142 : 54;
  const panelW = leftPanels.length === 1 ? 300 : 232;
  const panelH = 250;
  const panelGap = 28;
  const panelY = 190;
  const rightW = 250;
  const rightX = width - rightW - 58;

  const sectionY = 154;
  g.append("text")
    .attr("x", leftGroupX)
    .attr("y", sectionY)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.07em")
    .text(sameAsTopTemp
      ? "YOUR STATE IS ALSO THE FASTEST-WARMING STATE"
      : "PREVIOUS WARMING STATES");

  g.append("text")
    .attr("x", rightX)
    .attr("y", sectionY)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.07em")
    .text("MOST EXTRA SUMMER 35°C+ DAYS");

  const positionedLeftPanels = leftPanels.map((d, i) => ({
    ...d,
    x: leftGroupX + i * (panelW + panelGap),
    y: panelY,
    w: panelW,
    h: panelH,
    side: "left",
  }));

  const positionedRightPanels = rightPanel ? [{
    ...rightPanel,
    x: rightX,
    y: panelY,
    w: rightW,
    h: panelH,
    side: "right",
  }] : [];

  const panels = [...positionedLeftPanels, ...positionedRightPanels];

  const panel = g.selectAll("g.hotday-state-panel")
    .data(panels)
    .join("g")
    .attr("class", (d) => `hotday-state-panel ${d.kind.includes("hotday") ? "is-top-hotday" : d.kind.includes("top") ? "is-top" : "is-selected"}`)
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .attr("opacity", 0);

  panel.append("text")
    .attr("x", (d) => d.w / 2)
    .attr("y", 0)
    .attr("text-anchor", "middle")
    .attr("fill", "#7a858d")
    .attr("font-size", 10.5)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.06em")
    .text((d) => d.label.toUpperCase());

  panel.append("text")
    .attr("x", (d) => d.w / 2)
    .attr("y", 34)
    .attr("text-anchor", "middle")
    .attr("fill", "#17202a")
    .attr("font-size", (d) => d.stateName.length > 13 ? 22 : 26)
    .attr("font-weight", 900)
    .text((d) => d.stateName);

  panel.each(function(d) {
    const panelG = d3.select(this);
    const feature = getStateFeature(d.stateName);
    drawMiniStateShape(panelG, feature, 14, 58, d.w - 28, 125, color(0));
  });

  const valueText = panel.append("text")
    .attr("class", "hotday-state-value")
    .attr("x", (d) => d.w / 2)
    .attr("y", 220)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4512c")
    .attr("font-size", 34)
    .attr("font-weight", 950)
    .text("+0.0 days");

  panel.append("text")
    .attr("x", (d) => d.w / 2)
    .attr("y", 244)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 11.5)
    .text("5-year avg. added very hot summer days");

  if (positionedLeftPanels.length && positionedRightPanels.length) {
    const dividerX = rightX - 42;
    g.append("line")
      .attr("x1", dividerX)
      .attr("x2", dividerX)
      .attr("y1", 150)
      .attr("y2", 462)
      .attr("stroke", "rgba(143,47,27,0.22)")
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "5 7");
  }

  panel.transition()
    .delay((d, i) => 140 + i * 170)
    .duration(520)
    .attr("opacity", 1);

  const legend = g.append("g")
    .attr("transform", `translate(${width / 2 - 190},${height - 56})`);

  const legendW = 380;
  const defs = svg.append("defs");
  const gradId = "hotday-state-gradient";
  const grad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("x2", "100%");
  d3.range(0, 1.01, 0.1).forEach((t) => {
    grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(t * maxValue));
  });

  legend.append("rect")
    .attr("width", legendW)
    .attr("height", 10)
    .attr("rx", 5)
    .attr("fill", `url(#${gradId})`);
  legend.append("text")
    .attr("x", 0)
    .attr("y", 29)
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .text("0 days");
  legend.append("text")
    .attr("x", legendW)
    .attr("y", 29)
    .attr("text-anchor", "end")
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .text(`${d3.format(".1f")(maxValue)} days`);

  legend.append("text")
    .attr("x", legendW / 2)
    .attr("y", 49)
    .attr("text-anchor", "middle")
    .attr("fill", "#7a858d")
    .attr("font-size", 11)
    .attr("font-weight", 800)
    .text("5-year avg. increase in very hot summer days");

  function updateYear(year, immediate = false) {
    const duration = immediate ? 0 : 520;
    yearText.text(year);
    panel.each(function(d) {
      const row = getNearestYearRow(d.series, year);
      const days = row?.days ?? 0;
      d3.select(this).select(".mini-state-shape")
        .transition()
        .duration(duration)
        .attr("fill", color(days));
      d3.select(this).select(".hotday-state-value")
        .transition()
        .duration(duration)
        .tween("text", function() {
          const current = Number(String(this.textContent).replace(/[^0-9.\-]/g, "")) || 0;
          const interp = d3.interpolateNumber(current, days);
          return function(t) {
            this.textContent = `${d3.format("+.1f")(interp(t))} days`;
          };
        });
    });
  }

  updateYear(START_YEAR, true);

  let index = 0;
  stateHotdaySmallMultipleTimer = d3.interval(() => {
    index += 1;
    if (index >= years.length) {
      stateHotdaySmallMultipleTimer.stop();
      stateHotdaySmallMultipleTimer = null;
      updateYear(END_YEAR);
      return;
    }
    updateYear(years[index]);
  }, 850);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Color shows 5-year average added very hot summer days. Left: earlier warming states; right: largest hot-day increase.");
}

function renderThresholdExplanation() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("threshold-explanation");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const comparison = getStateHotdayComparison();
  if (!comparison) {
    mapNote.text("No state threshold comparison available.");
    return;
  }

  const candidatePanels = [
    ...(comparison.leftPanels ?? []),
    ...(comparison.rightPanel ? [comparison.rightPanel] : []),
  ];

  const merged = new Map();
  candidatePanels.forEach((d) => {
    if (!d || !d.stateName) return;

    const key = normalizeStateName(d.stateName);
    const finalRow = getNearestYearRow(d.series, END_YEAR) || d.series?.[d.series.length - 1];
    const finalDays = Math.max(0, finalRow?.days ?? 0);

    const role = d.kind?.includes("top-hotday")
      ? "Most very hot summer days added"
      : d.kind?.includes("top-temperature")
        ? "Fastest average-temperature increase"
        : "Your state";

    const existing = merged.get(key);
    if (existing) {
      existing.roles.push(role);
      existing.label = existing.roles.join(" + ");
      existing.finalDays = Math.max(existing.finalDays, finalDays);
    } else {
      merged.set(key, {
        ...d,
        roles: [role],
        label: role,
        finalDays,
      });
    }
  });

  const panels = Array.from(merged.values());
  const maxValue = Math.max(1, d3.max(panels, (d) => d.finalDays) || comparison.maxValue || 1);

  if (!panels.length) {
    mapNote.text("No state threshold comparison available.");
    return;
  }

  const defs = svg.append("defs");

  defs.append("marker")
    .attr("id", "threshold-ladder-arrow-soft")
    .attr("viewBox", "0 0 12 12")
    .attr("refX", 10)
    .attr("refY", 6)
    .attr("markerWidth", 8)
    .attr("markerHeight", 8)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 1 1 L 11 6 L 1 11 Z")
    .attr("fill", "#c4512c");

  const glow = defs.append("filter")
    .attr("id", "threshold-soft-glow")
    .attr("x", "-40%")
    .attr("y", "-40%")
    .attr("width", "180%")
    .attr("height", "180%");

  glow.append("feGaussianBlur")
    .attr("stdDeviation", 3)
    .attr("result", "coloredBlur");

  const merge = glow.append("feMerge");
  merge.append("feMergeNode").attr("in", "coloredBlur");
  merge.append("feMergeNode").attr("in", "SourceGraphic");

  const g = svg.append("g")
    .attr("class", "threshold-explanation-viz immersive-threshold-ladder");

  g.append("text")
    .attr("x", 54)
    .attr("y", 24)
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text("WHY EXTREME DAYS GROW DIFFERENTLY");

  g.append("text")
    .attr("x", 54)
    .attr("y", 52)
    .attr("fill", "#17202a")
    .attr("font-size", 23)
    .attr("font-weight", 950)
    .text("Extreme heat risk depends on where a state starts.");

  const intro = g.append("text")
    .attr("x", 54)
    .attr("y", 82)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12.5);

  intro.append("tspan")
    .attr("x", 54)
    .text("Starting heat + warming shift determines how many days cross the fixed 35°C line.");

  intro.append("tspan")
    .attr("x", 54)
    .attr("dy", 17)
    .text("This explains why the fastest-warming state may differ from the state adding the most very hot days.");

  const panelCount = panels.length;
  const panelW = panelCount === 1 ? 330 : panelCount === 2 ? 280 : 220;
  const gap = panelCount === 1 ? 0 : panelCount === 2 ? 86 : 58;
  const startX = (width - panelCount * panelW - (panelCount - 1) * gap) / 2;

  const topY = 225;
  const ladderH = 210;
  const thresholdY = topY + 68;
  const baseYMax = topY + ladderH - 32;
  const baseYMin = thresholdY + 32;

  const closeness = d3.scaleLinear()
    .domain([0, maxValue])
    .range([baseYMax, baseYMin])
    .clamp(true);

  const pushLen = d3.scaleLinear()
    .domain([0, maxValue])
    .range([46, 124])
    .clamp(true);

  const color = d3.scaleSequential()
    .domain([0, maxValue])
    .interpolator(d3.interpolateOrRd);

  const thresholdLineStart = startX - 22;
  const thresholdLineEnd = startX + panelCount * panelW + (panelCount - 1) * gap + 22;

  g.append("line")
    .attr("x1", thresholdLineStart)
    .attr("x2", thresholdLineEnd)
    .attr("y1", thresholdY)
    .attr("y2", thresholdY)
    .attr("stroke", "#8f2f1b")
    .attr("stroke-width", 1.35)
    .attr("stroke-dasharray", "5 8")
    .attr("stroke-linecap", "round")
    .attr("opacity", 0.7);

  g.append("text")
    .attr("x", thresholdLineEnd)
    .attr("y", thresholdY - 11)
    .attr("text-anchor", "end")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.03em")
    .text("35°C threshold");

  const panel = g.selectAll("g.threshold-ladder-panel")
    .data(panels)
    .join("g")
    .attr("class", (d) =>
      `threshold-ladder-panel ${
        d.kind?.includes("top-hotday")
          ? "is-hotday-top"
          : d.kind?.includes("top-temperature")
            ? "is-temp-top"
            : "is-selected"
      }`
    )
    .attr("transform", (d, i) => `translate(${startX + i * (panelW + gap)},0)`)
    .attr("opacity", 0);

  panel.each(function(d) {
    const group = d3.select(this);
    const cx = panelW / 2;
    const baseY = closeness(d.finalDays);
    const futureY = Math.min(baseY - pushLen(d.finalDays), thresholdY - 24);

    group.append("text")
      .attr("x", cx)
      .attr("y", topY - 104)
      .attr("text-anchor", "middle")
      .attr("fill", "#17202a")
      .attr("font-size", panelCount === 3 ? 17 : 20)
      .attr("font-weight", 950)
      .text(d.stateName);

    wrapSvgText(
      group.append("text")
        .attr("x", cx)
        .attr("y", topY - 82)
        .attr("text-anchor", "middle")
        .attr("fill", d.kind?.includes("top-hotday") ? "#8f2f1b" : "#5f6b73")
        .attr("font-size", 10.2)
        .attr("font-weight", 850)
        .attr("letter-spacing", "0.04em"),
      d.label.toUpperCase(),
      panelW - 24,
      12
    );

    const startRow = getNearestYearRow(d.series, START_YEAR) || d.series?.[0];
    const startDays = Math.max(0, startRow?.days ?? 0);

    const arrowColor = "#c4512c";
    const dotR = 4.2;
    const arrowStartY = baseY - dotR - 1;
    const arrowEndY = futureY + 6;

    // Starting heat dot: smaller, so the arrow carries the main visual emphasis.
    group.append("circle")
      .attr("cx", cx)
      .attr("cy", baseY)
      .attr("r", dotR)
      .attr("fill", "#7f8a91")
      .attr("stroke", "rgba(255,255,255,0.95)")
      .attr("stroke-width", 1.5);

    // Warming push arrow: starts from the lower dot and points to the upper projected position.
    // Draw the shaft and arrowhead directly instead of relying on SVG marker-end, so it
    // stays visible across browser/SVG refreshes.
    const arrowGroup = group.append("g")
      .attr("class", "threshold-warming-arrow")
      .attr("filter", "url(#threshold-soft-glow)");

    arrowGroup.append("line")
      .attr("x1", cx)
      .attr("x2", cx)
      .attr("y1", arrowStartY)
      .attr("y2", arrowStartY)
      .attr("stroke", arrowColor)
      .attr("stroke-width", 3.25)
      .attr("stroke-linecap", "round")
      .transition()
      .delay(260)
      .duration(760)
      .ease(d3.easeCubicOut)
      .attr("y2", arrowEndY + 9);

    arrowGroup.append("path")
      .attr("d", `M ${cx} ${arrowEndY - 8} L ${cx - 7} ${arrowEndY + 7} L ${cx + 7} ${arrowEndY + 7} Z`)
      .attr("fill", arrowColor)
      .attr("opacity", 0)
      .transition()
      .delay(820)
      .duration(220)
      .attr("opacity", 1);

    // Numeric callouts: future value above the arrow, starting value below the point.
    group.append("text")
      .attr("x", cx)
      .attr("y", futureY - 12)
      .attr("text-anchor", "middle")
      .attr("fill", arrowColor)
      .attr("font-size", 18)
      .attr("font-weight", 950)
      .text(d3.format("+.1f")(d.finalDays));


    // Only show the part above the 35°C threshold.
    const crossingX = cx + 34;
    const crossingWidth = 10;
    const crossingHeight = Math.max(0, thresholdY - futureY);

    if (crossingHeight > 0) {
      group.append("rect")
        .attr("x", crossingX - crossingWidth / 2)
        .attr("y", thresholdY)
        .attr("width", crossingWidth)
        .attr("height", 0)
        .attr("rx", 5)
        .attr("fill", "#b33a2b")
        .attr("opacity", 0.86)
        .attr("filter", "url(#threshold-soft-glow)")
        .transition()
        .delay(640)
        .duration(620)
        .ease(d3.easeCubicOut)
        .attr("y", futureY)
        .attr("height", crossingHeight);
    }

    // Small threshold tick near the crossing bar.
    group.append("line")
      .attr("x1", crossingX - 11)
      .attr("x2", crossingX + 11)
      .attr("y1", thresholdY)
      .attr("y2", thresholdY)
      .attr("stroke", "#8f2f1b")
      .attr("stroke-width", 1.15)
      .attr("opacity", 0.72);

    group.append("text")
      .attr("x", cx)
      .attr("y", baseYMax + 52)
      .attr("text-anchor", "middle")
      .attr("fill", "#5f6b73")
      .attr("font-size", 11.2)
      .attr("font-weight", 750)
      .text("5-year avg. added very hot summer days");
  });

  panel.transition()
    .delay((d, i) => 130 + i * 180)
    .duration(520)
    .attr("opacity", 1);

  g.append("text")
    .attr("x", width / 2)
    .attr("y", height - 62)
    .attr("text-anchor", "middle")
    .attr("fill", "#17202a")
    .attr("font-size", 15)
    .attr("font-weight", 900)
    .text("Therefore, the next views track very hot summer days directly, not only average temperature.")
    .attr("opacity", 0)
    .transition()
    .delay(980)
    .duration(520)
    .attr("opacity", 1);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Conceptual ladder: grey dot = starting heat, arrow = warming push to the projected future position, red segment = days crossing 35°C. Values use baseline-aligned summer very hot day changes.");
}

function wrapSvgText(textSelection, text, maxWidth, lineHeight = 14) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  textSelection.text(null);
  let line = [];
  let lineNumber = 0;
  const x = +textSelection.attr("x") || 0;
  const y = +textSelection.attr("y") || 0;
  const anchor = textSelection.attr("text-anchor") || "start";
  let tspan = textSelection.append("tspan")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", anchor);

  words.forEach((word) => {
    line.push(word);
    tspan.text(line.join(" "));
    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
      line.pop();
      tspan.text(line.join(" "));
      line = [word];
      lineNumber += 1;
      tspan = textSelection.append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", lineNumber * lineHeight)
        .attr("text-anchor", anchor)
        .text(word);
    }
  });
}


function renderRiskTransition() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("risk-transition");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const g = svg.append("g")
    .attr("class", "risk-transition-viz")
    .attr("transform", `translate(${width / 2},${height / 2 - 20})`);

  g.append("text")
    .attr("x", 0)
    .attr("y", -82)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.10em")
    .text("THEREFORE");

  g.append("text")
    .attr("x", 0)
    .attr("y", -34)
    .attr("text-anchor", "middle")
    .attr("fill", "#17202a")
    .attr("font-size", 36)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.045em")
    .text("Track very hot summer days directly.");

  const lines = [
    "Average temperature explains the background warming.",
    "Very hot summer days show when that warming becomes daily exposure."
  ];

  g.selectAll("text.risk-transition-line")
    .data(lines)
    .join("text")
    .attr("class", "risk-transition-line")
    .attr("x", 0)
    .attr("y", (_, i) => 12 + i * 30)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 18)
    .attr("font-weight", 650)
    .text((d) => d);

  const chips = ["direct metric", "state pattern", "2100 risk"];
  const chipG = g.selectAll("g.risk-chip")
    .data(chips)
    .join("g")
    .attr("class", "risk-chip")
    .attr("transform", (_, i) => `translate(${(i - 1) * 170},94)`);

  chipG.append("rect")
    .attr("x", -70)
    .attr("y", -18)
    .attr("width", 140)
    .attr("height", 36)
    .attr("rx", 18)
    .attr("fill", "rgba(255, 245, 235, 0.70)")
    .attr("stroke", "rgba(196, 81, 44, 0.20)");

  chipG.append("text")
    .attr("x", 0)
    .attr("y", 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.04em")
    .text((d) => d.toUpperCase());

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Next: a static 2100 map of baseline-aligned 5-year average added very hot summer days.");
}

function renderCompareLineChart() {
  const chartCycleId = renderCycleId;
  hideTrendSummary(); 
  hideMapYearOverlay();
  setVizMode("compare-line");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const margin = { top: 54, right: 170, bottom: 54, left: 68 };
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
    .domain(["Avg warming change", "Extra very hot days"])
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
            setTimeout(() => showCompareSummary(grouped, chartCycleId), 300);
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


const STATE_POPULATION_PROXY_2020 = {
  "Alabama": 5024279,
  "Alaska": 733391,
  "Arizona": 7151502,
  "Arkansas": 3011524,
  "California": 39538223,
  "Colorado": 5773714,
  "Connecticut": 3605944,
  "Delaware": 989948,
  "District of Columbia": 689545,
  "Florida": 21538187,
  "Georgia": 10711908,
  "Hawaii": 1455271,
  "Idaho": 1839106,
  "Illinois": 12812508,
  "Indiana": 6785528,
  "Iowa": 3190369,
  "Kansas": 2937880,
  "Kentucky": 4505836,
  "Louisiana": 4657757,
  "Maine": 1362359,
  "Maryland": 6177224,
  "Massachusetts": 7029917,
  "Michigan": 10077331,
  "Minnesota": 5706494,
  "Mississippi": 2961279,
  "Missouri": 6154913,
  "Montana": 1084225,
  "Nebraska": 1961504,
  "Nevada": 3104614,
  "New Hampshire": 1377529,
  "New Jersey": 9288994,
  "New Mexico": 2117522,
  "New York": 20201249,
  "North Carolina": 10439388,
  "North Dakota": 779094,
  "Ohio": 11799448,
  "Oklahoma": 3959353,
  "Oregon": 4237256,
  "Pennsylvania": 13002700,
  "Rhode Island": 1097379,
  "South Carolina": 5118425,
  "South Dakota": 886667,
  "Tennessee": 6910840,
  "Texas": 29145505,
  "Utah": 3271616,
  "Vermont": 643077,
  "Virginia": 8631393,
  "Washington": 7705281,
  "West Virginia": 1793716,
  "Wisconsin": 5893718,
  "Wyoming": 576851
};

function getImpactContextRow(stateName, scenario = "ssp585", year = END_YEAR) {
  if (!impactContextData?.length) return null;
  const normalized = normalizeStateName(stateName);
  return impactContextData.find((d) =>
    normalizeStateName(d.state) === normalized &&
    (!d.scenario || d.scenario === scenario) &&
    (!d.year || +d.year === +year)
  ) || null;
}

function coalesceFinite(...values) {
  for (const value of values) {
    const numeric = +value;
    if (Number.isFinite(numeric)) return numeric;
  }
  return NaN;
}

function getExposureRows(scenario = "ssp585", year = END_YEAR) {
  const hazardRows = stateData.filter((d) =>
    d.scenario === scenario &&
    d.year === year &&
    Number.isFinite(getAlignedHotDaysValue(d))
  );

  return hazardRows.map((d) => {
    const stateName = normalizeStateName(d.state);
    const impact = getImpactContextRow(stateName, scenario, year);
    const hazard = coalesceFinite(
      impact?.added_summer_35c_days_2100_aligned_5yr,
      impact?.added_summer_35c_days_aligned_5yr,
      impact?.added_summer_35c_days_aligned_5yr_clipped,
      getAlignedHotDaysValue(d)
    );
    const population = coalesceFinite(
      impact?.projected_total_population,
      impact?.population,
      STATE_POPULATION_PROXY_2020[stateName]
    );
    const exposure = coalesceFinite(
      impact?.population_exposure_days_proxy,
      impact?.exposure_days_proxy,
      Number.isFinite(hazard) && Number.isFinite(population) ? Math.max(0, hazard) * population : NaN
    );
    const exposureMillions = coalesceFinite(
      impact?.population_exposure_days_proxy_millions,
      Number.isFinite(exposure) ? exposure / 1000000 : NaN
    );
    return {
      state: stateName,
      scenario,
      year,
      hazard: Math.max(0, hazard),
      population,
      populationMillions: Number.isFinite(population) ? population / 1000000 : NaN,
      exposure,
      exposureMillions,
      source: impact ? "impact file" : "population fallback"
    };
  }).filter((d) => Number.isFinite(d.hazard) && Number.isFinite(d.populationMillions) && Number.isFinite(d.exposureMillions));
}

function formatExposureMillions(value) {
  if (!Number.isFinite(value)) return "N/A";
  if (value >= 1000) return `${d3.format(".2s")(value * 1000000).replace("G", "B")} exposure-days`;
  return `${d3.format(".1f")(value)}M exposure-days`;
}

function drawBubbleSizeLegendCard(container, options = {}) {
  const {
    x = 0,
    y = 0,
    width = 188,
    height = 92,
    title = "BUBBLE SIZE",
    subtitle = "exposure-days proxy",
    maxValue = 1,
    valueRatios = [1, 0.35],
    radiusScale = d3.scaleSqrt().domain([0, Math.max(1, maxValue)]).range([3, 12]),
    titleColor = "#8f2f1b",
    fill = "rgba(196,81,44,0.18)",
    stroke = "rgba(143,47,27,0.58)",
    background = "rgba(255, 249, 244, 0.94)",
    border = "rgba(196, 81, 44, 0.16)",
    compactLabels = false,
  } = options;

  const values = valueRatios
    .map((ratio) => Math.max(0, maxValue * ratio))
    .filter((d, i, arr) => Number.isFinite(d) && d > 0 && arr.indexOf(d) === i);

  const card = container.append("g")
    .attr("class", "bubble-size-legend-card")
    .attr("transform", `translate(${x},${y})`)
    .style("pointer-events", "none");

  card.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("rx", 18)
    .attr("fill", background)
    .attr("stroke", border)
    .attr("stroke-width", 1);

  if (!compactLabels) {
    card.append("text")
      .attr("x", 14)
      .attr("y", 20)
      .attr("fill", titleColor)
      .attr("font-size", 10)
      .attr("font-weight", 900)
      .attr("letter-spacing", "0.08em")
      .text(title);

    card.append("text")
      .attr("x", 14)
      .attr("y", 34)
      .attr("fill", "#5f6b73")
      .attr("font-size", 9)
      .attr("font-weight", 750)
      .text(subtitle);

    const baseY = height - 14;
    const centerX = 28;
    const lineEndX = width - 78;
    const labelX = width - 12;

    const items = card.selectAll("g.bubble-size-legend-item")
      .data(values)
      .join("g")
      .attr("class", "bubble-size-legend-item");

    items.append("circle")
      .attr("cx", centerX)
      .attr("cy", (d) => baseY - radiusScale(d))
      .attr("r", (d) => radiusScale(d))
      .attr("fill", fill)
      .attr("stroke", stroke)
      .attr("stroke-width", 1);

    items.append("line")
      .attr("x1", (d) => centerX + radiusScale(d) + 5)
      .attr("x2", lineEndX)
      .attr("y1", (d) => baseY - radiusScale(d) * 2)
      .attr("y2", (d) => baseY - radiusScale(d) * 2)
      .attr("stroke", "rgba(95,107,115,0.34)");

    items.append("text")
      .attr("x", labelX)
      .attr("y", (d) => baseY - radiusScale(d) * 2 + 3.5)
      .attr("text-anchor", "end")
      .attr("fill", "#5f6b73")
      .attr("font-size", 9.5)
      .attr("font-weight", 800)
      .text((d) => formatExposureMillions(d));

    return card;
  }

  const sortedValues = [...values].sort((a, b) => d3.descending(a, b));

  card.append("text")
    .attr("x", 12)
    .attr("y", 18)
    .attr("fill", titleColor)
    .attr("font-size", 9.4)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.07em")
    .text(title);

  card.append("text")
    .attr("x", 12)
    .attr("y", 30)
    .attr("fill", "#5f6b73")
    .attr("font-size", 7.8)
    .attr("font-weight", 750)
    .text(subtitle);

  const baseY = height - 16;
  const centerX = 24;
  const lineEndX = width - 72;
  const labelX = width - 10;
  const labelRows = d3.scalePoint().domain(d3.range(sortedValues.length)).range([height - 36, height - 18]);

  const items = card.selectAll("g.bubble-size-legend-item")
    .data(sortedValues.map((value, index) => ({ value, index })))
    .join("g")
    .attr("class", "bubble-size-legend-item");

  items.append("circle")
    .attr("cx", centerX)
    .attr("cy", (d) => baseY - radiusScale(d.value))
    .attr("r", (d) => radiusScale(d.value))
    .attr("fill", fill)
    .attr("stroke", stroke)
    .attr("stroke-width", 1);

  items.append("line")
    .attr("x1", (d) => centerX + radiusScale(d.value) + 5)
    .attr("x2", lineEndX)
    .attr("y1", (d) => baseY - radiusScale(d.value) * 2)
    .attr("y2", (d) => labelRows(d.index))
    .attr("stroke", "rgba(95,107,115,0.34)");

  items.append("text")
    .attr("x", labelX)
    .attr("y", (d) => labelRows(d.index) + 3)
    .attr("text-anchor", "end")
    .attr("fill", "#5f6b73")
    .attr("font-size", 8.1)
    .attr("font-weight", 800)
    .text((d) => formatExposureMillions(d.value));

  return card;
}

function renderAnimatedExposureColorLegend(color, maxHotDays) {
  legendContainer
    .attr("class", "line-caption animated-exposure-legend")
    .html("");

  const legendWidth = 320;
  const legendHeight = 52;
  const legend = legendContainer
    .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("viewBox", `0 0 ${legendWidth} ${legendHeight}`);

  const defs = legend.append("defs");
  const gradientId = `animated-exposure-color-legend-${Date.now()}`;
  const gradient = defs.append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  d3.range(0, 1.01, 0.1).forEach((t) => {
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(t * maxHotDays));
  });

  legend.append("text")
    .attr("x", 8)
    .attr("y", 11)
    .attr("fill", "#5f6b73")
    .attr("font-size", 9.5)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text("COLOR = SUMMER 35°C+ DAYS");

  legend.append("rect")
    .attr("x", 8)
    .attr("y", 20)
    .attr("width", legendWidth - 16)
    .attr("height", 12)
    .attr("rx", 6)
    .attr("fill", `url(#${gradientId})`);

  legend.append("text")
    .attr("x", 8)
    .attr("y", 48)
    .attr("fill", "#555")
    .attr("font-size", 11)
    .text("0 days");

  legend.append("text")
    .attr("x", legendWidth - 8)
    .attr("y", 48)
    .attr("text-anchor", "end")
    .attr("fill", "#555")
    .attr("font-size", 11)
    .text(`${d3.format(".1f")(maxHotDays)} days`);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("One-pass 10-year animation: observed hot-day exposure for 2000–2020, then high-emissions projected exposure for 2030–2100. The animation stops at 2100; use the slider or Replay to inspect the sequence.");
}

function formatPopulationMillions(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${d3.format(".1f")(value)}M people`;
}

function getTopExposureSets(rows, n = 5) {
  return {
    hazard: rows.slice().sort((a, b) => d3.descending(a.hazard, b.hazard)).slice(0, n),
    population: rows.slice().sort((a, b) => d3.descending(a.populationMillions, b.populationMillions)).slice(0, n),
    exposure: rows.slice().sort((a, b) => d3.descending(a.exposureMillions, b.exposureMillions)).slice(0, n),
  };
}

function getObservedHotDaysRow(stateName, year = START_YEAR) {
  const normalized = normalizeStateName(stateName);
  const rows = allStoryData
    .filter((d) =>
      d.data_source === "observed" &&
      normalizeStateName(d.state) === normalized &&
      Number.isFinite(d.summer_hot_days_35c)
    )
    .sort((a, b) => d3.ascending(Math.abs(a.year - year), Math.abs(b.year - year)) || d3.ascending(a.year, b.year));
  return rows[0] || null;
}

function getObservedHotDaysValue(stateName, year = START_YEAR) {
  const row = getObservedHotDaysRow(stateName, year);
  return row && Number.isFinite(row.summer_hot_days_35c) ? Math.max(0, row.summer_hot_days_35c) : NaN;
}

function getProjectedPopulationForState(stateName, scenario = "ssp585", year = END_YEAR) {
  const pop2020 = STATE_POPULATION_PROXY_2020[stateName];
  const impact = getImpactContextRow(stateName, scenario, END_YEAR);
  const pop2100 = coalesceFinite(impact?.projected_total_population, impact?.population, pop2020);
  if (!Number.isFinite(pop2020) && !Number.isFinite(pop2100)) return NaN;
  if (year <= START_YEAR || !Number.isFinite(pop2100) || !Number.isFinite(pop2020)) return Number.isFinite(pop2020) ? pop2020 : pop2100;
  const t = Math.max(0, Math.min(1, (year - START_YEAR) / (END_YEAR - START_YEAR)));
  return pop2020 + (pop2100 - pop2020) * t;
}

function getStateExposureValue(stateName, scenario = "ssp585", year = END_YEAR) {
  const observedBaseline = getObservedHotDaysValue(stateName, START_YEAR);
  let hotDays = NaN;

  if (year <= START_YEAR) {
    hotDays = getObservedHotDaysValue(stateName, year);
  } else {
    const projected = stateData.find((d) =>
      normalizeStateName(d.state) === stateName &&
      d.scenario === scenario &&
      d.year === year
    );
    const added = projected ? getAlignedHotDaysValue(projected) : NaN;
    hotDays = Number.isFinite(observedBaseline) && Number.isFinite(added)
      ? Math.max(0, observedBaseline + added)
      : NaN;
  }

  const population = getProjectedPopulationForState(stateName, scenario, year);
  const exposure = Number.isFinite(hotDays) && Number.isFinite(population) ? hotDays * population : NaN;
  return {
    state: stateName,
    scenario,
    year,
    hotDays,
    population,
    populationMillions: Number.isFinite(population) ? population / 1000000 : NaN,
    exposure,
    exposureMillions: Number.isFinite(exposure) ? exposure / 1000000 : NaN,
    observedBaseline,
  };
}

function getExposureMapRows(scenario = "ssp585", year = END_YEAR) {
  const stateNames = Array.from(new Set([
    ...allStoryData.map((d) => normalizeStateName(d.state)),
    ...stateData.map((d) => normalizeStateName(d.state)),
  ].filter(Boolean))).sort(d3.ascending);

  return stateNames
    .map((stateName) => getStateExposureValue(stateName, scenario, year))
    .filter((d) => Number.isFinite(d.hotDays) && Number.isFinite(d.exposureMillions));
}

function getUSExposureComparisonRows(scenario = "ssp585") {
  const rows2020 = getExposureMapRows(scenario, START_YEAR);
  const rows2100 = getExposureMapRows(scenario, END_YEAR);
  const total2020 = d3.sum(rows2020, (d) => d.exposureMillions);
  const total2100 = d3.sum(rows2100, (d) => d.exposureMillions);
  const hot2020 = d3.sum(rows2020, (d) => d.hotDays * d.population) / d3.sum(rows2020, (d) => d.population);
  const hot2100 = d3.sum(rows2100, (d) => d.hotDays * d.population) / d3.sum(rows2100, (d) => d.population);
  return { rows2020, rows2100, total2020, total2100, hot2020, hot2100 };
}

function getExposureBubblePoint(stateName) {
  const manualAnchors = {
    "California": [-120.3, 36.5],
    "Texas": [-99.1, 31.0],
    "Florida": [-81.55, 28.1],
    "New York": [-75.3, 42.9],
    "New Jersey": [-74.7, 40.1],
    "Maryland": [-76.7, 39.0],
    "Delaware": [-75.5, 39.0],
    "Rhode Island": [-71.6, 41.7],
    "Massachusetts": [-71.8, 42.2],
    "Louisiana": [-92.7, 30.5],
    "Michigan": [-84.7, 44.3],
    "Alaska": [-150.0, 64.0],
    "Hawaii": [-157.5, 20.7]
  };
  const normalized = normalizeStateName(stateName);
  const lonLat = manualAnchors[normalized];
  if (lonLat) {
    const projected = projection(lonLat);
    if (projected) return projected;
  }
  const feature = getStateFeature(normalized);
  return feature ? path.centroid(feature) : [0, 0];
}

function renderAnimatedExposureMap() {
  hideTrendSummary();
  setVizMode("animated-exposure-map");
  svg.selectAll("*").remove();
  legendContainer.html("");
  currentState.scenario = "ssp585";
  currentState.metric = "summer_hot_days_35c_change_from_observed_2020";

  const years = d3.range(2000, 2101, 10);
  const allRows = years.flatMap((year) => getExposureMapRows("ssp585", year));
  if (!allRows.length) {
    mapNote.text("No exposure rows available for the animated map.");
    return;
  }

  const maxExposure = d3.max(allRows, (d) => d.exposureMillions) || 1;
  const maxHotDays = d3.max(allRows, (d) => d.hotDays) || 1;
  const radius = d3.scaleSqrt().domain([0, maxExposure]).range([1.5, 24]);
  const color = d3.scaleSequential().domain([0, maxHotDays]).interpolator(interpolateHotDaysWhiteToRed);

  const g = svg.append("g").attr("class", "animated-exposure-map-viz");
  const mapG = g.append("g")
    .attr("transform", "translate(-28,62) scale(0.82)");

  mapG.selectAll("path.exposure-map-state")
    .data(statesGeo.features)
    .join("path")
    .attr("class", "exposure-map-state")
    .attr("d", path)
    .attr("fill", "#f1eee8")
    .attr("stroke", "white")
    .attr("stroke-width", 0.8)
    .style("cursor", "pointer")
    .on("mouseenter", function(event, feature) {
      const stateName = normalizeStateName(getFeatureStateName(feature));
      const row = currentExposureRows.find((d) => d.state === stateName);
      if (!row) return;
      setExposureHighlight(stateName, false);
      showExposureTooltip(event, row);
    })
    .on("mousemove", function(event, feature) {
      const stateName = normalizeStateName(getFeatureStateName(feature));
      const row = currentExposureRows.find((d) => d.state === stateName);
      showExposureTooltip(event, row);
    })
    .on("mouseleave", clearExposureHover)
    .on("click", function(event, feature) {
      const stateName = normalizeStateName(getFeatureStateName(feature));
      const row = currentExposureRows.find((d) => d.state === stateName);
      if (!row) return;
      setExposureHighlight(stateName, true);
      showExposureTooltip(event, row);
    });

  const labelG = g.append("g").attr("transform", "translate(32,14)");
  labelG.append("text")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.14em")
    .text("ANIMATED EXPOSURE LAYER");
  labelG.append("text")
    .attr("y", 30)
    .attr("fill", "#17202a")
    .attr("font-size", 21)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.04em")
    .text("Observed hot days → projected exposure-days");
  labelG.append("text")
    .attr("y", 56)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12.5)
    .attr("font-weight", 650)
    .text("Fill = hot days. Bubble size = hot-day exposure-days proxy.");

  const yearText = g.append("text")
    .attr("x", 862)
    .attr("y", 72)
    .attr("text-anchor", "end")
    .attr("fill", "#17202a")
    .attr("font-size", 48)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.06em");

  const panel = g.append("g").attr("transform", "translate(690,142)");
  panel.append("rect")
    .attr("width", 202)
    .attr("height", 224)
    .attr("rx", 22)
    .attr("fill", "rgba(255,255,255,0.90)")
    .attr("stroke", "rgba(23,32,42,0.12)");
  panel.append("text")
    .attr("x", 16)
     .attr("y", 28)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.12em")
    .text("TOP EXPOSURE STATES");
  const panelRows = panel.append("g").attr("transform", "translate(16,55)");

  const legendMax = Math.max(1, maxExposure);
  drawBubbleSizeLegendCard(g, {
    x: 690,
    y: 386,
    width: 202,
    height: 122,
    maxValue: legendMax,
    valueRatios: [1, 0.35],
    radiusScale: radius,
    titleColor: "#8f2f1b",
    fill: "rgba(196,81,44,0.18)",
    stroke: "rgba(143,47,27,0.62)",
    background: "rgba(255,255,255,0.90)",
    border: "rgba(23,32,42,0.12)"
  });

  const bubbleLayer = mapG.append("g").attr("class", "exposure-bubbles-layer");
  let currentExposureRows = [];
  let pinnedExposureState = selectedStateName;
  let hoverExposureState = null;

  function getActiveExposureStates() {
    return new Set([hoverExposureState, pinnedExposureState].filter(Boolean));
  }

  function showExposureTooltip(event, row) {
    if (!row) return;
    tooltip
      .html(`
        <h3>${row.state}</h3>
        <p>Very hot summer days: <strong>${d3.format(".1f")(row.hotDays)} days</strong></p>
        <p>Population baseline/projection: <strong>${formatPopulationMillions(row.populationMillions)}</strong></p>
        <p>Exposure-days proxy: <strong>${formatExposureMillions(row.exposureMillions)}</strong></p>
      `)
      .style("left", `${event.clientX + 14}px`)
      .style("top", `${event.clientY + 14}px`)
      .attr("hidden", null);
  }

  function hideExposureTooltip() {
    tooltip.attr("hidden", true);
  }

  function setExposureHighlight(stateName, isPinned = false) {
    if (isPinned) {
      pinnedExposureState = stateName;
      selectedStateName = stateName;
      if (!statePicker.empty()) statePicker.property("value", stateName);
      updateSelectedStateFromCurrentView(false);
    } else {
      hoverExposureState = stateName;
    }
    applyExposureHighlight();
  }

  function clearExposureHover() {
    hoverExposureState = null;
    hideExposureTooltip();
    applyExposureHighlight();
  }

  function applyExposureHighlight() {
    const activeStates = getActiveExposureStates();
    mapG.selectAll("path.exposure-map-state")
      .attr("stroke", (feature) => activeStates.has(normalizeStateName(getFeatureStateName(feature))) ? "#ffd43b" : "white")
      .attr("stroke-width", (feature) => {
        const state = normalizeStateName(getFeatureStateName(feature));
        if (state === pinnedExposureState) return 3.4;
        return activeStates.has(state) ? 2.8 : 0.8;
      })
      .attr("filter", (feature) => activeStates.has(normalizeStateName(getFeatureStateName(feature))) ? "drop-shadow(0 0 4px rgba(255,212,59,0.85))" : null);

    bubbleLayer.selectAll("circle.exposure-state-bubble")
      .attr("stroke", (d) => activeStates.has(d.state) ? "#ffd43b" : "rgba(143,47,27,0.78)")
      .attr("stroke-width", (d) => d.state === pinnedExposureState ? 3.4 : (activeStates.has(d.state) ? 2.8 : 1.3))
      .attr("filter", (d) => activeStates.has(d.state) ? "drop-shadow(0 0 5px rgba(255,212,59,0.9))" : null)
      .attr("fill", (d) => activeStates.has(d.state) ? "rgba(255,212,59,0.42)" : "rgba(196,81,44,0.34)");
  }

  const controlState = {
    index: 0,
    isPlaying: false,
  };

  const controls = g.append("g")
    .attr("class", "exposure-animation-controls")
    .attr("transform", "translate(32,508)");

  const button = controls.append("g")
    .attr("class", "exposure-play-button")
    .attr("role", "button")
    .style("cursor", "pointer");

  button.append("rect")
    .attr("width", 84)
    .attr("height", 26)
    .attr("rx", 13)
    .attr("fill", "rgba(255,255,255,0.92)")
    .attr("stroke", "rgba(143,47,27,0.28)");

  const buttonText = button.append("text")
    .attr("x", 42)
    .attr("y", 17)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .text("Pause");

  const sliderX0 = 112;
  const sliderX1 = 610;
  const sliderY = 13;
  const sliderScale = d3.scaleLinear()
    .domain([0, years.length - 1])
    .range([sliderX0, sliderX1]);

  controls.append("line")
    .attr("class", "exposure-slider-track")
    .attr("x1", sliderX0)
    .attr("x2", sliderX1)
    .attr("y1", sliderY)
    .attr("y2", sliderY)
    .attr("stroke", "rgba(23,32,42,0.18)")
    .attr("stroke-width", 8)
    .attr("stroke-linecap", "round");

  const sliderFill = controls.append("line")
    .attr("class", "exposure-slider-fill")
    .attr("x1", sliderX0)
    .attr("x2", sliderX0)
    .attr("y1", sliderY)
    .attr("y2", sliderY)
    .attr("stroke", "rgba(196,81,44,0.72)")
    .attr("stroke-width", 8)
    .attr("stroke-linecap", "round");

  controls.selectAll("circle.exposure-slider-tick")
    .data(years)
    .join("circle")
    .attr("class", "exposure-slider-tick")
    .attr("cx", (_, i) => sliderScale(i))
    .attr("cy", sliderY)
    .attr("r", (d) => d % 20 === 0 ? 3 : 2)
    .attr("fill", "rgba(95,107,115,0.48)");

  controls.selectAll("text.exposure-slider-label")
    .data([2000, 2020, 2060, 2100])
    .join("text")
    .attr("class", "exposure-slider-label")
    .attr("x", (d) => sliderScale(years.indexOf(d)))
    .attr("y", 37)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 9.5)
    .attr("font-weight", 750)
    .text((d) => d);

  const sliderHit = controls.append("rect")
    .attr("x", sliderX0 - 8)
    .attr("y", sliderY - 13)
    .attr("width", sliderX1 - sliderX0 + 16)
    .attr("height", 26)
    .attr("fill", "transparent")
    .style("cursor", "pointer");

  const sliderHandle = controls.append("circle")
    .attr("class", "exposure-slider-handle")
    .attr("cx", sliderX0)
    .attr("cy", sliderY)
    .attr("r", 8)
    .attr("fill", "#fff")
    .attr("stroke", "#8f2f1b")
    .attr("stroke-width", 2.2)
    .style("filter", "drop-shadow(0 2px 4px rgba(23,32,42,0.18))")
    .style("cursor", "grab");

  const statusText = controls.append("text")
    .attr("x", sliderX1 + 18)
    .attr("y", 17)
    .attr("fill", "#5f6b73")
    .attr("font-size", 10.5)
    .attr("font-weight", 800)
    .text("10-year step");

  function setControlUI() {
    const xPos = sliderScale(controlState.index);
    sliderFill.attr("x2", xPos);
    sliderHandle.attr("cx", xPos);
    if (controlState.isPlaying) {
      buttonText.text("Pause");
      statusText.text("playing");
    } else if (controlState.index >= years.length - 1) {
      buttonText.text("Replay");
      statusText.text("stopped at 2100");
    } else {
      buttonText.text("Start");
      statusText.text("paused");
    }
  }

  function stopAnimation() {
    if (mapAnimationTimer) {
      mapAnimationTimer.stop();
      mapAnimationTimer = null;
    }
    controlState.isPlaying = false;
    setControlUI();
  }

  function updateYear(year, duration = 520) {
    currentState.year = year;
    syncControls();
    yearText.text(year);
    const rows = getExposureMapRows("ssp585", year);
    currentExposureRows = rows;
    const byState = new Map(rows.map((d) => [d.state, d]));

    mapG.selectAll("path.exposure-map-state")
      .transition()
      .duration(duration)
      .attr("fill", (feature) => {
        const row = byState.get(normalizeStateName(getFeatureStateName(feature)));
        return row ? color(row.hotDays) : "#f1eee8";
      })
      .attr("opacity", (feature) => byState.has(normalizeStateName(getFeatureStateName(feature))) ? 1 : 0.38)
      .on("end", applyExposureHighlight);

    const bubbles = bubbleLayer.selectAll("circle.exposure-state-bubble")
      .data(rows, (d) => d.state)
      .join(
        (enter) => enter.append("circle")
          .attr("class", "exposure-state-bubble")
          .attr("cx", (d) => getExposureBubblePoint(d.state)[0])
          .attr("cy", (d) => getExposureBubblePoint(d.state)[1])
          .attr("r", 0)
          .attr("fill", "rgba(196,81,44,0.34)")
          .attr("stroke", "rgba(143,47,27,0.78)")
          .attr("stroke-width", 1.3)
          .attr("pointer-events", "all")
          .style("cursor", "pointer")
          .call((enter) => enter.transition().duration(duration).attr("r", (d) => radius(d.exposureMillions))),
        (update) => update.call((update) => update.transition().duration(duration)
          .attr("cx", (d) => getExposureBubblePoint(d.state)[0])
          .attr("cy", (d) => getExposureBubblePoint(d.state)[1])
          .attr("r", (d) => radius(d.exposureMillions))),
        (exit) => exit.transition().duration(duration).attr("r", 0).remove()
      );

    bubbles
      .attr("pointer-events", "all")
      .style("cursor", "pointer")
      .on("mouseenter", function(event, d) {
        d3.select(this).raise();
        setExposureHighlight(d.state, false);
        showExposureTooltip(event, d);
      })
      .on("mousemove", function(event, d) {
        showExposureTooltip(event, d);
      })
      .on("mouseleave", clearExposureHover)
      .on("click", function(event, d) {
        d3.select(this).raise();
        setExposureHighlight(d.state, true);
        showExposureTooltip(event, d);
      });

    applyExposureHighlight();

    const top = rows.slice().sort((a, b) => d3.descending(a.exposureMillions, b.exposureMillions)).slice(0, 5);
    const maxTop = d3.max(top, (d) => d.exposureMillions) || 1;
    const row = panelRows.selectAll("g.top-exposure-row")
      .data(top, (d) => d.state)
      .join(
        (enter) => {
          const r = enter.append("g").attr("class", "top-exposure-row").style("opacity", 0);
          r.append("text").attr("class", "state-name").attr("x", 0).attr("y", 11).attr("fill", "#17202a").attr("font-size", 11).attr("font-weight", 850);
          r.append("rect").attr("class", "bar-bg").attr("x", 0).attr("y", 17).attr("width", 86).attr("height", 8).attr("rx", 4).attr("fill", "rgba(209,143,47,0.18)");
          r.append("rect").attr("class", "bar").attr("x", 0).attr("y", 17).attr("height", 8).attr("rx", 4).attr("fill", "#d18f2f");
          r.append("text").attr("class", "value").attr("x", 172).attr("y", 24).attr("text-anchor", "end").attr("fill", "#5f6b73").attr("font-size", 9.2).attr("font-weight", 800);
          return r;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("transform", (_, i) => `translate(0,${i * 32})`)
      .style("opacity", 1);

    row.select("text.state-name").text((d, i) => `${i + 1}. ${d.state}`);
    row.select("rect.bar").transition().duration(duration).attr("width", (d) => Math.max(4, 86 * d.exposureMillions / maxTop));
    row.select("text.value").text((d) => formatExposureMillions(d.exposureMillions));

    controlState.index = years.indexOf(year);
    setControlUI();
  }

  function goToIndex(nextIndex, duration = 520) {
    controlState.index = Math.max(0, Math.min(years.length - 1, nextIndex));
    updateYear(years[controlState.index], duration);
  }

  function playFromCurrent() {
    if (mapAnimationTimer) {
      mapAnimationTimer.stop();
      mapAnimationTimer = null;
    }
    if (controlState.index >= years.length - 1) {
      goToIndex(0, 260);
    }
    controlState.isPlaying = true;
    setControlUI();
    mapAnimationTimer = d3.interval(() => {
      if (controlState.index >= years.length - 1) {
        stopAnimation();
        return;
      }
      goToIndex(controlState.index + 1, 520);
      if (controlState.index >= years.length - 1) {
        // Let the final 2100 transition land, then stop instead of looping.
        if (mapAnimationTimer) {
          mapAnimationTimer.stop();
          mapAnimationTimer = null;
        }
        controlState.isPlaying = false;
        window.setTimeout(setControlUI, 560);
      }
    }, 900);
  }

  button.on("click", () => {
    if (controlState.isPlaying) {
      stopAnimation();
    } else {
      playFromCurrent();
    }
  });

  function setIndexFromPointer(event, duration = 160) {
    const [mx] = d3.pointer(event, controls.node());
    const ratio = (mx - sliderX0) / (sliderX1 - sliderX0);
    const nextIndex = Math.round(Math.max(0, Math.min(1, ratio)) * (years.length - 1));
    stopAnimation();
    goToIndex(nextIndex, duration);
  }

  sliderHit.on("pointerdown", function(event) {
    event.preventDefault();
    setIndexFromPointer(event, 160);
    d3.select(window)
      .on("pointermove.exposureSlider", (moveEvent) => setIndexFromPointer(moveEvent, 80))
      .on("pointerup.exposureSlider", () => {
        d3.select(window).on("pointermove.exposureSlider", null).on("pointerup.exposureSlider", null);
      }, { once: true });
  });

  sliderHandle.on("pointerdown", function(event) {
    event.preventDefault();
    sliderHandle.style("cursor", "grabbing");
    setIndexFromPointer(event, 120);
    d3.select(window)
      .on("pointermove.exposureSlider", (moveEvent) => setIndexFromPointer(moveEvent, 80))
      .on("pointerup.exposureSlider", () => {
        sliderHandle.style("cursor", "grab");
        d3.select(window).on("pointermove.exposureSlider", null).on("pointerup.exposureSlider", null);
      }, { once: true });
  });

  updateYear(years[0], 0);
  playFromCurrent();

  renderAnimatedExposureColorLegend(color, maxHotDays);
  mapNote.text("Slider controls the 10-year sequence. Fill = very hot summer days; bubble size = exposure-days proxy. 2000–2020 uses observed hot days; 2030–2100 uses baseline-aligned projected hot days under high emissions.");
}

function renderExposureLayerCards() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("exposure-layer-cards");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const allRows = getExposureMapRows("ssp585", END_YEAR)
    .map((d) => ({
      ...d,
      addedHotDays: Math.max(0, d.hotDays - d.observedBaseline),
    }))
    .filter((d) => Number.isFinite(d.addedHotDays) && Number.isFinite(d.populationMillions) && Number.isFinite(d.exposureMillions));

  if (!allRows.length) {
    mapNote.text("No exposure data available.");
    return;
  }

  const ranked = allRows.slice().sort((a, b) => d3.descending(a.exposureMillions, b.exposureMillions));
  const selectedName = selectedStateName || ranked[0]?.state;
  const selectedRow = ranked.find((d) => normalizeStateName(d.state) === normalizeStateName(selectedName)) || ranked[0];
  const selectedRank = ranked.findIndex((d) => d.state === selectedRow.state) + 1;
  const topRow = ranked[0];
  const selectedIsTop = topRow.state === selectedRow.state;
  const benchmarkRow = selectedIsTop ? null : topRow;
  const comparisonRows = benchmarkRow ? [selectedRow, benchmarkRow] : [selectedRow];

  const maxHot = d3.max(comparisonRows, (d) => d.addedHotDays) || 1;
  const maxPop = d3.max(comparisonRows, (d) => d.populationMillions) || 1;
  const maxExposure = d3.max(comparisonRows, (d) => d.exposureMillions) || 1;

  const g = svg.append("g").attr("class", "exposure-selected-state-viz");

  g.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 950)
    .attr("letter-spacing", "0.16em")
    .text("THEREFORE: EXTEND THE SELECTED STATE");

  g.append("text")
    .attr("x", width / 2)
    .attr("y", 61)
    .attr("text-anchor", "middle")
    .attr("fill", "#17202a")
    .attr("font-size", 26)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.05em")
    .text(`${selectedRow.state}: hot days × people = exposure-days`);

  g.append("text")
    .attr("x", width / 2)
    .attr("y", 84)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 760)
    .text(`#${selectedRank} of ${ranked.length} states by 2100 high-emissions exposure-days proxy.`);

  function drawFocusCard(parent, d, cfg) {
    const card = parent.append("g")
      .attr("class", `exposure-focus-card ${cfg.kind}`)
      .attr("transform", `translate(${cfg.x},${cfg.y})`);

    card.append("rect")
      .attr("width", cfg.w)
      .attr("height", cfg.h)
      .attr("rx", 26)
      .attr("fill", cfg.kind === "selected" ? "rgba(255,247,235,0.98)" : "rgba(255,255,255,0.92)")
      .attr("stroke", cfg.kind === "selected" ? "rgba(245,200,75,0.95)" : "rgba(23,32,42,0.12)")
      .attr("stroke-width", cfg.kind === "selected" ? 2.2 : 1.2);

    card.append("text")
      .attr("x", 24)
      .attr("y", 30)
      .attr("fill", "#8f2f1b")
      .attr("font-size", 10.5)
      .attr("font-weight", 950)
      .attr("letter-spacing", "0.14em")
      .text(cfg.eyebrow);

    card.append("text")
      .attr("x", 24)
       .attr("y", 53)
      .attr("fill", "#17202a")
      .attr("font-size", cfg.compact ? 23 : 29)
      .attr("font-weight", 950)
      .attr("letter-spacing", "-0.05em")
      .text(d.state);

    const eqY = cfg.compact ? 95 : 108;
    const barW = cfg.compact ? 96 : 112;
    const cols = [
      {
        x: 26,
        label: "ADDED HOT DAYS",
        value: `${d3.format("+.1f")(d.addedHotDays)} d`,
        color: "#c4512c",
        track: "rgba(196,81,44,0.13)",
        ratio: d.addedHotDays / maxHot,
      },
      {
        x: 184,
        label: "PROJECTED PEOPLE",
        value: `${d3.format(".1f")(d.populationMillions)}M`,
        color: "#4f8fc0",
        track: "rgba(79,143,192,0.13)",
        ratio: d.populationMillions / maxPop,
      },
      {
        x: 342,
        label: "EXPOSURE-DAYS",
        value: formatExposureMillions(d.exposureMillions),
        color: "#d18f2f",
        track: "rgba(209,143,47,0.14)",
        ratio: d.exposureMillions / maxExposure,
      },
    ];

    cols.forEach((col, i) => {
      const block = card.append("g").attr("transform", `translate(${col.x},${eqY})`);
      block.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("fill", "#5f6b73")
        .attr("font-size", 9.3)
        .attr("font-weight", 900)
        .attr("letter-spacing", "0.07em")
        .text(col.label);

      block.append("text")
        .attr("x", 0)
        .attr("y", 27)
        .attr("fill", "#17202a")
        .attr("font-size", i === 2 ? 18 : 17)
        .attr("font-weight", 950)
        .text(col.value);

      block.append("rect")
        .attr("x", 0)
        .attr("y", 40)
        .attr("width", barW)
        .attr("height", 13)
        .attr("rx", 7)
        .attr("fill", col.track);

      block.append("rect")
        .attr("x", 0)
        .attr("y", 40)
        .attr("height", 13)
        .attr("rx", 7)
        .attr("fill", col.color)
        .attr("opacity", 0.85)
        .attr("width", 0)
        .transition()
        .delay(160 + i * 150)
        .duration(640)
        .ease(d3.easeCubicOut)
        .attr("width", Math.max(8, Math.min(barW, col.ratio * barW)));
    });

    card.append("text")
      .attr("x", 162)
      .attr("y", eqY + 35)
      .attr("text-anchor", "middle")
      .attr("fill", "#8f2f1b")
      .attr("font-size", 23)
      .attr("font-weight", 950)
      .text("×");

    card.append("text")
      .attr("x", 320)
      .attr("y", eqY + 35)
      .attr("text-anchor", "middle")
      .attr("fill", "#8f2f1b")
      .attr("font-size", 23)
      .attr("font-weight", 950)
      .text("=");

    const bubbleR = Math.sqrt(d.exposureMillions / maxExposure) * 22 + 8;
    card.append("circle")
      .attr("cx", cfg.w - 54)
      .attr("cy", 56)
      .attr("r", 0)
      .attr("fill", cfg.kind === "selected" ? "rgba(245,200,75,0.26)" : "rgba(209,143,47,0.18)")
      .attr("stroke", cfg.kind === "selected" ? "#f5c84b" : "rgba(143,47,27,0.58)")
      .attr("stroke-width", 2)
      .transition()
      .delay(500)
      .duration(520)
      .attr("r", bubbleR);

    return card;
  }

  if (selectedIsTop) {
    drawFocusCard(g, selectedRow, {
      kind: "selected",
      eyebrow: "YOUR SELECTED STATE · HIGHEST EXPOSURE",
      x: 50,
      y: 132,
      w: 548,
      h: 216,
      compact: false,
    });

    const topMessage = g.append("g")
      .attr("class", "exposure-selected-top-message")
      .attr("transform", "translate(50,370)");

    topMessage.append("rect")
      .attr("width", 548)
      .attr("height", 92)
      .attr("rx", 22)
      .attr("fill", "rgba(255,247,235,0.96)")
      .attr("stroke", "rgba(245,200,75,0.72)")
      .attr("stroke-width", 1.8);

    topMessage.append("text")
      .attr("x", 24)
      .attr("y", 31)
      .attr("fill", "#8f2f1b")
      .attr("font-size", 12)
      .attr("font-weight", 950)
      .attr("letter-spacing", "0.12em")
      .text("NO SEPARATE BENCHMARK NEEDED");

    topMessage.append("foreignObject")
      .attr("x", 24)
      .attr("y", 46)
      .attr("width", 500)
      .attr("height", 42)
      .append("xhtml:div")
      .attr("style", "font-size:15px;line-height:1.3;color:#17202a;font-weight:850;")
      .text(`${selectedRow.state} is already the highest-exposure state in the 2100 high-emissions scenario.`);
  } else {
    drawFocusCard(g, selectedRow, {
      kind: "selected",
      eyebrow: selectedStateName ? "YOUR SELECTED STATE" : "SELECTED STATE",
      x: 50,
      y: 118,
      w: 548,
      h: 176,
      compact: true,
    });

    drawFocusCard(g, benchmarkRow, {
      kind: "benchmark",
      eyebrow: "HIGHEST EXPOSURE STATE",
      x: 50,
      y: 318,
      w: 548,
      h: 176,
      compact: true,
    });
  }

  const side = g.append("g")
    .attr("class", "exposure-selected-rank-panel")
    .attr("transform", "translate(642,122)");

  side.append("rect")
    .attr("width", 270)
    .attr("height", 370)
    .attr("rx", 24)
    .attr("fill", "rgba(255,255,255,0.94)")
    .attr("stroke", "rgba(23,32,42,0.12)");

  side.append("text")
    .attr("x", 18)
    .attr("y", 30)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 10)
    .attr("font-weight", 950)
    .attr("letter-spacing", "0.13em")
    .text("RANK CONTEXT");

  side.append("text")
    .attr("x", 18)
    .attr("y", 62)
    .attr("fill", "#17202a")
    .attr("font-size", 25)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.05em")
    .text(`#${selectedRank}`);

  side.append("text")
    .attr("x", 80)
    .attr("y", 62)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 800)
    .text(`of ${ranked.length} states`);

  const rankText = selectedIsTop
    ? `${selectedRow.state} is already the benchmark.`
    : `${selectedRow.state} is compared with ${topRow.state}.`;

  side.append("foreignObject")
    .attr("x", 18)
    .attr("y", 82)
    .attr("width", 226)
    .attr("height", 64)
    .append("xhtml:div")
    .attr("style", "font-size:12px;line-height:1.4;color:#5f6b73;font-weight:750;")
    .text(rankText);

  const topForPanel = ranked.slice(0, 4);
  if (!topForPanel.some((d) => d.state === selectedRow.state)) topForPanel.push(selectedRow);

  const panelMax = d3.max(topForPanel, (d) => d.exposureMillions) || 1;
  const panelScale = d3.scaleLinear().domain([0, panelMax]).range([5, 136]);

  const list = side.selectAll("g.rank-mini-row")
    .data(topForPanel, (d) => d.state)
    .join("g")
    .attr("class", (d) => `rank-mini-row${d.state === selectedRow.state ? " is-selected" : ""}`)
    .attr("transform", (_, i) => `translate(18,${170 + i * 39})`)
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      selectedStateName = d.state;
      if (!statePicker.empty()) statePicker.property("value", d.state);
      updateSelectedStateFromCurrentView(false);
      renderExposureLayerCards();
    });

  list.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("fill", (d) => d.state === selectedRow.state ? "#8f2f1b" : "#17202a")
    .attr("font-size", 11)
    .attr("font-weight", 950)
    .text((d) => `${ranked.findIndex((r) => r.state === d.state) + 1}. ${d.state}`);

  list.append("rect")
    .attr("x", 0)
    .attr("y", 9)
    .attr("width", 144)
    .attr("height", 8)
    .attr("rx", 4)
    .attr("fill", "rgba(209,143,47,0.14)");

  list.append("rect")
    .attr("x", 0)
    .attr("y", 9)
    .attr("height", 8)
    .attr("rx", 4)
    .attr("fill", (d) => d.state === selectedRow.state ? "#f5c84b" : "#d18f2f")
    .attr("width", (d) => panelScale(d.exposureMillions));

  list.append("text")
    .attr("x", 160)
    .attr("y", 17)
    .attr("fill", "#5f6b73")
    .attr("font-size", 9)
    .attr("font-weight", 850)
    .text((d) => formatExposureMillions(d.exposureMillions));

  const note = g.append("g")
    .attr("class", "exposure-selected-note")
    .attr("transform", "translate(50,492)");

  note.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 810)
    .attr("height", 32)
    .attr("rx", 18)
    .attr("fill", "rgba(255,255,255,0.84)")
    .attr("stroke", "rgba(23,32,42,0.08)");

  note.append("text")
    .attr("x", 405)
    .attr("y", 21)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 800)
    .text(selectedIsTop
      ? "Selected state is already the benchmark. Exposure-days are a proxy, not health outcomes."
      : "Selected state is compared with the highest-exposure benchmark. Exposure-days are a proxy, not health outcomes.");

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Selected-state view: compare the selected state with the highest-exposure benchmark. If the selected state is already highest, it stands alone as the benchmark.");
}


function renderUSExposureComparison() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("us-exposure-comparison");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const comparison = getUSExposureComparisonRows("ssp585");
  const { total2020, total2100, hot2020, hot2100 } = comparison;
  if (!Number.isFinite(total2020) || !Number.isFinite(total2100)) {
    mapNote.text("No U.S. exposure comparison data available.");
    return;
  }

  const g = svg.append("g").attr("class", "us-exposure-block-viz");
  const maxValue = Math.max(total2020, total2100, 1);
  const diff = total2100 - total2020;
  const ratio = total2020 > 0 ? total2100 / total2020 : NaN;

  const blockUnitMillions = chooseExposureBlockUnit(maxValue);
  const blockUnitLabel = formatExposureMillions(blockUnitMillions);
  const cols = 11;
  const block = 11;
  const gap = 5;
  const panelW = 306;
  const panelH = 256;
  const leftX = 58;
  const rightX = 504;
  const panelY = 148;

  const values = [
    {
      key: "2020",
      stage: "STEP 1",
      label: "2020 baseline",
      value: total2020,
      hot: hot2020,
      color: "#97a0a8",
      accent: "#5f6b73",
      note: ["Observed 2020 hot days", "× 2020 population baseline"],
      x: leftX,
    },
    {
      key: "2100",
      stage: "STEP 2",
      label: "2100 projection",
      value: total2100,
      hot: hot2100,
      color: "#cf6e48",
      accent: "#8f2f1b",
      note: ["Projected 2100 hot days", "× projected 2100 population"],
      x: rightX,
    },
  ];

  g.append("text")
    .attr("x", 420)
    .attr("y", 34)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.14em")
    .text("U.S. EXPOSURE-DAYS BLOCK COMPARISON");

  g.append("text")
    .attr("x", 420)
    .attr("y", 68)
    .attr("text-anchor", "middle")
    .attr("fill", "#17202a")
    .attr("font-size", 26)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.05em")
    .text("Watch the increase from 2020 to 2100");

  const key = g.append("g").attr("transform", "translate(210,91)");
  key.append("rect")
    .attr("x", 0)
    .attr("y", -15)
    .attr("width", 420)
    .attr("height", 34)
    .attr("rx", 17)
    .attr("fill", "rgba(255,255,255,0.88)")
    .attr("stroke", "rgba(23,32,42,0.10)");
  key.append("rect")
    .attr("x", 18)
    .attr("y", -5)
    .attr("width", 14)
    .attr("height", 14)
    .attr("rx", 4)
    .attr("fill", "#cf6e48")
    .attr("opacity", 0.82);
  key.append("text")
    .attr("x", 42)
    .attr("y", 7)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 850)
    .text(`Each block = ${blockUnitLabel}`);

  const panels = g.selectAll("g.us-exposure-panel")
    .data(values)
    .join("g")
    .attr("class", "us-exposure-panel")
    .attr("transform", (d) => `translate(${d.x},${panelY})`);

  panels.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", panelW)
    .attr("height", panelH)
    .attr("rx", 24)
    .attr("fill", "rgba(255,255,255,0.84)")
    .attr("stroke", (d) => d.key === "2100" ? "rgba(196,81,44,0.26)" : "rgba(23,32,42,0.10)")
    .attr("stroke-width", 1.2);

  panels.append("text")
    .attr("x", 20)
    .attr("y", 28)
    .attr("fill", (d) => d.accent)
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text((d) => d.stage);

  panels.append("text")
    .attr("x", 20)
    .attr("y", 56)
    .attr("fill", "#17202a")
    .attr("font-size", 18)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.035em")
    .text((d) => d.label);

  panels.append("text")
    .attr("x", 20)
    .attr("y", 87)
    .attr("fill", "#17202a")
    .attr("font-size", 27)
    .attr("font-weight", 960)
    .attr("letter-spacing", "-0.055em")
    .text((d) => formatExposureMillions(d.value));

  panels.append("text")
    .attr("x", 20)
    .attr("y", 112)
    .attr("fill", (d) => d.accent)
    .attr("font-size", 12)
    .attr("font-weight", 850)
    .text((d) => `${d3.format(".1f")(d.hot)} hot days`);

  panels.each(function(d) {
    const panel = d3.select(this);
    const note = panel.append("text")
      .attr("x", 20)
      .attr("y", 125)
      .attr("fill", "#5f6b73")
      .attr("font-size", 10.5)
      .attr("font-weight", 800);
    note.selectAll("tspan")
      .data(d.note)
      .join("tspan")
      .attr("x", 20)
      .attr("dy", (_, i) => i === 0 ? 0 : 12)
      .text((line) => line);
  });

  panels.each(function(d) {
    const panel = d3.select(this);
    const blockData = getExposureBlockData(d.value, blockUnitMillions);
    const blockG = panel.append("g")
      .attr("class", `exposure-block-grid exposure-block-grid-${d.key}`)
      .attr("transform", "translate(20,144)");

    const blockCells = blockG.selectAll("rect.exposure-block")
      .data(blockData)
      .join("rect")
      .attr("class", "exposure-block")
      .attr("x", (_, i) => (i % cols) * (block + gap))
      .attr("y", (_, i) => Math.floor(i / cols) * (block + gap))
      .attr("width", block)
      .attr("height", block)
      .attr("rx", 4)
      .attr("fill", d.color)
      .attr("stroke", "rgba(23,32,42,0.10)")
      .attr("stroke-width", 0.6)
      .attr("opacity", 0);

    const perBlockDelay = d.key === "2020" ? 180 : 72;
    const startDelay = d.key === "2020" ? 300 : 1600;
    blockCells.transition()
      .delay((b, i) => startDelay + i * perBlockDelay)
      .duration(260)
      .attr("opacity", (b) => b.fraction >= 0.98 ? 0.92 : Math.max(0.28, 0.22 + b.fraction * 0.62));
  });

  const midGroup = g.append("g")
    .attr("class", "us-exposure-mid-group")
    .attr("transform", "translate(435,286)")
    .attr("opacity", 0);

  midGroup.append("text")
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 13)
    .attr("font-weight", 950)
    .attr("letter-spacing", "0.08em")
    .text("BY 2100");

  midGroup.append("path")
    .attr("d", "M-34,20 L34,20 M22,10 L34,20 L22,30")
    .attr("fill", "none")
    .attr("stroke", "rgba(196,81,44,0.70)")
    .attr("stroke-width", 2.2)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round");

  midGroup.transition()
    .delay(1100)
    .duration(450)
    .attr("opacity", 1);

  const callout = g.append("g").attr("transform", "translate(110,440)");
  callout.append("rect")
    .attr("width", 720)
     .attr("height", 72)
    .attr("rx", 24)
    .attr("fill", "rgba(255,243,223,0.94)")
    .attr("stroke", "rgba(196,81,44,0.20)");
  callout.append("text")
    .attr("x", 24)
    .attr("y", 31)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 13)
    .attr("font-weight", 950)
    .attr("letter-spacing", "0.08em")
    .text("CHANGE IN TOTAL EXPOSURE");
  callout.append("text")
    .attr("x", 24)
    .attr("y", 62)
    .attr("fill", "#17202a")
    .attr("font-size", 22)
    .attr("font-weight", 960)
    .attr("letter-spacing", "-0.04em")
    .text(`${diff >= 0 ? "+" : ""}${formatExposureMillions(diff)}${Number.isFinite(ratio) ? ` · about ${d3.format(".1f")(ratio)}× 2020` : ""}`);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text(`Each block represents ${blockUnitLabel}. First, the 2020 baseline appears on the left. Then, the 2100 high-emissions projection builds on the right so the growth is easier to feel.`);
}


function chooseExposureBlockUnit(maxMillions) {
  if (maxMillions <= 20000) return 500;
  if (maxMillions <= 120000) return 1000;
  if (maxMillions <= 220000) return 2500;
  return 5000;
}

function chooseExposureBlockUnit(maxMillions) {
  if (maxMillions <= 20000) return 500;      // 0.5B exposure-days
  if (maxMillions <= 120000) return 1000;    // 1B exposure-days
  if (maxMillions <= 220000) return 2500;    // 2.5B exposure-days
  return 5000;                               // 5B exposure-days
}

function getExposureBlockData(valueMillions, unitMillions) {
  const safeValue = Math.max(0, Number(valueMillions) || 0);
  const full = Math.floor(safeValue / unitMillions);
  const remainder = (safeValue / unitMillions) - full;
  const count = Math.max(1, full + (remainder > 0.02 ? 1 : 0));
  return d3.range(count).map((i) => {
    if (i < full) return { fraction: 1 };
    return { fraction: Math.max(0.08, remainder) };
  });
}

function renderHazardLayerMap() {
  hideTrendSummary();
  setVizMode("hazard-layer-map");
  svg.selectAll("*").remove();
  legendContainer.html("");
  currentState.year = END_YEAR;
  currentState.scenario = "ssp585";
  currentState.metric = "summer_hot_days_35c_change_from_observed_2020";
  drawMapYearLabel();

  const rows = getExposureRows("ssp585", END_YEAR);
  const byState = new Map(rows.map((d) => [normalizeStateName(d.state), d]));
  const top = rows.slice().sort((a, b) => d3.descending(a.hazard, b.hazard)).slice(0, 5);
  const topSet = new Set(top.map((d) => d.state));
  const maxHazard = d3.max(rows, (d) => d.hazard) || 1;
  const color = d3.scaleSequential().domain([0, maxHazard]).interpolator(interpolateHotDaysWhiteToRed);

  const g = svg.append("g").attr("class", "hazard-layer-viz");

  g.append("text")
    .attr("x", 34)
    .attr("y", 42)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.14em")
    .text("LAYER 1: HEAT HAZARD");

  g.append("text")
    .attr("x", 34)
    .attr("y", 70)
    .attr("fill", "#17202a")
    .attr("font-size", 23)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.04em")
    .text("Where do additional 35°C+ summer days appear?");

  const mapG = g.append("g")
    .attr("transform", "translate(-24,42) scale(0.84)");

  mapG.selectAll("path.hazard-state")
    .data(statesGeo.features)
    .join("path")
    .attr("class", "hazard-state")
    .attr("d", path)
    .attr("fill", (feature) => {
      const row = byState.get(normalizeStateName(getFeatureStateName(feature)));
      return row ? color(row.hazard) : "#f1eee8";
    })
    .attr("stroke", (feature) => {
      const state = normalizeStateName(getFeatureStateName(feature));
      return topSet.has(state) ? "#17202a" : "white";
    })
    .attr("stroke-width", (feature) => {
      const state = normalizeStateName(getFeatureStateName(feature));
      return topSet.has(state) ? 2.2 : 0.8;
    })
    .attr("opacity", 0)
    .transition()
    .duration(650)
    .attr("opacity", 1);

  const panel = g.append("g").attr("transform", "translate(620,108)");
  panel.append("rect")
    .attr("width", 255)
    .attr("height", 302)
    .attr("rx", 24)
    .attr("fill", "rgba(255,255,255,0.90)")
    .attr("stroke", "rgba(23,32,42,0.12)");

  panel.append("text")
    .attr("x", 18)
    .attr("y", 34)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.12em")
    .text("TOP HAZARD STATES");

  const row = panel.selectAll("g.hazard-top-row")
    .data(top)
    .join("g")
    .attr("class", "hazard-top-row")
    .attr("transform", (_, i) => `translate(18,${62 + i * 42})`);

  row.append("text")
    .attr("x", 0)
    .attr("y", 15)
    .attr("fill", "#17202a")
    .attr("font-size", 12)
    .attr("font-weight", 850)
    .text((d, i) => `${i + 1}. ${d.state}`);

  row.append("rect")
    .attr("x", 124)
    .attr("y", 3)
    .attr("height", 15)
    .attr("rx", 8)
    .attr("fill", "#c4512c")
    .attr("opacity", 0.82)
    .attr("width", 0)
    .transition()
    .delay((_, i) => 250 + i * 80)
    .duration(550)
    .attr("width", (d) => Math.max(4, 88 * d.hazard / maxHazard));

  row.append("text")
    .attr("x", 216)
    .attr("y", 16)
    .attr("text-anchor", "end")
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 750)
    .text((d) => `${d3.format("+.1f")(d.hazard)}d`);

  panel.append("text")
    .attr("x", 18)
    .attr("y", 283)
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 650)
    .text("This is hazard only — not exposure yet.");

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Layer 1 uses baseline-aligned 5-year average extra very hot summer days under high emissions in 2100.");
}

function renderPopulationLayer() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("population-layer");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const rows = getExposureRows("ssp585", END_YEAR);
  if (!rows.length) {
    mapNote.text("No exposure rows available.");
    return;
  }
  const sets = getTopExposureSets(rows, 6);
  const topPop = sets.population;
  const topHazard = new Set(sets.hazard.map((d) => d.state));
  const maxPop = d3.max(rows, (d) => d.populationMillions) || 1;
  const radius = d3.scaleSqrt().domain([0, maxPop]).range([9, 54]);

  const g = svg.append("g").attr("class", "population-layer-viz");

  g.append("text")
    .attr("x", 34)
    .attr("y", 42)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.14em")
    .text("LAYER 2: EXPOSED POPULATION");

  g.append("text")
    .attr("x", 34)
    .attr("y", 72)
    .attr("fill", "#17202a")
    .attr("font-size", 22)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.04em")
    .text("The population layer changes the story.");

  g.append("text")
    .attr("x", 34)
    .attr("y", 98)
    .attr("fill", "#5f6b73")
    .attr("font-size", 13)
    .attr("font-weight", 650)
    .text("Large exposed populations can turn moderate hazard into a large exposure-days burden.");

  const centers = [
    [160, 250], [305, 190], [455, 260], [610, 198], [735, 300], [240, 365]
  ];

  const bubble = g.selectAll("g.population-bubble")
    .data(topPop)
    .join("g")
    .attr("class", "population-bubble")
    .attr("transform", (_, i) => `translate(${centers[i][0]},${centers[i][1]})`)
    .style("opacity", 0);

  bubble.append("circle")
    .attr("r", 0)
    .attr("fill", (d) => topHazard.has(d.state) ? "rgba(196,81,44,0.26)" : "rgba(79,143,192,0.20)")
    .attr("stroke", (d) => topHazard.has(d.state) ? "rgba(196,81,44,0.72)" : "rgba(79,143,192,0.62)")
    .attr("stroke-width", 2)
    .transition()
    .delay((_, i) => i * 120)
    .duration(650)
    .attr("r", (d) => radius(d.populationMillions));

  bubble.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -6)
    .attr("fill", "#17202a")
    .attr("font-size", 13)
    .attr("font-weight", 900)
    .text((d) => d.state);

  bubble.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 14)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 750)
    .text((d) => formatPopulationMillions(d.populationMillions));

  bubble.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 32)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 10)
    .attr("font-weight", 850)
    .text((d) => `${d3.format("+.1f")(d.hazard)} hot days`);

  bubble.transition()
    .delay((_, i) => i * 120)
    .duration(300)
    .style("opacity", 1);

  const key = g.append("g").attr("transform", "translate(665,88)");
  key.append("rect")
    .attr("width", 214)
    .attr("height", 74)
    .attr("rx", 18)
    .attr("fill", "rgba(255,255,255,0.88)")
    .attr("stroke", "rgba(23,32,42,0.12)");
  key.append("circle").attr("cx", 22).attr("cy", 25).attr("r", 8).attr("fill", "rgba(196,81,44,0.26)").attr("stroke", "rgba(196,81,44,0.72)");
  key.append("text").attr("x", 40).attr("y", 29).attr("fill", "#5f6b73").attr("font-size", 11).attr("font-weight", 750).text("Also high-hazard state");
  key.append("circle").attr("cx", 22).attr("cy", 52).attr("r", 8).attr("fill", "rgba(79,143,192,0.20)").attr("stroke", "rgba(79,143,192,0.62)");
  key.append("text").attr("x", 40).attr("y", 56).attr("fill", "#5f6b73").attr("font-size", 11).attr("font-weight", 750).text("Population layer state");

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Layer 2 shows projected population proxy values. Circle size is population; labels still show the hot-day hazard that will be multiplied in the next step.");
}

function renderExposureEquation() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("exposure-equation");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const rows = getExposureRows("ssp585", END_YEAR)
    .slice()
    .sort((a, b) => d3.descending(a.exposureMillions, b.exposureMillions));
  const sample = rows.slice(0, 4);
  if (!sample.length) {
    mapNote.text("No exposure data available.");
    return;
  }

  const g = svg.append("g").attr("class", "exposure-build-viz");
  const maxHazard = d3.max(sample, (d) => d.hazard) || 1;
  const maxPop = d3.max(sample, (d) => d.populationMillions) || 1;
  const maxExposure = d3.max(sample, (d) => d.exposureMillions) || 1;
  const hazardX = d3.scaleLinear().domain([0, maxHazard]).range([0, 128]);
  const popR = d3.scaleSqrt().domain([0, maxPop]).range([8, 28]);
  const exposureX = d3.scaleLinear().domain([0, maxExposure]).range([0, 150]);

  g.append("text")
    .attr("x", width / 2)
    .attr("y", 42)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.14em")
    .text("THEREFORE: BUILD EXPOSURE-DAYS");

  g.append("text")
    .attr("x", width / 2)
    .attr("y", 78)
    .attr("text-anchor", "middle")
    .attr("fill", "#17202a")
    .attr("font-size", 28)
    .attr("font-weight", 950)
    .attr("letter-spacing", "-0.045em")
    .text("Hot-day hazard × population = exposure-days");

  const headerY = 124;
  const cols = [220, 455, 690];
  const labels = ["added hot days", "projected people", "exposure-days proxy"];
  g.selectAll("text.exposure-build-header")
    .data(labels)
    .join("text")
    .attr("class", "exposure-build-header")
    .attr("x", (d, i) => cols[i])
    .attr("y", headerY)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.12em")
    .text((d) => d.toUpperCase());

  const rowG = g.selectAll("g.exposure-build-row")
    .data(sample)
    .join("g")
    .attr("class", "exposure-build-row")
    .attr("transform", (_, i) => `translate(0,${156 + i * 78})`)
    .style("opacity", 0);

  rowG.append("text")
    .attr("x", 48)
    .attr("y", 25)
    .attr("fill", "#17202a")
    .attr("font-size", 14)
    .attr("font-weight", 950)
    .text((d, i) => `${i + 1}. ${d.state}`);

  rowG.append("rect")
    .attr("x", cols[0] - 72)
    .attr("y", 10)
    .attr("height", 22)
    .attr("rx", 11)
    .attr("fill", "rgba(196,81,44,0.16)")
    .attr("stroke", "rgba(196,81,44,0.35)")
    .attr("width", 144);

  rowG.append("rect")
    .attr("x", cols[0] - 64)
    .attr("y", 15)
    .attr("height", 12)
    .attr("rx", 6)
    .attr("fill", "#c4512c")
    .attr("width", 0)
    .transition()
    .delay((_, i) => 180 + i * 90)
    .duration(600)
    .attr("width", (d) => Math.max(5, hazardX(d.hazard)));

  rowG.append("text")
    .attr("x", cols[0])
    .attr("y", 52)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .text((d) => `${d3.format("+.1f")(d.hazard)} days`);

  rowG.append("text")
    .attr("x", (cols[0] + cols[1]) / 2)
    .attr("y", 31)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 24)
    .attr("font-weight", 950)
    .text("×");

  rowG.append("circle")
    .attr("cx", cols[1])
    .attr("cy", 23)
    .attr("r", 0)
    .attr("fill", "rgba(79,143,192,0.20)")
    .attr("stroke", "rgba(79,143,192,0.66)")
    .attr("stroke-width", 2)
    .transition()
    .delay((_, i) => 360 + i * 90)
    .duration(600)
    .attr("r", (d) => popR(d.populationMillions));

  rowG.append("text")
    .attr("x", cols[1])
    .attr("y", 52)
    .attr("text-anchor", "middle")
    .attr("fill", "#4f7290")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .text((d) => formatPopulationMillions(d.populationMillions));

  rowG.append("text")
    .attr("x", (cols[1] + cols[2]) / 2)
    .attr("y", 31)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 24)
    .attr("font-weight", 950)
    .text("=");

  rowG.append("rect")
    .attr("x", cols[2] - 78)
    .attr("y", 10)
    .attr("height", 24)
    .attr("rx", 12)
    .attr("fill", "rgba(209,143,47,0.18)")
    .attr("stroke", "rgba(143,47,27,0.24)")
    .attr("width", 156);

  rowG.append("rect")
    .attr("x", cols[2] - 70)
    .attr("y", 16)
    .attr("height", 12)
    .attr("rx", 6)
    .attr("fill", "#d18f2f")
    .attr("width", 0)
    .transition()
    .delay((_, i) => 560 + i * 90)
    .duration(620)
    .attr("width", (d) => Math.max(5, exposureX(d.exposureMillions)));

  rowG.append("text")
    .attr("x", cols[2])
    .attr("y", 52)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .text((d) => formatExposureMillions(d.exposureMillions));

  rowG.transition()
    .delay((_, i) => i * 90)
    .duration(360)
    .style("opacity", 1);

  g.append("text")
    .attr("x", width / 2)
    .attr("y", height - 30)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .attr("font-weight", 750)
    .text("The product is still a proxy: it estimates exposure-days of exposure, not health outcomes.");

  const note = rows.some((d) => d.source === "impact file")
    ? "Using state_impact_context_2100.csv when available."
    : "Using embedded population fallback because state_impact_context_2100.csv was not found.";

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text(`${note} Exposure-days are a proxy, not a direct health-outcome prediction.`);
}

function renderExposureBubbles() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("exposure-bubbles");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const rows = getExposureRows("ssp585", END_YEAR);
  if (!rows.length) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#5f6b73")
      .attr("font-size", 16)
      .text("Exposure rows are unavailable. Add state_impact_context_2100.csv or keep the population fallback in main.js.");
    return;
  }

  const margin = { top: 54, right: 66, bottom: 64, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(rows, (d) => d.hazard) || 1])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, (d) => d.populationMillions) || 1])
    .nice()
    .range([innerHeight, 0]);

  const r = d3.scaleSqrt()
    .domain([0, d3.max(rows, (d) => d.exposureMillions) || 1])
    .range([4, 34]);

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .selectAll("line")
    .attr("stroke", "rgba(23,32,42,0.08)");
  g.select(".grid .domain").remove();

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d}`));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}M`));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 46)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Added very hot summer days, baseline-aligned 5-year average");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Projected population layer, millions");

  const maxExposure = d3.max(rows, (d) => d.exposureMillions) || 1;
  const color = d3.scaleSequential()
    .domain([0, maxExposure])
    .interpolator(d3.interpolateOrRd);

  const bubbles = g.selectAll("circle.exposure-bubble")
    .data(rows, (d) => d.state)
    .join("circle")
    .attr("class", "exposure-bubble")
    .attr("cx", (d) => x(d.hazard))
    .attr("cy", (d) => y(d.populationMillions))
    .attr("r", 0)
    .attr("fill", (d) => color(d.exposureMillions))
    .attr("fill-opacity", 0.72)
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .on("mousemove", (event, d) => {
      tooltip
        .html(`<h3>${d.state}</h3><p>Added hot days: <strong>${d3.format("+.1f")(d.hazard)}</strong></p><p>Population layer: <strong>${d3.format(".1f")(d.populationMillions)}M</strong></p><p>Exposure-days: <strong>${formatExposureMillions(d.exposureMillions)}</strong></p>`)
        .style("left", `${event.clientX + 14}px`)
        .style("top", `${event.clientY + 14}px`)
        .attr("hidden", null);
    })
    .on("mouseleave", hideTooltip);

  bubbles.transition()
    .delay((_, i) => Math.min(i * 18, 650))
    .duration(620)
    .ease(d3.easeCubicOut)
    .attr("r", (d) => r(d.exposureMillions));

  const labeled = new Map();
  [
    rows.slice().sort((a, b) => d3.descending(a.hazard, b.hazard))[0],
    rows.slice().sort((a, b) => d3.descending(a.populationMillions, b.populationMillions))[0],
    rows.slice().sort((a, b) => d3.descending(a.exposureMillions, b.exposureMillions))[0]
  ].filter(Boolean).forEach((d) => labeled.set(d.state, d));

  g.selectAll("text.exposure-bubble-label")
    .data(Array.from(labeled.values()), (d) => d.state)
    .join("text")
    .attr("class", "exposure-bubble-label")
    .attr("x", (d) => x(d.hazard) + r(d.exposureMillions) + 6)
    .attr("y", (d) => y(d.populationMillions) + 4)
    .attr("fill", "#17202a")
    .attr("font-size", 11)
    .attr("font-weight", 900)
    .text((d) => d.state);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Bubble size and color show exposure-days = added hot days × projected population. Hover for details.");
}

function renderExposureContrast() {
  hideTrendSummary();
  hideMapYearOverlay();
  setVizMode("exposure-contrast");
  svg.selectAll("*").remove();
  legendContainer.html("");

  const rows = getExposureRows("ssp585", END_YEAR);
  if (!rows.length) {
    mapNote.text("No exposure data available.");
    return;
  }

  const topHazard = rows.slice().sort((a, b) => d3.descending(a.hazard, b.hazard)).slice(0, 8);
  const topExposure = rows.slice().sort((a, b) => d3.descending(a.exposureMillions, b.exposureMillions)).slice(0, 8);
  const exposureRank = new Map(rows.slice().sort((a, b) => d3.descending(a.exposureMillions, b.exposureMillions)).map((d, i) => [d.state, i + 1]));
  const hazardRank = new Map(rows.slice().sort((a, b) => d3.descending(a.hazard, b.hazard)).map((d, i) => [d.state, i + 1]));

  const margin = { top: 62, right: 36, bottom: 34, left: 42 };
  const panelW = 360;
  const panelGap = 116;
  const leftX = margin.left;
  const rightX = leftX + panelW + panelGap;
  const rowH = 42;
  const topY = 106;

  const g = svg.append("g").attr("class", "exposure-contrast-viz");

  g.append("text")
    .attr("x", leftX)
    .attr("y", 44)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.12em")
    .text("HAZARD RANKING");

  g.append("text")
    .attr("x", rightX)
    .attr("y", 44)
    .attr("fill", "#8f2f1b")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.12em")
    .text("EXPOSURE-DAYS RANKING");

  g.append("text")
    .attr("x", leftX)
    .attr("y", 69)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Sorted by additional 35°C+ summer days");

  g.append("text")
    .attr("x", rightX)
    .attr("y", 69)
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Sorted by added hot days × projected population");

  const hazardX = d3.scaleLinear().domain([0, d3.max(topHazard, (d) => d.hazard) || 1]).range([0, 180]);
  const exposureX = d3.scaleLinear().domain([0, d3.max(topExposure, (d) => d.exposureMillions) || 1]).range([0, 180]);

  const leftRows = g.selectAll("g.hazard-rank-row")
    .data(topHazard, (d) => d.state)
    .join("g")
    .attr("class", "hazard-rank-row")
    .attr("transform", (_, i) => `translate(${leftX},${topY + i * rowH})`);

  leftRows.append("text")
    .attr("x", 0)
    .attr("y", 17)
    .attr("fill", "#17202a")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .text((d, i) => `${i + 1}. ${d.state}`);

  leftRows.append("rect")
    .attr("x", 146)
    .attr("y", 4)
    .attr("height", 18)
    .attr("rx", 9)
    .attr("width", 0)
    .attr("fill", "#c4512c")
    .attr("opacity", 0.78)
    .transition()
    .duration(700)
    .attr("width", (d) => hazardX(d.hazard));

  leftRows.append("text")
    .attr("x", 146 + 190)
    .attr("y", 18)
    .attr("text-anchor", "end")
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 750)
    .text((d) => `${d3.format("+.1f")(d.hazard)} days`);

  const rightRows = g.selectAll("g.exposure-rank-row")
    .data(topExposure, (d) => d.state)
    .join("g")
    .attr("class", "exposure-rank-row")
    .attr("transform", (_, i) => `translate(${rightX},${topY + i * rowH})`);

  rightRows.append("text")
    .attr("x", 0)
    .attr("y", 17)
    .attr("fill", "#17202a")
    .attr("font-size", 12)
    .attr("font-weight", 900)
    .text((d, i) => `${i + 1}. ${d.state}`);

  rightRows.append("rect")
    .attr("x", 146)
    .attr("y", 4)
    .attr("height", 18)
    .attr("rx", 9)
    .attr("width", 0)
    .attr("fill", "#d18f2f")
    .attr("opacity", 0.86)
    .transition()
    .duration(700)
    .attr("width", (d) => exposureX(d.exposureMillions));

  rightRows.append("text")
    .attr("x", 146 + 190)
    .attr("y", 18)
    .attr("text-anchor", "end")
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 750)
    .text((d) => d3.format(".0f")(d.exposureMillions) + "M");

  const sharedStates = topHazard.filter((d) => exposureRank.has(d.state));
  const yHazard = new Map(topHazard.map((d, i) => [d.state, topY + i * rowH + 13]));
  const yExposure = new Map(topExposure.map((d, i) => [d.state, topY + i * rowH + 13]));

  g.selectAll("path.rank-connector")
    .data(sharedStates.filter((d) => yExposure.has(d.state)), (d) => d.state)
    .join("path")
    .attr("class", "rank-connector")
    .attr("d", (d) => {
      const x1 = leftX + panelW + 6;
      const x2 = rightX - 10;
      const y1 = yHazard.get(d.state);
      const y2 = yExposure.get(d.state);
      const mid = (x1 + x2) / 2;
      return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
    })
    .attr("fill", "none")
    .attr("stroke", "rgba(23,32,42,0.18)")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4 4");

  const hazardTop = topHazard[0];
  const exposureTop = topExposure[0];
  const takeaway = hazardTop && exposureTop && hazardTop.state !== exposureTop.state
    ? `Top hazard state: ${hazardTop.state}. Top exposure-days state: ${exposureTop.state}.`
    : `The same state leads both rankings here, but the ranking still shows how exposure is constructed.`;

  g.append("text")
    .attr("x", width / 2)
    .attr("y", height - 28)
    .attr("text-anchor", "middle")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 13)
    .attr("font-weight", 900)
    .text(takeaway);

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Left: hazard only. Right: exposure-days after multiplying hazard by projected population. This is the visual extension into exposure.");
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

  title.text("Why do extra very hot summer days matter?");
  subtitle.text("Impact = common-knowledge context on the left, source-backed daily-life examples on the right.");

  svg.style("display", "none");

  const chartWrap = d3.select(".chart-wrap");
  chartWrap.selectAll(".impact-fill").remove();

  const contextImpacts = [
    {
      num: "01",
      label: "Population exposure",
      tag: "computed proxy",
      desc: "We estimate exposure-days by multiplying extra very hot summer days by projected state population. This is a pressure-style proxy, not a direct health outcome."
    },
    {
      num: "02",
      label: "Older adults",
      tag: "context proxy",
      desc: "Older adults can be more vulnerable during extreme heat, so the current 65+ share helps interpret who may be more exposed. It is context, not a 2100 age projection."
    },
    {
      num: "03",
      label: "Cooling demand",
      tag: "pressure proxy",
      desc: "More hot days can increase reliance on indoor cooling, especially where AC access or energy affordability is uneven. This signals pressure, not a direct electricity-bill forecast."
    },
    {
      num: "04",
      label: "Humidity + hot-dry",
      tag: "context only",
      desc: "Humidity can make the same air temperature feel more stressful, while hot-dry conditions matter for outdoor work and crops. These are interpretation cues, not direct projections of drought or crop yield."
    }
  ];

  const sourcedImpacts = [
    {
      num: "01",
      label: "Sleep",
      stat: "−14.08",
      unit: "mins / warm night",
      desc: "On nights above 30°C, sleep declines by about 14 minutes on average. More frequent hot nights can make it harder to fall asleep and stay asleep.",
      source: "One Earth · Minor et al. (2022)",
      url: "https://www.cell.com/one-earth/fulltext/S2590-3322(22)00209-3"
    },
    {
      num: "02",
      label: "Learning",
      stat: "−1%",
      unit: "/ +0.56°C",
      desc: "Without air conditioning, a 0.56°C hotter school year reduces learning by about 1%. Hot school days can also hit already under-resourced students harder.",
      source: "AEA · Park et al. (2020)",
      url: "https://www.aeaweb.org/articles?id=10.1257/pol.20180612"
    },
    {
      num: "03",
      label: "Cooling cost",
      stat: "+3%",
      unit: "/ household",
      desc: "EIA linked a 5% rise in cooling degree days to about a 3% increase in average U.S. summer household electricity use. More extreme heat can therefore push cooling costs upward.",
      source: "U.S. EIA (2024)",
      url: "https://www.eia.gov/todayinenergy/detail.php?id=62524"
    },
    {
      num: "04",
      label: "Health",
      stat: "+1.5M",
      unit: "ER visits by 2050",
      desc: "Hotter temperatures can increase emergency visits for injuries, poisonings, mental health issues, and other heat-sensitive conditions. That adds pressure to health systems as heat becomes more common.",
      source: "UCSD Today / Stanford / WHO",
      url: "https://today.ucsd.edu/story/weathering-change"
    }
  ];

  const container = chartWrap.append("div")
    .attr("class", "impact-fill impact-fill--color-columns")
    .style("opacity", 0);

  container.html(`
    <div class="impact-columns-viz impact-columns-viz--compact">
      <div class="impact-page-intro">
        <div class="impact-page-intro-left">
          <span class="impact-page-kicker">08 · Impact</span>
          <h3>Keep both kinds of impact together.</h3>
        </div>
        <p class="impact-page-intro-copy">The left column shows common-knowledge context and proxy layers. The right column shows daily-life examples that are backed by outside sources. Read them together to interpret why extra very hot days matter.</p>
      </div>

      <section class="impact-column impact-column--context">
        <div class="impact-column-head">
          <span>Common knowledge</span>
          <h3>Context / proxy layers</h3>
          <p>These help frame exposure, but they are not direct outcome predictions.</p>
        </div>
        <div class="impact-column-list">
          ${contextImpacts.map((d) => `
            <article class="impact-mini-card impact-mini-card--context">
              <div class="impact-mini-num">${d.num}</div>
              <div class="impact-mini-copy">
                <div class="impact-mini-top">
                  <strong>${d.label}</strong>
                  <em>${d.tag}</em>
                </div>
                <p>${d.desc}</p>
              </div>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="impact-column impact-column--source">
        <div class="impact-column-head">
          <span>With sources</span>
          <h3>Daily-life examples</h3>
          <p>These examples come from outside studies and reports.</p>
        </div>
        <div class="impact-column-list">
          ${sourcedImpacts.map((d) => `
            <a class="impact-mini-card impact-mini-card--source" href="${d.url}" target="_blank" rel="noopener noreferrer">
              <div class="impact-mini-num">${d.num}</div>
              <div class="impact-mini-copy">
                <div class="impact-mini-top">
                  <strong>${d.label}</strong>
                  <em>${d.stat} <small>${d.unit}</small></em>
                </div>
                <p>${d.desc}</p>
                <small class="impact-mini-source">${d.source}</small>
              </div>
            </a>
          `).join("")}
        </div>
      </section>

      <div class="impact-columns-note">
        <strong>Interpretation note</strong>
        <span>These layers help interpret exposure. They do not directly predict illness, deaths, electricity bills, drought severity, or crop yield for a specific state.</span>
      </div>
    </div>
  `);

  container.transition()
    .duration(500)
    .style("opacity", 1);
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
  const monthlyAnnualRows = getAnnualTemperatureRowsFromMonthly();
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


function getAnnualTemperatureRowsFromMonthly() {
  if (!annualRowsFromMonthlyCache) {
    annualRowsFromMonthlyCache = buildAnnualTemperatureRowsFromMonthly(allMonthlyData);
  }
  return annualRowsFromMonthlyCache;
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
    series: "Avg warming change",
  }));

  const hotRows = d3.rollups(
    stateData.filter((d) => d.scenario === scenario),
    (v) => d3.mean(v, (d) => getAlignedHotDaysValue(d)),
    (d) => d.year
  ).map(([year, value]) => ({
    year,
    rawValue: value,
    series: "Extra very hot days",
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

function scrollToStateDetailSection() {
  const detail = document.getElementById("state-detail");
  if (!detail) return;

  const targetTop = () => detail.getBoundingClientRect().top + window.scrollY;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: targetTop(), behavior: "smooth" });
    window.setTimeout(() => {
      window.scrollTo({ top: targetTop(), behavior: "smooth" });
    }, 180);
  });
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
    .map((d) => getDisplayMetricValue(d, metric))
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
          .on("mouseenter", function (event, feature) {
            const stateName = normalizeStateName(getFeatureStateName(feature));
            mapG.selectAll(".state").classed("hovered", false);
            if (selectedStateName !== stateName) {
              d3.select(this).classed("hovered", true);
            }
          })
          .on("mousemove", function (event, feature) {
            const stateName = getFeatureStateName(feature);
            const row = dataByState.get(normalizeStateName(stateName));
            showTooltip(event, stateName, row, metric);
          })
          .on("mouseleave", function () {
            d3.select(this).classed("hovered", false);
            hideTooltip();
          })
          .on("click", function (event, feature) {
            const stateName = getFeatureStateName(feature);
            const normalized = normalizeStateName(stateName);
            const row = dataByState.get(normalized);

            selectedStateName = normalized;

            if (!statePicker.empty()) {
              statePicker.property("value", selectedStateName);
            }

            updateSelectedStateCard(stateName, row);
            renderMap(220);

            if (currentStep === stepSettings.length - 1) {
              scrollToStateDetailSection();
            }
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
      const value = getDisplayMetricValue(row, metric);

      if (!Number.isFinite(value)) return "#e3e8ea";
      return color(value);
    })
    .attr("opacity", (feature) => {
      const setting = stepSettings[currentStep];

      if (setting?.highlight !== "top") return 1;

      const stateName = normalizeStateName(getFeatureStateName(feature));
      return topStates.has(stateName) || selectedStateName === stateName ? 1 : 0.48;
    });

  drawExploreExposureBubbles(mapG, dataByState, transitionDuration);
  drawLegend(color, metric);
  updateMapNote(filtered, metric);
  drawMapYearLabel();

  if (selectedStateName) {
    const selectedRow = dataByState.get(selectedStateName);
    updateSelectedStateCard(selectedStateName, selectedRow);
  }
}

function drawExploreExposureBubbles(mapG, dataByState, transitionDuration = 350) {
  const shouldShow = currentStep === stepSettings.length - 1 && showExposureBubbles;

  if (!shouldShow) {
    mapG.selectAll("g.explore-bubble-layer").remove();
    return;
  }

  const exposureRows = getExposureRows(currentState.scenario, currentState.year);
  const exposureByState = new Map(exposureRows.map((d) => [normalizeStateName(d.state), d]));
  const exposureScaleRows = d3.range(2000, 2101, 10).flatMap((year) => getExposureMapRows(currentState.scenario, year));
  const maxExposure = d3.max(exposureScaleRows, (d) => d.exposureMillions) || 1;
  const radius = d3.scaleSqrt().domain([0, maxExposure]).range([1.5, 24]);

  let bubbleLayer = mapG.select("g.explore-bubble-layer");
  if (bubbleLayer.empty()) {
    bubbleLayer = mapG.append("g").attr("class", "explore-bubble-layer");
  }

  const bubbleData = statesGeo.features
    .map((feature) => {
      const stateName = getFeatureStateName(feature);
      const exposure = exposureByState.get(normalizeStateName(stateName));
      const row = dataByState.get(normalizeStateName(stateName));
      const centroid = path.centroid(feature);
      return { feature, stateName, exposure, row, x: centroid[0], y: centroid[1] };
    })
    .filter((d) => d.exposure && Number.isFinite(d.x) && Number.isFinite(d.y));

  const bubbles = bubbleLayer.selectAll("circle.explore-exposure-bubble")
    .data(bubbleData, (d) => d.stateName)
    .join(
      (enter) => enter.append("circle")
        .attr("class", "explore-exposure-bubble")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", 0)
        .attr("fill", "rgba(79, 143, 192, 0.055)")
        .attr("stroke", "rgba(23, 32, 42, 0.46)")
        .attr("stroke-width", 0.85)
        .attr("pointer-events", "none"),
      (update) => update,
      (exit) => exit.transition().duration(180).attr("r", 0).remove()
    );

  bubbles
    .classed("selected", (d) => selectedStateName === normalizeStateName(d.stateName))
    .attr("stroke", (d) => selectedStateName === normalizeStateName(d.stateName) ? "#ffd43b" : "rgba(23, 32, 42, 0.46)")
    .attr("stroke-width", (d) => selectedStateName === normalizeStateName(d.stateName) ? 2.2 : 0.85)
    .transition()
    .duration(transitionDuration)
    .ease(d3.easeCubicOut)
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => radius(d.exposure.exposureMillions));
}

function showExposureBubbleTooltip(event, d) {
  if (tooltip.empty()) return;

  const left = Math.min(event.clientX + 16, window.innerWidth - 310);
  const top = Math.min(event.clientY + 16, window.innerHeight - 210);

  tooltip
    .attr("hidden", null)
    .style("left", `${left}px`)
    .style("top", `${top}px`)
    .html(`
      <h3>${d.stateName}</h3>
      <p><strong>Exposure bubble</strong>, ${scenarioLabels[currentState.scenario]} ${currentState.year}</p>
      <p>Added hot days: <strong>${d3.format("+.1f")(d.exposure.hazard)}</strong></p>
      <p>Population layer: <strong>${d3.format(".1f")(d.exposure.populationMillions)}M</strong></p>
      <p>Exposure-days proxy: <strong>${formatExposureMillions(d.exposure.exposureMillions)}</strong></p>
      <p class="tooltip-muted">Hover previews details. Click selects this state with a solid yellow outline.</p>
    `);
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
  const chartHeight = 228;
  const margin = { top: 20, right: 20, bottom: 36, left: 44 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  monthlySvg.attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  monthlySvg.selectAll("*").remove();

  if (!stateName) {
    monthlySvg.append("text")
      .attr("class", "monthly-empty-text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight / 2)
      .text("Choose a state to see monthly very hot day changes.");
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
        .tickFormat((d) => d3.format(".1f")(d))
    );

  g.append("text")
    .attr("x", 0)
    .attr("y", -8)
    .attr("fill", "#5f6b73")
    .attr("font-size", 11)
    .attr("font-weight", 800)
    .text(`${stateName}: monthly 5-year avg. very hot day change in ${currentState.year}`);

  g.append("text")
    .attr("x", innerWidth)
    .attr("y", -8)
    .attr("text-anchor", "end")
    .attr("fill", "#8f2f1b")
    .attr("font-size", 11)
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
    .text((d) => d3.format(".1f")(d.hotDays));
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
      .interpolator(interpolateHotDaysWhiteToRed)
      .clamp(true);
  }


  const maxValue = d3.max(values) || 1;

  return d3.scaleSequential()
    .domain([0, maxValue])
    .interpolator(interpolateHotDaysWhiteToRed)
    .clamp(true);
}

function drawLegend(color, metric) {
  const isExplore = currentStep === stepSettings.length - 1;
  const isExploreWithBubbles = isExplore && showExposureBubbles;
  legendContainer.attr("class", isExplore ? "placeholder-legend explore-color-legend" : "placeholder-legend");
  const legendWidth = isExplore ? 320 : 280;
  const legendHeight = isExplore ? 50 : 48;

  legendContainer.html("");

  const legend = legendContainer
    .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("viewBox", `0 0 ${legendWidth} ${legendHeight}`);

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

  const colorLegendWidth = legendWidth - 16;

  legend.append("text")
    .attr("x", 8)
    .attr("y", isExplore ? 11 : -100)
    .attr("fill", "#5f6b73")
    .attr("font-size", 9.5)
    .attr("font-weight", 900)
    .attr("letter-spacing", "0.08em")
    .text(isExplore ? "COLOR = SELECTED CLIMATE METRIC" : "");

  legend.append("rect")
    .attr("x", 8)
    .attr("y", isExplore ? 20 : 8)
    .attr("width", colorLegendWidth)
    .attr("height", 12)
    .attr("rx", 6)
    .attr("fill", `url(#${gradientId})`);

  const unit = metricUnits[metric];
  const labelY = isExplore ? 48 : 38;

  legend.append("text")
    .attr("x", 8)
    .attr("y", labelY)
    .attr("font-size", 11)
    .attr("fill", "#555")
    .text(formatValue(start, unit));

  legend.append("text")
    .attr("x", 8 + colorLegendWidth)
    .attr("y", labelY)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#555")
    .text(formatValue(end, unit));

  drawExploreBubbleLegendInMap(isExploreWithBubbles);
}

function drawExploreBubbleLegendInMap(shouldShow) {
  svg.selectAll("g.explore-bubble-legend-in-map").remove();

  if (!shouldShow) return;

  const exposureRows = getExposureRows(currentState.scenario, currentState.year)
    .filter((d) => Number.isFinite(d.exposureMillions) && d.exposureMillions > 0);
  const exposureScaleRows = d3.range(2000, 2101, 10).flatMap((year) => getExposureMapRows(currentState.scenario, year));
  const maxExposure = d3.max(exposureScaleRows, (d) => d.exposureMillions) || 1;
  const radius = d3.scaleSqrt().domain([0, maxExposure]).range([1.5, 24]);

  const bubbleLegend = svg.append("g")
    .attr("class", "explore-bubble-legend-in-map");

  drawBubbleSizeLegendCard(bubbleLegend, {
    x: 740,
    y: 392,
    width: 186,
    height: 90,
    maxValue: maxExposure,
    valueRatios: [1, 0.35],
    radiusScale: radius,
    titleColor: "#8f2f1b",
    fill: "rgba(196,81,44,0.16)",
    stroke: "rgba(143,47,27,0.56)",
    background: "rgba(255, 249, 244, 0.96)",
    border: "rgba(196, 81, 44, 0.16)",
    compactLabels: true
  });
}

function updateMapNote(filtered, metric) {
  const maxRow = filtered
    .filter((d) => Number.isFinite(getDisplayMetricValue(d, metric)))
    .sort((a, b) => d3.descending(getDisplayMetricValue(a, metric), getDisplayMetricValue(b, metric)))[0];

  if (!maxRow) {
    mapNote.text("Hover over a state to see details.");
    return;
  }

  const setting = stepSettings[currentStep];
  let baseNote = setting?.note || "Hover over a state to see details.";
  if (currentStep === stepSettings.length - 1) {
    baseNote = showExposureBubbles
      ? "Explore mode: color shows the selected climate metric; bubbles show exposure-days. Hover previews values; click selects a state with a solid yellow outline."
      : "Explore mode: hover previews values; click selects a state with a solid yellow outline for local detail. Turn on bubbles to overlay exposure-days.";
  }

  mapNote.text(
    `${baseNote} Highest value: ${maxRow.state}, ${formatValue(getDisplayMetricValue(maxRow, metric), metricUnits[metric])}.`
  );
}

function getTopStates(rows, metric, n) {
  const top = rows
    .filter((d) => Number.isFinite(getDisplayMetricValue(d, metric)))
    .sort((a, b) => d3.descending(getDisplayMetricValue(a, metric), getDisplayMetricValue(b, metric)))
    .slice(0, n)
    .map((d) => normalizeStateName(d.state));

  return new Set(top);
}

function getStateExposureTooltipRow(stateName) {
  const exposure = getExposureRows(currentState.scenario, currentState.year)
    .find((d) => normalizeStateName(d.state) === normalizeStateName(stateName));
  if (!exposure) return "";
  return `<p>Exposure-days proxy: <strong>${formatExposureMillions(exposure.exposureMillions)}</strong></p>`;
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
  const hotDaysChange = getAlignedHotDaysValue(row);
  let tooltipRows = "";

  if (metric === "summer_tas_c_change_from_observed_2020") {
    tooltipRows = `
      <p>Avg warming change: <strong>${formatValue(avgWarming, "°C")}</strong></p>
      <p>Extra very hot days: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
    `;
  } else if (metric === "summer_hot_days_35c_change_from_observed_2020") {
    tooltipRows = `
      <p>Extra very hot days: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
      <p>Avg warming change: <strong>${formatValue(avgWarming, "°C")}</strong></p>
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
      ${showExposureBubbles ? getStateExposureTooltipRow(stateName) : ""}
      <p class="tooltip-muted">Hover previews this state. Click selects it with a solid yellow outline.</p>
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
    "Use the dropdown above, or click a state in the main map, to translate warming and very hot summer days into a local daily-life summary."
  );
  selectedStateWarming.text("[ +X °C ]");
  selectedStateHotdays.text("[ +Y days ]");
  selectedStateWeeks.text("[ about Z extra weeks ]");

  if (!snapshotStateTitle.empty()) {
    snapshotStateTitle.text("No state selected yet");
    snapshotStateText.text(
      "Choose a state here, or click one in the main map, to connect the national story to a local daily-life summary."
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
  const hotDaysChange = getAlignedHotDaysValue(row);
  const weeks = Number.isFinite(hotDaysChange) ? hotDaysChange / 7 : NaN;

  selectedStateTitle.text(stateName);

  selectedStateSummary.text(
    `By ${currentState.year} under ${scenarioLabels[currentState.scenario].toLowerCase()}, ${stateName} is projected to gain ${formatValue(hotDaysChange, "days")} summer very hot days above the 2020 baseline.`
  );

  selectedStateWarming.text(formatValue(avgWarming, "°C"));
  selectedStateHotdays.text(formatValue(hotDaysChange, "days"));
  selectedStateWeeks.text(formatWeeks(weeks));

  if (!snapshotStateTitle.empty()) {
    snapshotStateTitle.text(stateName);
    snapshotStateText.text(
      `${stateName} connects the national pattern to a local question: how many additional very hot summer days appear after 2020 baseline alignment?`
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


function getRawHotDaysValue(d) {
  return Number.isFinite(d?.summer_hot_days_35c_change_from_observed_2020)
    ? d.summer_hot_days_35c_change_from_observed_2020
    : NaN;
}

function ensureHotDayRollingLookup() {
  if (hotDayRollingLookupCache) return hotDayRollingLookupCache;

  hotDayRollingLookupCache = new Map();

  const rows = stateData.filter((d) =>
    d.year >= START_YEAR && d.year <= END_YEAR &&
    scenarioOrder.includes(d.scenario) &&
    d.state &&
    Number.isFinite(getRawHotDaysValue(d))
  );

  const byStateScenario = d3.group(
    rows,
    (d) => normalizeStateName(d.state),
    (d) => d.scenario
  );

  byStateScenario.forEach((scenarioMap, stateName) => {
    scenarioMap.forEach((values, scenario) => {
      const yearly = Array.from(
        d3.rollup(
          values,
          (v) => ({
            year: v[0].year,
            value: d3.mean(v, (d) => getRawHotDaysValue(d)),
          }),
          (d) => d.year
        ).values()
      ).sort((a, b) => d3.ascending(a.year, b.year));

      const rolling = addCenteredRollingAverage(yearly, "value", 5);
      const baseline = rolling.find((d) => d.year === START_YEAR)?.value;
      if (!Number.isFinite(baseline)) return;

      rolling.forEach((d) => {
        hotDayRollingLookupCache.set(`${stateName}|${scenario}|${d.year}`, {
          value: d.value - baseline,
          rawRolling: d.value,
          baseline,
          rawValue: d.rawValue,
          rollingWindow: d.rollingWindow,
        });
      });
    });
  });

  return hotDayRollingLookupCache;
}

function getHotDayRollingInfo(d) {
  if (!d || !d.state || !scenarioOrder.includes(d.scenario)) return null;
  const lookup = ensureHotDayRollingLookup();
  return lookup.get(`${normalizeStateName(d.state)}|${d.scenario}|${d.year}`) || null;
}

function ensureHotDayAlignmentBaselines() {
  // Backward-compatible helper: the current story uses rolling 2020 baselines.
  if (hotDayAlignmentBaselineCache) return hotDayAlignmentBaselineCache;
  hotDayAlignmentBaselineCache = new Map();
  ensureHotDayRollingLookup().forEach((info, key) => {
    const [state, scenario, year] = key.split("|");
    if (+year === START_YEAR) {
      hotDayAlignmentBaselineCache.set(`${state}|${scenario}`, info.rawRolling);
    }
  });
  return hotDayAlignmentBaselineCache;
}

function getHotDayAlignmentBaseline(d) {
  const baselines = ensureHotDayAlignmentBaselines();
  return baselines.get(`${normalizeStateName(d.state)}|${d.scenario}`) ?? 0;
}

function getAlignedHotDaysValue(d) {
  const raw = getRawHotDaysValue(d);
  if (!Number.isFinite(raw)) return NaN;
  if (!scenarioOrder.includes(d.scenario)) return raw;

  const rollingInfo = getHotDayRollingInfo(d);
  if (rollingInfo && Number.isFinite(rollingInfo.value)) return rollingInfo.value;

  return raw - getHotDayAlignmentBaseline(d);
}

function getDisplayMetricValue(d, metric) {
  if (!d) return NaN;
  if (metric === "summer_hot_days_35c_change_from_observed_2020") {
    return getAlignedHotDaysValue(d);
  }
  return d[metric];
}

function getRawMonthlyHotDaysValue(d) {
  const possibleColumns = [
    "monthly_hot_days_35c_change_from_observed_2020",
    "monthly_hot_days_35c_change_from_cmip6_2020",
    "monthly_hot_days_35c",
    "summer_hot_days_35c_change_from_observed_2020",
    "summer_hot_days_35c",
  ];

  for (const col of possibleColumns) {
    if (Number.isFinite(d?.[col])) return d[col];
  }

  return NaN;
}

function ensureMonthlyHotDayRollingLookup() {
  if (monthlyHotDayRollingLookupCache) return monthlyHotDayRollingLookupCache;

  monthlyHotDayRollingLookupCache = new Map();

  const rows = monthlyData.filter((d) =>
    d.year >= START_YEAR && d.year <= END_YEAR &&
    scenarioOrder.includes(d.scenario) &&
    d.state &&
    Number.isFinite(getMonthNumber(d)) &&
    Number.isFinite(getRawMonthlyHotDaysValue(d))
  );

  const grouped = d3.group(
    rows,
    (d) => normalizeStateName(d.state),
    (d) => d.scenario,
    (d) => getMonthNumber(d)
  );

  grouped.forEach((scenarioMap, stateName) => {
    scenarioMap.forEach((monthMap, scenario) => {
      monthMap.forEach((values, month) => {
        const yearly = Array.from(
          d3.rollup(
            values,
            (v) => ({
              year: v[0].year,
              value: d3.mean(v, (d) => getRawMonthlyHotDaysValue(d)),
            }),
            (d) => d.year
          ).values()
        ).sort((a, b) => d3.ascending(a.year, b.year));

        const rolling = addCenteredRollingAverage(yearly, "value", 5);
        const baseline = rolling.find((d) => d.year === START_YEAR)?.value;
        if (!Number.isFinite(baseline)) return;

        rolling.forEach((d) => {
          monthlyHotDayRollingLookupCache.set(`${stateName}|${scenario}|${month}|${d.year}`, {
            value: d.value - baseline,
            rawRolling: d.value,
            baseline,
            rawValue: d.rawValue,
            rollingWindow: d.rollingWindow,
          });
        });
      });
    });
  });

  return monthlyHotDayRollingLookupCache;
}

function ensureMonthlyHotDayAlignmentBaselines() {
  if (monthlyHotDayAlignmentBaselineCache) return monthlyHotDayAlignmentBaselineCache;
  monthlyHotDayAlignmentBaselineCache = new Map();
  ensureMonthlyHotDayRollingLookup().forEach((info, key) => {
    const [state, scenario, month, year] = key.split("|");
    if (+year === START_YEAR) {
      monthlyHotDayAlignmentBaselineCache.set(`${state}|${scenario}|${month}`, info.rawRolling);
    }
  });
  return monthlyHotDayAlignmentBaselineCache;
}

function getAlignedMonthlyHotDaysValue(d) {
  const raw = getRawMonthlyHotDaysValue(d);
  if (!Number.isFinite(raw)) return NaN;
  if (!scenarioOrder.includes(d.scenario)) return raw;

  const lookup = ensureMonthlyHotDayRollingLookup();
  const key = `${normalizeStateName(d.state)}|${d.scenario}|${getMonthNumber(d)}|${d.year}`;
  const rollingInfo = lookup.get(key);
  if (rollingInfo && Number.isFinite(rollingInfo.value)) return rollingInfo.value;

  const baselines = ensureMonthlyHotDayAlignmentBaselines();
  const fallbackKey = `${normalizeStateName(d.state)}|${d.scenario}|${getMonthNumber(d)}`;
  return raw - (baselines.get(fallbackKey) ?? 0);
}

function getMonthlyHotDaysValue(d) {
  return getAlignedMonthlyHotDaysValue(d);
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