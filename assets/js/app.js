import * as d3 from 'd3'
import * as voronoiMap from 'd3-voronoi-map'
//import {voronoiTreemap} from 'd3-voronoi-treemap'
import randomColor from 'randomcolor'
import chroma from 'chroma-js'
import roundTo from 'round-to'


d3.voronoiTreemap = function() {

  //begin: constants
  var DEFAULT_CONVERGENCE_RATIO = 0.01;
  var DEFAULT_MAX_ITERATION_COUNT = 50;
  var DEFAULT_MIN_WEIGHT_RATIO = 0.01;
  var DEFAULT_PRNG = Math.random;
  //end: constants

  /////// Inputs ///////
  var clip = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0]
  ]; // clipping polygon
  var extent = [
    [0, 0],
    [1, 1]
  ]; // extent of the clipping polygon
  var size = [1, 1]; // [width, height] of the clipping polygon
  var convergenceRatio = DEFAULT_CONVERGENCE_RATIO; // targeted allowed error ratio; default 0.01 stops computation when cell areas error <= 1% clipping polygon's area
  var maxIterationCount = DEFAULT_MAX_ITERATION_COUNT; // maximum allowed iteration; stops computation even if convergence is not reached; use a large amount for a sole converge-based computation stop
  var minWeightRatio = DEFAULT_MIN_WEIGHT_RATIO; // used to compute the minimum allowed weight; default 0.01 means 1% of max weight; handle near-zero weights, and leaves enought space for cell hovering
  var prng = DEFAULT_PRNG; // pseudorandom number generator

  //begin: internals
  var _voronoiMap = voronoiMap.voronoiMap();
  //end: internals


  ///////////////////////
  ///////// API /////////
  ///////////////////////

  function _voronoiTreemap(rootNode) {
    _voronoiMap.weight(function (d) {
        return d.value;
      })
      .convergenceRatio(convergenceRatio)
      .maxIterationCount(maxIterationCount)
      .minWeightRatio(minWeightRatio)
      .prng(prng);

    recurse(clip, rootNode);
  };

  _voronoiTreemap.convergenceRatio = function (_) {
    if (!arguments.length) {
      return convergenceRatio;
    }

    convergenceRatio = _;
    return _voronoiTreemap;
  };

  _voronoiTreemap.maxIterationCount = function (_) {
    if (!arguments.length) {
      return maxIterationCount;
    }

    maxIterationCount = _;
    return _voronoiTreemap;
  };

  _voronoiTreemap.minWeightRatio = function (_) {
    if (!arguments.length) {
      return minWeightRatio;
    }

    minWeightRatio = _;
    return _voronoiTreemap;
  };

  _voronoiTreemap.clip = function (_) {
    if (!arguments.length) {
      return clip;
    }

    //begin: use voronoiMap.clip() to handle clkip/extent/size computation and borderline input (non-counterclockwise, non-convex, ...)
    _voronoiMap.clip(_);
    //end: use voronoiMap.clip() to handle
    clip = _voronoiMap.clip();
    extent = _voronoiMap.extent();
    size = _voronoiMap.size();
    return _voronoiTreemap;
  };

  _voronoiTreemap.extent = function (_) {
    if (!arguments.length) {
      return extent;
    }

    //begin: use voronoiMap.extent() to handle clkip/extent/size computation
    _voronoiMap.extent(_);
    //end: use voronoiMap.clip() to handle
    clip = _voronoiMap.clip();
    extent = _voronoiMap.extent();
    size = _voronoiMap.size();
    return _voronoiTreemap;
  };

  _voronoiTreemap.size = function (_) {
    if (!arguments.length) {
      return size;
    }

    //begin: use voronoiMap.size()
    _voronoiMap.size(_);
    //end: use voronoiMap.clip() to handle clip/extent/size computation
    clip = _voronoiMap.clip();
    extent = _voronoiMap.extent();
    size = _voronoiMap.size();
    return _voronoiTreemap;
  };

  _voronoiTreemap.prng = function (_) {
    if (!arguments.length) {
      return prng;
    }

    prng = _;
    return _voronoiTreemap;
  };

  ///////////////////////
  /////// Private ///////
  ///////////////////////

  function recurse(clippingPolygon, node) {
    var voronoiMapRes;

    //assign polygon to node
    node.polygon = clippingPolygon;

    if (node.height != 0) {
      //compute one-level Voronoi map of children
      voronoiMapRes = _voronoiMap.clip(clippingPolygon)(node.children);
      //begin: recurse on children
      voronoiMapRes.polygons.forEach(function (cp) {
        recurse(cp, cp.site.originalObject.data.originalData);
      })
      //end: recurse on children
    }
  };

  return _voronoiTreemap;
}



var DIR = 1
var FILE = 2
var ROOT = 3
var LINK = 4
var SPECIAL = 5


var cellColors = {}
cellColors[DIR] = randomColor();
cellColors[FILE] = randomColor();
cellColors[ROOT] = randomColor();
cellColors[LINK] = randomColor();
cellColors[SPECIAL] = randomColor();


function boot() {
    draw_graph();
}


export default {
   boot: function(){boot();}
}


// function add_colors(data) {
//     data.color = randomColor();
//     data.children.forEach(function(child){
//         add_colors(child);
//     });
// }


function draw_graph() {
    // d3.json("/static/sampledata.json").then(function(rootData) {
    d3.json("/chart.json?n=x&depth=2").then(function(rootData) {
      initData();
      // add_colors(rootData);
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

  return [[-svgWidth/2,-svgHeight/2], [svgWidth/2,-svgHeight/2], [svgWidth/2,svgHeight/2], [-svgWidth/2,svgHeight/2]]
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
      .style("fill", function(d){ return cellColors[d.typ]; });
  legend.append("text")
      .classed("tiny", true)
      .attr("transform", "translate("+[colorWidth+5, -2]+")")
      .text(function(d){ return d.name; });

  legendContainer.append("text")
      .attr("transform", "translate("+[0, -continents.length*(legendHeight+interLegend)-5]+")")
    .text("Continents");
}

function format_percent(value) {
    return roundTo(value * 100, 2) + "%";
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
          return cellColors[d.data.typ];
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
      return d.data.name; //(d.data.weight<1)? d.data.code : d.data.name;
      });
  labels.append("text")
      .classed("value", true)
      .text(function(d){ return format_percent(d.data.weight); });

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
