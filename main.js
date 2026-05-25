const DATA_PATH = "data/";

const files = {
  states: `${DATA_PATH}us_states.geojson`,
  stateTas: `${DATA_PATH}state_annual_tas_cmip6_2020_2070.csv`,
  stateHeat: `${DATA_PATH}state_annual_extreme_heat_cmip6_2020_2070.csv`,
  monthlyHeat: `${DATA_PATH}state_monthly_heat_life_combined_cmip6_2020_2070.csv`,
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
      "Average temperature changes gradually over time, especially under higher emissions."
  },
  {
    view: "map",
    year: 2020,
    scenario: "ssp585",
    metric: "tas_change_from_2020_c",
    title: "Now place that trend on the map",
    subtitle:
      "We use 2020 as the baseline, then compare how average temperature changes across the United States.",
    note:
      "Animated from 2020 to 2070 under high emissions. Values show change from the 2020 baseline.",
    animateYears: true,
    animationStartYear: 2020,
    animationEndYear: 2070,
    animationStepYears: 2,
    animationFrameDelay: 300,
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp585",
    metric: "tas_change_from_2020_c",
    title: "By 2070, the map gets warmer",
    subtitle:
      "Average warming becomes visible across many states under a high-emissions future.",
    note:
      "The map is warmer by 2070, but it is still showing an annual average.",
  },
  {
    view: "text-break",
    year: 2070,
    scenario: "ssp585",
    metric: "tas_change_from_2020_c",
    title: "Average temperature smooths the real situation",
    subtitle:
      "A yearly average blends comfortable days and extreme days into one number.",
    note:
      "This transition shifts the story from average warming to extreme hot days.",
  },
  {
    view: "compare-line",
    year: 2070,
    scenario: "ssp585",
    metric: "tas_change_from_2020_c",
    title: "Average warming vs. extreme hot days",
    subtitle:
      "The average temperature line rises gradually, but hot-day counts can grow in a way that is easier to feel.",
    note:
      "Both lines are normalized to compare their changes over time under high emissions.",
  },
  {
    view: "map",
    year: 2020,
    scenario: "ssp585",
    metric: "hot_days_35c_change_from_2020",
    title: "Count extreme hot days instead",
    subtitle:
      "This map counts how many more days exceed 35°C compared with 2020.",
    note:
      "Animated from 2020 to 2070 under high emissions. Values show additional 35°C+ days compared with 2020.",
    animateYears: true,
    animationStartYear: 2020,
    animationEndYear: 2070,
    animationStepYears: 2,
    animationFrameDelay: 300,
  },
  {
    view: "map",
    year: 2070,
    scenario: "ssp585",
    metric: "hot_days_35c_change_from_2020",
    title: "Extreme heat days do not increase evenly",
    subtitle:
      "By 2070, the largest increases appear in states that already sit near the 35°C threshold.",
    note:
      "The same average-warming future can create very different daily heat risks.",
    highlight: "top",
  },
  {
    view: "impact-placeholder",
    year: 2070,
    scenario: "ssp585",
    metric: "hot_days_35c_change_from_2020",
    title: "Impact layer placeholder",
    subtitle:
      "This section will connect extra hot days to daily-life impacts.",
    note:
      "daily-life examples",
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
  },
];

let statesGeo;
let stateData = [];
let tasData = [];
let monthlyData = [];
let currentStep = 0;

let currentState = {
  year: 2020,
  scenario: "ssp245",
  metric: "tas_change_from_2020_c",
  view: "line",
};

