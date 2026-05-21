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
  hot_days_35c_change_from_2020: "Increase in 35°C+ days from 2020",
  hot_days_35c: "Total 35°C+ days",
};

const metricUnits = {
  tas_change_from_2020_c: "°C",
  hot_days_35c_change_from_2020: "days",
  hot_days_35c: "days",
};

const stateNameFix = {
  "District of Columbia": "District of Columbia",
};

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
const stateCard = d3.select("#state-card");

const scenarioSelect = d3.select("#scenario-select");
const yearSlider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");
const metricSelect = d3.select("#metric-select");

const width = 900;
const height = 560;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const projection = d3.geoAlbersUsa()
  .translate([width / 2, height / 2])
  .scale(1150);

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

  const merged = mergeClimateRows(tasRows, heatRows);
  stateData = merged;

  setupControls();
  setupScroll();
  updateStep(0);
}

function mergeClimateRows(tasRows, heatRows) {
  const key = (d) => `${d.state}|${d.year}|${d.scenario}`;

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
    updateMap();
  });

  yearSlider.on("input", (event) => {
    currentState.year = +event.target.value;
    yearLabel.text(currentState.year);
    updateMap();
  });

  metricSelect.on("change", (event) => {
    currentState.metric = event.target.value;
    updateMap();
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
  currentStep = step;

  if (step === 0) {
    currentState.year = 2020;
    currentState.scenario = "ssp245";
    currentState.metric = "tas_change_from_2020_c";
  }

  if (step === 1) {
    currentState.year = 2070;
    currentState.scenario = "ssp245";
    currentState.metric = "tas_change_from_2020_c";
  }

  if (step === 2) {
    currentState.year = 2070;
    currentState.scenario = "ssp245";
    currentState.metric = "hot_days_35c_change_from_2020";
  }

  if (step === 3) {
    currentState.year = 2070;
    currentState.scenario = "ssp585";
    currentState.metric = "hot_days_35c_change_from_2020";
  }

  if (step === 4) {
    // Keep current values and let user explore.
  }

  syncControls();
  updateMap();
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

  const dataByState = new Map(filtered.map((d) => [normalizeStateName(d.state), d]));

  const metric = currentState.metric;
  const values = filtered
    .map((d) => d[metric])
    .filter((v) => Number.isFinite(v));

  const color = getColorScale(metric, values);

  title.text(`${metricLabels[metric]} in ${currentState.year}`);

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

      if (!Number.isFinite(value)) return "#eee";
      return color(value);
    });

  drawLegend(color, metric, values);
}

function getColorScale(metric, values) {
  if (metric === "tas_change_from_2020_c") {
    const maxAbs = d3.max(values, (d) => Math.abs(d)) || 1;

    return d3.scaleDiverging()
      .domain([-maxAbs, 0, maxAbs])
      .interpolator(d3.interpolateRdBu)
      .clamp(true);
  }

  const maxValue = d3.max(values) || 1;

  return d3.scaleSequential()
    .domain([0, maxValue])
    .interpolator(d3.interpolateOrRd)
    .clamp(true);
}

function drawLegend(color, metric, values) {
  const legendWidth = 260;
  const legendHeight = 46;

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

  const stops = d3.range(0, 1.01, 0.1);

  let domain = color.domain();

  gradient.selectAll("stop")
    .data(stops)
    .join("stop")
    .attr("offset", (d) => `${d * 100}%`)
    .attr("stop-color", (d) => {
      const value = domain[0] + d * (domain[domain.length - 1] - domain[0]);
      return color(value);
    });

  legend.append("rect")
    .attr("x", 8)
    .attr("y", 8)
    .attr("width", legendWidth - 16)
    .attr("height", 12)
    .attr("rx", 6)
    .attr("fill", `url(#${gradientId})`);

  const min = domain[0];
  const max = domain[domain.length - 1];
  const unit = metricUnits[metric];

  legend.append("text")
    .attr("x", 8)
    .attr("y", 38)
    .attr("font-size", 11)
    .attr("fill", "#555")
    .text(formatValue(min, unit));

  legend.append("text")
    .attr("x", legendWidth - 8)
    .attr("y", 38)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#555")
    .text(formatValue(max, unit));
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
    <p>${metricLabels[metric]}: <strong>${formatValue(metricValue, metricUnits[metric])}</strong></p>
    <p>Average warming from 2020: <strong>${formatValue(avgWarming, "°C")}</strong></p>
    <p>35°C+ days: <strong>${formatValue(hotDays, "days")}</strong></p>
    <p>Change in 35°C+ days from 2020: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
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
  return stateNameFix[name] || name;
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