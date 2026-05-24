const DATA_PATH = "data/";

const files = {
  states: `${DATA_PATH}us_states.geojson`,
  stateTas: `${DATA_PATH}state_annual_tas_cmip6_2020_2070.csv`,
  stateHeat: `${DATA_PATH}state_annual_extreme_heat_cmip6_2020_2070.csv`,
};

const scenarioLabels = {
  ssp126: "Low emissions",
  ssp245: "Medium emissions",
  ssp585: "High emissions",
};

const scenarioOrder = ["ssp126", "ssp245", "ssp585"];

const metricLabels = {
  tas_change_from_2020_c: "Average temperature change from 2020",
  hot_days_35c_change_from_2020: "Additional 35°C+ days compared with 2020",
  hot_days_35c: "Total 35°C+ days",
};

const metricShortLabels = {
  tas_change_from_2020_c: "Average warming",
  hot_days_35c_change_from_2020: "Additional 35°C+ days",
  hot_days_35c: "Total 35°C+ days",
};

const metricUnits = {
  tas_change_from_2020_c: "°C",
  hot_days_35c_change_from_2020: "days",
  hot_days_35c: "days",
};

const stepSettings = [
  {
    view: "line",
    year: 2020,
    scenario: "ssp245",
    metric: "tas_change_from_2020_c",
    title: "Start with the average",
    subtitle:
      "Average temperature changes gradually over time, especially under higher emissions.",
    note:
      "This line chart summarizes the national average across states before we look at where warming happens.",
    highlight: null,
  },
  {
    view: "map",
    year: 2020,
    scenario: "ssp245",
    metric: "tas_change_from_2020_c",
    title: "Now place that trend on the map",
    subtitle:
      "We use 2020 as the baseline, then compare how average temperature changes across the United States.",
    note:
      "Baseline view: no change yet, because 2020 is the comparison year.",
    highlight: null,
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp245",
    metric: "tas_change_from_2020_c",
    title: "By 2070, the map gets warmer",
    subtitle:
      "Average warming becomes visible across many states, even before looking at individual hot days.",
    note:
      "Average warming is broad, but it is still an annual summary.",
    highlight: null,
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp585",
    metric: "tas_change_from_2020_c",
    title: "Emissions change the picture",
    subtitle:
      "Under higher emissions, the same future year shows stronger average warming across more of the country.",
    note:
      "Higher emissions make the average-warming pattern stronger.",
    highlight: null,
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp585",
    metric: "tas_change_from_2020_c",
    title: "A yearly average misses the hardest days",
    subtitle:
      "People experience heat as specific days: cancelled outdoor practice, longer AC use, or riskier outdoor work.",
    note:
      "The next view switches from average warming to days above an extreme heat threshold.",
    highlight: null,
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp245",
    metric: "hot_days_35c_change_from_2020",
    title: "Count extreme hot days instead",
    subtitle:
      "This map counts how many more days exceed 35°C compared with 2020.",
    note:
      "Daily hot-day counts make the risk easier to see and feel.",
    highlight: null,
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp245",
    metric: "hot_days_35c_change_from_2020",
    title: "The pattern becomes sharper",
    subtitle:
      "Some states gain many more extreme hot days than others, making the risk easier to compare.",
    note:
      "The darkest states have the largest increases in additional 35°C+ days.",
    highlight: "top",
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp585",
    metric: "hot_days_35c_change_from_2020",
    title: "More warming means more risky days",
    subtitle:
      "Under high emissions, the change is not only a warmer average. It is more days people have to live through.",
    note:
      "Higher emissions sharpen the daily-risk story.",
    highlight: "top",
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp585",
    metric: "hot_days_35c_change_from_2020",
    title: "Explore the difference yourself",
    subtitle:
      "Use the controls to compare average warming with extreme hot days.",
    note:
      "Explore mode: change the year, scenario, or metric.",
    highlight: null,
  },
];

let statesGeo;
let stateData = [];
let tasData = [];
let currentStep = 0;

let currentState = {
  year: 2020,
  scenario: "ssp245",
  metric: "tas_change_from_2020_c",
  view: "line",
};

let selectedStateName = null;

const svg = d3.select("#main-chart");
const title = d3.select("#chart-title");
const subtitle = d3.select("#chart-subtitle");
const stickyViz = d3.select(".sticky-viz");
const legendContainer = d3.select("#legend");
const mapNote = d3.select("#map-note");
const tooltip = d3.select("#tooltip");

const scenarioSelect = d3.select("#scenario-select");
const yearSlider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");
const metricSelect = d3.select("#metric-select");