let selectedStateName = null;
let mapAnimationTimer = null;

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

  const [states, tasRows, heatRows, monthlyRows] = await Promise.all([
    d3.json(files.states),
    d3.csv(files.stateTas, d3.autoType),
    d3.csv(files.stateHeat, d3.autoType),
    d3.csv(files.monthlyHeat, d3.autoType),
  ]);

  statesGeo = states;
  tasData = tasRows;
  stateData = mergeClimateRows(tasRows, heatRows);
  monthlyData = monthlyRows;

  setupControls();
  setupStatePicker();
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
    .classed("explore-mode", step === 8)
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

  const noTooltipSteps = new Set([1, 5]);
  document.body.classList.toggle("no-tooltip", noTooltipSteps.has(currentStep));

  const viewsWithSummary = new Set(["line", "compare-line"]);
  if (!viewsWithSummary.has(currentState.view)) {
    hideTrendSummary();
  }

  if (currentState.view === "line") {
    renderLineChart();
  } else if (currentState.view === "text-break") {
    hideMapYearOverlay();
    legendContainer.html("");
    svg.selectAll("*").remove();
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
  for (const scenario of scenarioOrder) {
    const series = seriesByScenario[scenario];
    if (!series || !series.length) continue;
    const first = series[0].value;
    const last = series[series.length - 1].value;
    const delta = last - first;
    const sign = delta >= 0 ? "+" : "";
    const row = document.createElement("div");
    row.className = "trend-summary-row";
    row.innerHTML =
      `<span class="dot" style="background:${color(scenario)}"></span>` +
      `<span class="name">${scenarioLabels[scenario]}</span>` +
      `<span class="value" style="color:${color(scenario)}">${sign}${delta.toFixed(2)} °C</span>`;
    rowsEl.appendChild(row);
  }
  container.classList.add("is-active");
  // 用 rAF 触发过渡(先 display:flex 再加 is-visible 才有动画)
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

  const seriesConfig = [
    { name: "Average warming",        color: "#4f8fc0", unit: "°C",   decimals: 2 },
    { name: "Additional 35°C+ days",  color: "#c4512c", unit: "days", decimals: 1 },
  ];

  for (const cfg of seriesConfig) {
    const series = rowsBySeries.get(cfg.name);
    if (!series || !series.length) continue;

    // rawValue 本身就是"相对 2020 的变化",直接取 2070 那一年的值
    const point2070 = series.find((d) => d.year === 2070);
    const value = point2070?.rawValue ?? series[series.length - 1].rawValue;
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
/* ---------------------------------- */
/* ---------------------------------- */
/* ---------------------------------- */

  const line = d3.line()
      .x((d) => x(d.year))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    const grouped = d3.group(rows, (d) => d.scenario);

    // —— 收集每条线的数据,供 tooltip / summary 用 ——
    const seriesByScenario = {};
    let pathsAnimating = 0;

    for (const scenario of scenarioOrder) {
      const scenarioRows = grouped.get(scenario) || [];
      if (!scenarioRows.length) continue;

      seriesByScenario[scenario] = scenarioRows;

      const pathLine = g.append("path")
        .datum(scenarioRows)
        .attr("fill", "none")
        .attr("stroke", color(scenario))
        .attr("stroke-width", scenario === "ssp585" ? 3 : 2.4)
        .attr("d", line);

      const totalLength = pathLine.node().getTotalLength();
      pathsAnimating += 1;

      pathLine
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1400)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0)
        .on("end", () => {
          pathsAnimating -= 1;
          if (pathsAnimating === 0) {
            // 加 300ms 延迟,让用户先看清最终的线
            setTimeout(() => {
              showTrendSummary(seriesByScenario, color);
              enableHover();
            }, 300);
          }
        });

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

    // —— Hover 元素(初始隐藏)——
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

    // —— 透明 rect 接收鼠标事件 ——
    const hoverRect = g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("pointer-events", "none"); // 动画结束前不响应

    function enableHover() {
      hoverRect.style("pointer-events", "all");
      hoverRect
        .on("mousemove", function (event) {
          const [mx] = d3.pointer(event, this);
          const yearAtMouse = Math.round(x.invert(mx));
          const clamped = Math.max(2020, Math.min(2070, yearAtMouse));
          const xPos = x(clamped);

          hoverLine.attr("x1", xPos).attr("x2", xPos).style("opacity", 1);

          const lines = [`<h3>${clamped} vs 2020 baseline</h3>`];
          for (const scenario of scenarioOrder) {
            const series = seriesByScenario[scenario];
            if (!series) continue;
            const point = series.find((d) => d.year === clamped);
            if (!point) continue;
            const sign = point.value >= 0 ? "+" : "";
            const c = color(scenario);
            hoverDots[scenario]
              .attr("cx", xPos)
              .attr("cy", y(point.value))
              .style("opacity", 1);
            lines.push(
              `<p><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px;"></span>` +
              `${scenarioLabels[scenario]}: <strong>${sign}${point.value.toFixed(2)}°C</strong></p>`
            );
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
/* ---------------------------------- */
/* ---------------------------------- */
/* ---------------------------------- */
  legendContainer
    .append("div")
    .attr("class", "legend-caption")
    .text("Lines show averaged U.S. warming by emissions scenario.");
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
    .domain(["Average warming", "Additional 35°C+ days"])
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
    .text("Normalized change since 2020");

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

  // 彻底清掉 summary 残留(不靠 class 过渡,直接 DOM 操作)
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
    .text("The impact of high emissions down to 2070 on people's lives");
}
// step8impact

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

function getCompareRows() {
  const scenario = "ssp585";

  const avgRows = d3.rollups(
    tasData.filter((d) => d.scenario === scenario),
    (v) => d3.mean(v, (d) => d.tas_change_from_2020_c),
    (d) => d.year
  ).map(([year, value]) => ({
    year,
    rawValue: value,
    series: "Average warming",
  }));

  const hotRows = d3.rollups(
    stateData.filter((d) => d.scenario === scenario),
    (v) => d3.mean(v, (d) => d.hot_days_35c_change_from_2020),
    (d) => d.year
  ).map(([year, value]) => ({
    year,
    rawValue: value,
    series: "Additional 35°C+ days",
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
  const startYear = setting.animationStartYear ?? 2020;
  const endYear = setting.animationEndYear ?? 2070;
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
      .text("Choose a state to see monthly 35°C+ days.");
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
    .text(`${stateName}: monthly 35°C+ days in ${currentState.year}`);

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
  const totalHotDays = row.hot_days_35c;

  let tooltipRows = "";

  if (metric === "tas_change_from_2020_c") {
    tooltipRows = `
      <p>Average warming: <strong>${formatValue(avgWarming, "°C")}</strong></p>
      <p>Additional 35°C+ days: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
    `;
  } else if (metric === "hot_days_35c_change_from_2020") {
    tooltipRows = `
      <p>Additional 35°C+ days: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
      <p>Average warming: <strong>${formatValue(avgWarming, "°C")}</strong></p>
    `;
  } else if (metric === "hot_days_35c") {
    tooltipRows = `
      <p>Total 35°C+ days: <strong>${formatValue(totalHotDays, "days")}</strong></p>
      <p>Additional 35°C+ days: <strong>${formatValue(hotDaysChange, "days")}</strong></p>
      <p>Average warming: <strong>${formatValue(avgWarming, "°C")}</strong></p>
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

  if (!snapshotStateTitle.empty()) {
    snapshotStateTitle.text(stateName);
    snapshotStateText.text(
      `${stateName} connects the national pattern to a local question: how many more days cross the 35°C threshold?`
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
    "hot_days_35c",
    "monthly_hot_days_35c",
    "hot_days_35c_count",
    "days_35c",
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