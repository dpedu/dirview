function p_init() {
    draw_graph()
}


function add_colors(data) {
    data.color = randomColor();
    data.children.forEach(function(child){
        add_colors(child);
    });
}


function draw_graph() {
    // d3.json("/static/sampledata.json").then(function(rootData) {
    d3.json("/chart.json?n=x&depth=1").then(function(rootData) {
      initData();
      add_colors(rootData);
      initLayout(rootData);


      hierarchy = d3.hierarchy(rootData).sum(function(d){ return d.weight; });
      // console.log(hierarchy)
      _voronoiTreemap
        .clip(circlingPolygon)
          (hierarchy);

      console.log(rootData);
      drawTreemap(hierarchy);
    });
}

//begin: constants
var _2PI = 2*Math.PI;
//end: constants

//begin: layout conf.
var svgWidth = 1500,
    svgHeight = 600,
    margin = {top: 10, right: 10, bottom: 10, left: 10},
    height = svgHeight - margin.top - margin.bottom,
    width = svgWidth - margin.left - margin.right,
    halfWidth = width/2,
    halfHeight = height/2,
    quarterWidth = width/4,
    quarterHeight = height/4,
    titleY = 20,
    legendsMinY = height - 20,
    treemapRadius = 0,
    treemapCenter = [halfWidth, halfHeight+5];
//end: layout conf.

//begin: treemap conf.
var _voronoiTreemap = d3.voronoiTreemap();
var hierarchy, circlingPolygon;
//end: treemap conf.

//begin: drawing conf.
var fontScale = d3.scaleLinear();
//end: drawing conf.

//begin: reusable d3Selection
var svg, drawingArea, treemapContainer;
//end: reusable d3Selection



function initData(rootData) {
  circlingPolygon = computeCirclingPolygon(treemapRadius);
  fontScale.domain([3, 20]).range([8, 20]).clamp(true);
}

function computeCirclingPolygon(radius) {
  /*var points = 60,
      increment = _2PI/points,
      circlingPolygon = [];

  for (var a=0, i=0; i<points; i++, a+=increment) {
    circlingPolygon.push(
      [radius + radius*Math.cos(a), radius + radius*Math.sin(a)]
    )
  }

  return circlingPolygon;*/

  return [[-600,-250], [600,-250], [600,250], [-600,250], [-600,-250]]
};

function initLayout(rootData) {
  svg = d3.select("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight);

  drawingArea = svg.append("g")
      .classed("drawingArea", true)
      .attr("transform", "translate("+[margin.left,margin.top]+")");

  treemapContainer = drawingArea.append("g")
      .classed("treemap-container", true)
      .attr("transform", "translate("+treemapCenter+")");

  treemapContainer.append("path")
      .classed("world", true)
      .attr("transform", "translate("+[-treemapRadius,-treemapRadius]+")")
      .attr("d", "M"+circlingPolygon.join(",")+"Z");

  // drawTitle();
  drawLegends(rootData);
}

// function drawTitle() {
//   drawingArea.append("text")
//       .attr("id", "title")
//       .attr("transform", "translate("+[halfWidth, titleY]+")")
//       .attr("text-anchor", "middle")
//     .text("The Global Economy by GDP (as of 01/2017)")
// }

function drawLegends(rootData) {
  var legendHeight = 13,
      interLegend = 4,
      colorWidth = legendHeight*6,
      continents = rootData.children.reverse();

  var legendContainer = drawingArea.append("g")
      .classed("legend", true)
      .attr("transform", "translate("+[0, legendsMinY]+")");

  var legends = legendContainer.selectAll(".legend")
      .data(continents)
      .enter();

  var legend = legends.append("g")
      .classed("legend", true)
      .attr("transform", function(d,i){
      return "translate("+[0, -i*(legendHeight+interLegend)]+")";
    })

  legend.append("rect")
      .classed("legend-color", true)
      .attr("y", -legendHeight)
      .attr("width", colorWidth)
      .attr("height", legendHeight)
      .style("fill", function(d){ return d.color; });
  legend.append("text")
      .classed("tiny", true)
      .attr("transform", "translate("+[colorWidth+5, -2]+")")
      .text(function(d){ return d.name; });

  legendContainer.append("text")
      .attr("transform", "translate("+[0, -continents.length*(legendHeight+interLegend)-5]+")")
    .text("Continents");
}

function format_percent(value) {
    return round(value * 100, 2) + "%";
}

function drawTreemap(hierarchy) {
  var leaves=hierarchy.leaves();

  var cells = treemapContainer.append("g")
      .classed('cells', true)
      .attr("transform", "translate("+[-treemapRadius,-treemapRadius]+")")
      .selectAll(".cell")
      .data(leaves)
      .enter()
          .append("path")
              .classed("cell", true)
              .attr("d", function(d){ return "M"+d.polygon.join(",")+"z"; })
              .style("fill", function(d){
          return d.data.color;
          });

  var labels = treemapContainer.append("g")
      .classed('labels', true)
      .attr("transform", "translate("+[-treemapRadius,-treemapRadius]+")")
      .selectAll(".label")
      .data(leaves)
      .enter()
          .append("g")
              .classed("label", true)
              .attr("transform", function(d){
              return "translate("+[d.polygon.site.x, d.polygon.site.y]+")";
        })
              .style("font-size", function(d){ return fontScale(d.data.weight*100); });

  labels.append("text")
      .classed("name", true)
      .html(function(d){
      return (d.data.weight<1)? d.data.code : d.data.name;
      });
  labels.append("text")
      .classed("value", true)
      .text(function(d){ return d.data.name + "\r\n" + format_percent(d.data.weight); });

  var hoverers = treemapContainer.append("g")
      .classed('hoverers', true)
      .attr("transform", "translate("+[-treemapRadius,-treemapRadius]+")")
      .selectAll(".hoverer")
      .data(leaves)
      .enter()
          .append("path")
              .classed("hoverer", true)
              .attr("d", function(d){ return "M"+d.polygon.join(",")+"z"; });

  hoverers.append("title")
    .text(function(d) { return d.data.name + "\n" + format_percent(d.value); });
}


function round(num, places) {
    return Math.round(num*places*100) / (places*100)
}