const selectedStateTitle = d3.select("#selected-state-title");
const selectedStateSummary = d3.select("#selected-state-summary");
const selectedStateWarming = d3.select("#selected-state-warming");
const selectedStateHotdays = d3.select("#selected-state-hotdays");
const selectedStateWeeks = d3.select("#selected-state-weeks");

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

  const [states, tasRows, heatRows] = await Promise.all([
    d3.json(files.states),
    d3.csv(files.stateTas, d3.autoType),
    d3.csv(files.stateHeat, d3.autoType),
  ]);

  statesGeo = states;
  tasData = tasRows;
  stateData = mergeClimateRows(tasRows, heatRows);

  setupControls();
  setupScroll();
  setupInitialSelectedStateCard();
  updateStep(0);
}

function mergeClimateRows(tasRows, heatRows) {
  const key = (d) => `${normalizeStateName(d.state)}|${d.year}|${d.scenario}`;
  const tasMap = new Map(tasRows.map((d) => [key(d), d]));

  return heatRows.map((heat) => {
    const tas = tasMap.get(key(heat)) || {};

    return {
      ...heat,
      tas_c: tas.tas_c,
      tas_2020_c: tas.tas_2020_c,
      tas_change_from_2020_c: tas.tas_change_from_2020_c,
    };
  });
}

function setupControls() {
  scenarioSelect.on("change", (event) => {
    currentState.scenario = event.target.value;
    updateManualTitle();
    updateMainView();
  });

  yearSlider.on("input", (event) => {
    currentState.year = +event.target.value;
    yearLabel.text(currentState.year);
    updateManualTitle();
    updateMainView();
  });

  metricSelect.on("change", (event) => {
    currentState.metric = event.target.value;
    updateManualTitle();
    updateMainView();
  });
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

  d3.select("body").classed("explore-mode", step === 8);

  syncControls();
  pulseViz();
  updateMainView();
}

function updateMainView() {
  hideTooltip();

  if (currentState.view === "line") {
    renderLineChart();
  } else {
    renderMap();
  }
}

