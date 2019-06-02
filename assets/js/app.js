import * as d3 from 'd3'
import treemap from 'd3-hierarchy'
import randomColor from 'randomcolor'
import filesize from 'filesize'
// import chroma from 'chroma-js'
// import roundTo from 'round-to'

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
    prep_graph();
}

export default {
   boot: function(){boot();}
}

function prep_graph() {
    d3.json("/chart.json?n=" + _node + "&depth=" + _graph_depth).then(draw_graph);
}

function can_click(d) {
    return d.data.typ >= 0 && d.data.num_children > 0
}

function draw_graph(data) {
    var chart_width = document.getElementsByTagName("body")[0].clientWidth;
    var chart_height = window.innerHeight * 0.5;

    var treemapLayout = d3.treemap().tile(d3.treemapBinary); // treemapBinary, treemapSquarify

    treemapLayout
        .size([chart_width, chart_height])
        .paddingTop(25)
        .paddingRight(6)
        .paddingBottom(6)
        .paddingLeft(6)


    d3.select('svg').attr('width', chart_width).attr('height', chart_height);

    var root = d3.hierarchy(data);

    treemapLayout(root);

    var nodes = d3.select('svg g.chart')
        .selectAll('g')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', function(d) {return can_click(d) ? 'can-navigate' : 'no-navigate'})
        .attr('transform', function(d) {return 'translate(' + [d.x0, d.y0] + ')'})

    nodes
        .attr('width', function(d) { return d.x1 - d.x0; })
        .attr('height', function(d) { return d.y1 - d.y0; })

    // Create the colored rectangles
    nodes
        .append('rect')
        // .attr('fill', function(d){return randomColor()})
        .attr('width', function(d) { return d.x1 - d.x0; })
        .attr('height', function(d) { return d.y1 - d.y0; })
        .attr('id', function(d) {return "node-" + d.data.id;})
        .on('click', function(d){if(can_click(d)) window.location = "/?n=" + d.data.id;})

    // Create clip paths for clipping the contents of the nodes
    nodes
        .append('clipPath')
        .attr('id', function(d) {return "clip-" + d.data.id;})
        .append('use')
        .attr('href', function(d) {return "#node-" + d.data.id;})


    // Name labels
    nodes
        .append('a')
        .attr('href', function(d){if(can_click(d)) return "/?n=" + d.data.id;})
        .append('text')
        .attr('dx', 2)
        .attr('dy', "1em")
        .attr('clip-path', function(d) {return "url(#clip-" + d.data.id + ")"})
        .text(function(d) {
            return d.data.name + (d.data.typ == DIR? "/":"")
        })

    // Size values
    nodes
        .append('text')
        .attr('dx', 2)
        .attr('dy', "2em")
        .text(function(d) {
            return filesize(d.data.value);
        })
        .attr('clip-path', function(d) {return "url(#clip-" + d.data.id + ")"})

    var nodecnt = 0
    nodes.each(function(){nodecnt++;})
    console.log("total nodes: " + nodecnt)
}
