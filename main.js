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
    year: 2020,
    scenario: "ssp245",
    metric: "tas_change_from_2020_c",
    title: "2020 baseline",
    subtitle:
      "The map starts at the baseline year. Future values are compared with this starting point.",
  },
  {
    year: 2020,
    scenario: "ssp245",
    metric: "tas_change_from_2020_c",
    title: "2020 baseline: no change yet",
    subtitle:
      "Using a baseline helps us ask a simple question: how much does each place change from here?",
  },
  {
    year: 2070,
    scenario: "ssp245",
    metric: "tas_change_from_2020_c",
    title: "Average temperature change by 2070",
    subtitle:
      "By 2070, average warming becomes visible across many states under medium emissions.",
  },
  {
    year: 2070,
    scenario: "ssp585",
    metric: "tas_change_from_2020_c",
    title: "Higher emissions, stronger average warming",
    subtitle:
      "The same year can look different under different emissions futures.",
  },
  {
    year: 2070,
    scenario: "ssp245",
    metric: "hot_days_35c_change_from_2020",
    title: "Additional 35°C+ days by 2070",
    subtitle:
      "Averages smooth over extreme days. This map counts how many more days exceed 35°C compared with 2020.",
  },
  {
    year: 2070,
    scenario: "ssp245",
    metric: "hot_days_35c_change_from_2020",
    title: "Extreme heat does not rise evenly",
    subtitle:
      "Some states gain many more extreme hot days than others, even when average warming may look similar.",
  },
  {
    year: 2070,
    scenario: "ssp585",
    metric: "hot_days_35c_change_from_2020",
    title: "High emissions make the heat story sharper",
    subtitle:
      "Under higher emissions, the change is not only a warmer average. It can mean more days crossing a heat threshold.",
  },
  {
    year: 2070,
    scenario: "ssp585",
    metric: "hot_days_35c_change_from_2020",
    title: "Explore the map yourself",
    subtitle:
      "Use the controls to compare year, scenario, and metric. Hover over states to see details.",
  },
];

let statesGeo;
let stateData;

let currentStep = 0;

let currentState = {
  year: 2070,
  scenario: "ssp245",
  metric: "tas_change_from_2020_c",
};

const svg = d3.select("#map");
const title = d3.select("#chart-title");
const subtitle = d3.select("#chart-subtitle");
const stateCard = d3.select("#state-card");

const scenarioSelect = d3.select("#scenario-select");
const yearSlider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");
const metricSelect = d3.select("#metric-select");

const width = 900;
const height = 520;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const projection = d3.geoAlbersUsa()
  .translate([width / 2, height / 2])
  .scale(1120);

const path = d3.geoPath(projection);

const mapG = svg.append("g");

init();

async function init() {
  const [states, tasRows, heatRows] = await Promise.all([
    d3.json(files.states),
    d3.csv(files.stateTas, d3.autoType),
    d3.csv(files.stateHeat, d3.autoType),
  ]);

  statesGeo = states;
  stateData = mergeClimateRows(tasRows, heatRows);

  setupControls();
  setupScroll();
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
    updateMap();
  });

  yearSlider.on("input", (event) => {
    currentState.year = +event.target.value;
    yearLabel.text(currentState.year);
    updateManualTitle();
    updateMap();
  });

  metricSelect.on("change", (event) => {
    currentState.metric = event.target.value;
    updateManualTitle();
    updateMap();
  });
}

function setupScroll() {
  const scroller = scrollama();

  scroller
    .setup({
      step: ".step",
      offset: 0.6,
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
  currentStep = step;

  const setting = stepSettings[step];

  currentState.year = setting.year;
  currentState.scenario = setting.scenario;
  currentState.metric = setting.metric;

  title.text(setting.title);
  subtitle.text(setting.subtitle);

  d3.select("body").classed("explore-mode", step === 7);

  syncControls();
  updateMap();
}

function updateManualTitle() {
  if (currentStep !== 7) return;

  title.text(`${metricLabels[currentState.metric]} in ${currentState.year}`);
  subtitle.text(
    `${scenarioLabels[currentState.scenario]} scenario. Hover over a state to compare average warming and extreme heat.`
  );
}

function syncControls() {
  scenarioSelect.property("value", currentState.scenario);
  yearSlider.property("value", currentState.year);
  yearLabel.text(currentState.year);
  metricSelect.property("value", currentState.metric);
}

function updateMap() {
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

  mapG.selectAll("path")
    .data(statesGeo.features, getFeatureStateName)
    .join(
      (enter) => enter.append("path")
        .attr("class", "state")
        .attr("d", path)
        .attr("fill", "#eee")
        .on("mousemove", function (event, feature) {
          const stateName = getFeatureStateName(feature);
          const row = dataByState.get(normalizeStateName(stateName));
          showStateCard(stateName, row, metric);
        }),
      (update) => update,
      (exit) => exit.remove()
    )
    .transition()
    .duration(650)
    .attr("fill", (feature) => {
      const stateName = getFeatureStateName(feature);
      const row = dataByState.get(normalizeStateName(stateName));
      const value = row?.[metric];

      if (!Number.isFinite(value)) return "#eeeeee";
      return color(value);
    });

  drawLegend(color, metric);
}

function getColorScale(metric, values) {
  if (metric === "tas_change_from_2020_c") {
    const maxAbs = d3.max(values, (d) => Math.abs(d)) || 1;

    return d3.scaleDiverging()
      .domain([-maxAbs, 0, maxAbs])
      .interpolator((t) => d3.interpolateRdBu(1 - t))
      .clamp(true);
  }

  const maxValue = d3.max(values) || 1;

  return d3.scaleSequential()
    .domain([0, maxValue])
    .interpolator(d3.interpolateOrRd)
    .clamp(true);
}

function drawLegend(color, metric) {
  const legendWidth = 280;
  const legendHeight = 48;

  const legend = d3.select("#legend")
    .html("")
    .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight);

  const defs = legend.append("defs");
  const gradientId = "legend-gradient";

  const gradient = defs.append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const domain = color.domain();
  const start = domain[0];
  const end = domain[domain.length - 1];

  const stops = d3.range(0, 1.01, 0.1);

  gradient.selectAll("stop")
    .data(stops)
    .join("stop")
    .attr("offset", (d) => `${d * 100}%`)
    .attr("stop-color", (d) => {
      const value = start + d * (end - start);
      return color(value);
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

function showStateCard(stateName, row, metric) {
  if (!row) {
    stateCard.html(`
      <h3>${stateName}</h3>
      <p>No data available for this state.</p>
    `);
    return;
  }

  const metricValue = row[metric];
  const avgWarming = row.tas_change_from_2020_c;
  const hotDays = row.hot_days_35c;
  const hotDaysChange = row.hot_days_35c_change_from_2020;

  stateCard.html(`
    <h3>${stateName}</h3>
    <p><strong>${scenarioLabels[currentState.scenario]}</strong>, ${currentState.year}</p>
    <p>${metricShortLabels[metric]}: <strong>${formatValue(metricValue, metricUnits[metric])}</strong></p>
    <p>Average warming from 2020: <strong>${formatValue(avgWarming, "°C")}</strong></p>
    <p>Total 35°C+ days: <strong>${formatValue(hotDays, "days")}</strong></p>
    <p>Additional 35°C+ days from 2020: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
  `);
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