function updateManualTitle() {
  if (currentStep !== 8) return;

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

function renderLineChart() {
  svg.selectAll("*").remove();
  legendContainer.html("");

  const margin = { top: 34, right: 130, bottom: 54, left: 66 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const rows = getNationalAverageRows();

  if (!rows.length) {
    mapNote.text("No data available for the line chart.");
    return;
  }

  const x = d3.scaleLinear()
    .domain(d3.extent(rows, (d) => d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([
      Math.min(0, d3.min(rows, (d) => d.value) || 0),
      d3.max(rows, (d) => d.value) || 1,
    ])
    .nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(scenarioOrder)
    .range(["#4f8fc0", "#d18f2f", "#c4512c"]);

  const g = svg.append("g")
    .attr("class", "line-chart")
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
        .tickFormat(d3.format("d"))
        .ticks(6)
    );

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}°C`));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 42)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Year");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -46)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b73")
    .attr("font-size", 12)
    .text("Average temperature change from 2020");

  const line = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  const grouped = d3.group(rows, (d) => d.scenario);

  for (const scenario of scenarioOrder) {
    const scenarioRows = grouped.get(scenario) || [];

    if (!scenarioRows.length) continue;

    const pathLine = g.append("path")
      .datum(scenarioRows)
      .attr("fill", "none")
      .attr("stroke", color(scenario))
      .attr("stroke-width", scenario === "ssp585" ? 3 : 2.4)
      .attr("d", line);

    const totalLength = pathLine.node().getTotalLength();

    pathLine
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    const last = scenarioRows[scenarioRows.length - 1];

    g.append("text")
      .attr("x", x(last.year) + 10)
      .attr("y", y(last.value))
      .attr("fill", color(scenario))
      .attr("font-size", 12)
      .attr("font-weight", 800)
      .attr("dominant-baseline", "middle")
      .text(scenarioLabels[scenario]);
  }

  const focus = g.append("g")
    .attr("class", "line-focus")
    .style("display", "none");

  focus.append("line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#17202a")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4 4");

  focus.append("circle")
    .attr("r", 4)
    .attr("fill", "#17202a");

  g.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      const year = Math.round(x.invert(mx));
      const yearRows = rows.filter((d) => d.year === year);
      const highRow = yearRows.find((d) => d.scenario === "ssp585");

      if (!highRow) return;

      focus.style("display", null);
      focus.attr("transform", `translate(${x(year)},0)`);
      focus.select("circle")
        .attr("cy", y(highRow.value));

      showLineTooltip(event, year, yearRows);
    })
    .on("mouseleave", function () {
      focus.style("display", "none");
      hideTooltip();
    });

  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Lines show state-averaged U.S. warming by emissions scenario.");
}

function getNationalAverageRows() {
  const grouped = d3.rollups(
    tasData,
    (v) => d3.mean(v, (d) => d.tas_change_from_2020_c),
    (d) => d.scenario,
    (d) => d.year
  );

  const rows = [];

  for (const [scenario, yearValues] of grouped) {
    for (const [year, value] of yearValues) {
      rows.push({ scenario, year, value });
    }
  }

  return rows
    .filter((d) => scenarioOrder.includes(d.scenario) && Number.isFinite(d.value))
    .sort((a, b) => d3.ascending(a.year, b.year));
}

function showLineTooltip(event, year, rows) {
  if (tooltip.empty()) return;

  const left = Math.min(event.clientX + 16, window.innerWidth - 290);
  const top = Math.min(event.clientY + 16, window.innerHeight - 180);

  const rowsByScenario = new Map(rows.map((d) => [d.scenario, d]));

  const lines = scenarioOrder.map((scenario) => {
    const row = rowsByScenario.get(scenario);
    return `<p>${scenarioLabels[scenario]}: <strong>${formatValue(row?.value, "°C")}</strong></p>`;
  }).join("");

  tooltip
    .attr("hidden", null)
    .style("left", `${left}px`)
    .style("top", `${top}px`)
    .html(`
      <h3>${year}</h3>
      ${lines}
    `);
}

function renderMap() {
  svg.selectAll("*").remove();

  const mapG = svg.append("g");

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

  mapG.selectAll("path")
    .data(statesGeo.features, getFeatureStateName)
    .join("path")
    .attr("class", "state")
    .attr("d", path)
    .attr("fill", "#e3e8ea")
    .attr("opacity", 1)
    .classed("highlighted", (feature) => {
      const setting = stepSettings[currentStep];
      if (setting.highlight !== "top") return false;

      const stateName = normalizeStateName(getFeatureStateName(feature));
      return topStates.has(stateName);
    })
    .classed("selected", (feature) => {
      const stateName = normalizeStateName(getFeatureStateName(feature));
      return selectedStateName === stateName;
    })
    .on("mousemove", function (event, feature) {
      const stateName = getFeatureStateName(feature);
      const row = dataByState.get(normalizeStateName(stateName));

      showTooltip(event, stateName, row, metric);
    })
    .on("mouseleave", function () {
      hideTooltip();
    })
    .on("click", function (event, feature) {
      const stateName = getFeatureStateName(feature);
      const row = dataByState.get(normalizeStateName(stateName));

      selectedStateName = normalizeStateName(stateName);
      updateSelectedStateCard(stateName, row);
      renderMap();
    })
    .transition()
    .duration(750)
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
      if (setting.highlight !== "top") return 1;

      const stateName = normalizeStateName(getFeatureStateName(feature));
      return topStates.has(stateName) || selectedStateName === stateName ? 1 : 0.48;
    });

  drawLegend(color, metric);
  updateMapNote(filtered, metric);

  if (selectedStateName) {
    const selectedRow = dataByState.get(selectedStateName);
    updateSelectedStateCard(selectedStateName, selectedRow);
  }
}

function getColorScale(metric, values) {
  if (metric === "tas_change_from_2020_c") {
    return d3.scaleDiverging()
      .domain([-4, 0, 4])
      .interpolator((t) => d3.interpolateRdBu(1 - t))
      .clamp(true);
  }

  if (metric === "hot_days_35c_change_from_2020") {
    return d3.scaleSequential()
      .domain([0, 25])
      .interpolator(d3.interpolateYlOrRd)
      .clamp(true);
  }

  if (metric === "hot_days_35c") {
    return d3.scaleSequential()
      .domain([0, 90])
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

  const avgWarming = row.tas_change_from_2020_c;
  const hotDaysChange = row.hot_days_35c_change_from_2020;
  const metricValue = row[metric];

  tooltip
    .attr("hidden", null)
    .style("left", `${left}px`)
    .style("top", `${top}px`)
    .html(`
      <h3>${stateName}</h3>
      <p><strong>${scenarioLabels[currentState.scenario]}</strong>, ${currentState.year}</p>
      <p>${metricShortLabels[metric]}: <strong>${formatValue(metricValue, metricUnits[metric])}</strong></p>
      <p>Average warming: <strong>${formatValue(avgWarming, "°C")}</strong></p>
      <p>Additional 35°C+ days: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
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

  selectedStateTitle.text("Click a state on the map.");
  selectedStateSummary.text(
    "The card will translate average warming and extreme hot days into a daily-life statement."
  );
  selectedStateWarming.text("[ +X °C ]");
  selectedStateHotdays.text("[ +Y days ]");
  selectedStateWeeks.text("[ about Z extra weeks ]");
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
    return;
  }

  const avgWarming = row.tas_change_from_2020_c;
  const hotDaysChange = row.hot_days_35c_change_from_2020;
  const weeks = Number.isFinite(hotDaysChange) ? hotDaysChange / 7 : NaN;

  selectedStateTitle.text(stateName);

  selectedStateSummary.text(
    `By ${currentState.year} under ${scenarioLabels[currentState.scenario].toLowerCase()}, ${stateName} is projected to have ${formatValue(hotDaysChange, "days")} more 35°C+ days than in 2020.`
  );

  selectedStateWarming.text(formatValue(avgWarming, "°C"));
  selectedStateHotdays.text(formatValue(hotDaysChange, "days"));
  selectedStateWeeks.text(formatWeeks(weeks));
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