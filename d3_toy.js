var debugvar;

function str2number(str)
{
  str = str.replace(/,/g, "");
  var match = str.match(/[\d\.]+/);
  return match ? parseFloat(match[0]) : 0.0;
}

function opportunity2number(str)
{
  if(str.trim() == "N/A") {
    return null;
  }
  return str2number(str);
}

function DataSet(opts)
{
  this.data_rows = [];
  if(opts.json) {
    this.from_json(opts.json);
  } else if(opts.load == "oops") {
    this.load_data_oops_page();
  } else if(opts.load == "tt") {
    this.load_data_tt_report();
  }
}

DataSet.prototype.length = function() 
{
  return this.data_rows.length;
}

function TreeNode()
{
  this.name = null;
  this.children = [];
  return this;
}

DataSet.prototype.load_data_tt_report = function() 
{
  var root = new TreeNode();
  var lookup = {};
  var prev_rule;
  var prev_mcat;
  root.name = "Template";
  jQuery("tr[id^=ttrn]").each(function() {
    var row = jQuery(this);
    var id = row.attr("id");
    var node = new TreeNode();
    lookup[id] = node;                  // remember this for parent lookup later

    // find the parent if any
    var match = row.attr("class").match(/child_of_(\S*)/);
    var parent = null;
    if(match) {         // rule nodes have child_of_N
      var parent_id = match.last();
      parent = lookup[parent_id];
    } else if(row.hasClass("mcat")) {
      parent = prev_rule;
    } else if(row.hasClass("model")) {
      parent = prev_mcat;
    }

    if(parent) {
      parent.children.push(node);
    } else {
      root.children.push(node); 
    }

    // get the node name
    node.name = row.children("td.name").text().trim();

    // get the node size
    node.size = str2number(row.children("td.current").text());
    
    // update prev pointers
    if(row.hasClass("rule")) {
      prev_rule = node;
    } else if(row.hasClass("mcat")) {
      prev_mcat = node;
    }

  });

  this.root = root;
}

DataSet.prototype.load_data_oops_page = function()
{
  var new_data_rows = [];
  jQuery("#overview_rows tr[id^=account]")
    .each( function() {
      var row = jQuery(this);
      var row_id = row.attr("id");
      var cell_data = {};
      row.children("td")
        .each( function() {
          cell = jQuery(this);
          if(cell.hasClass("status")) {
            var text = cell.text().length == 0 ? "ok" : cell.text();
            cell_data.status = text;
          }
          else if(cell.hasClass("authority_label")) {
            cell_data.authority_label = cell.text();
          }
          else if(cell.hasClass("AUM")) {
            cell_data.aum = str2number(cell.text());
          }
          else if(cell.prev().hasClass("AUM")) { /* cash is not tagged */
            cell_data.cash = str2number(cell.text());
          }
          else if(cell.hasClass("opportunity")) {
            cell_data.opportunity = opportunity2number(cell.text());
          }
          else if(cell.prev().hasClass("opportunity")) {      /* tracking pref is not tagged */
            cell_data.tracking_preference = str2number(cell.text());
          }
          else if(cell.hasClass("tracking_error_pre")) {
            cell_data.tracking_error_pre = str2number(cell.text());
          }
          else if(cell.hasClass("tracking_error_post")) {
            cell_data.tracking_error_post = str2number(cell.text());
          }
        })
      new_data_rows.push(cell_data);
    });
  this.data_rows = new_data_rows;
}

DataSet.prototype.from_json = function(str) { this.data_rows = JSON.parse(str); }
DataSet.prototype.to_json = function() { return JSON.stringify(this.data_rows); }

//------------------------------------------------------------
//------------------------------------------------------------

function count_pct(dataset, attr)
{
  var counts = {};
  var num_rows = 0;
  for(var i = 0; i < dataset.length(); i++) {
    var row = dataset.data_rows[i];
    var label = row[attr];
    counts[label] = counts[label] || 0;
    counts[label] += 1;
    num_rows += 1;
  }
  var data = [];
  console.log(num_rows);
  debugvar = counts;
  jQuery.each(Object.keys(counts), function(i, k) {
      data.push({name: k, value: counts[k]/num_rows });
    });
  return data;
}

function bar_chart(data, attrs, path) {
    var raw_values = jQuery.map(data, function(item,i) {return item.value;});
    var width = 620;
    var barHeight = 15;
    var width_pad_right = 200;
    var g_pad_top = 2;
    var n_bars = attrs.length;
    // create a scaling object, scaling by domain and range
    var x = d3.scale.linear()
                    .domain([0,d3.max(raw_values)])
                    .range([0,width-width_pad_right]);       // scalong less than width to leave room for text at the end
    // set the dimensions of the chart container
    // keep a handle on the container
    var chart = d3.select(path + ".chart")
                 .attr("width", width)
                 .attr("height", (barHeight + g_pad_top) * data.length * 2);
    // create a bunch of g containers at the appropriate offsets for each data bar
    // keep a handle on the new containers
    var bar = chart.selectAll("g")
                   .data(data)
                   .enter().append("g")
                   .attr("transform", function(d, i) { return "translate(0," + (i * (barHeight*n_bars + g_pad_top) )+ ")"; });
    // add a line above each container
    bar.append("line")
       .attr("x1", 0)
       .attr("y1", 0)
       .attr("x2", width)
       .attr("y2", 0)
       .attr("class","divider");

    // add rectangles for current, recommended to each of the g containers
    jQuery.each(attrs,function(i, item) {
      bar.append("rect")
       .attr("y", g_pad_top + barHeight*i)
       .attr("width", function(d) {return x(d[item.name]) + 1;})
       .attr("height", barHeight - 1)
      .attr("style", "fill: "+item.color);     
    });

    // add caption
    bar.append("text")
       .attr("x",width)                                         // with text-anchor=end end text at end of svg
       .attr("y", barHeight/2)
       .attr("dy", ".35em")
       .text(function(d){return d.name;});

}

//------------------------------------------------------------
//------------------------------------------------------------

function ColorSpec() 
{
  this.colors = {};
  this.backup_colors = d3.scale.category20c();
}
ColorSpec.prototype.set = function(key, color) 
{
  this.colors[key] = color;
  return this;
}
ColorSpec.prototype.get = function(key) 
{
  var color = this.colors[key];
  if(!color) {
    color = this.backup_colors(key);
    this.colors[key] = color;
  }
  return color;
}
ColorSpec.prototype.picker = function()
{
  var colorspec = this;
  var color = function(key) { return colorspec.get(key); } 
  return color;
}

//------------------------------------------------------------

function pie_chart(data, path, color) 
{
  var width = 300;
  var height = 300;
  var radius = 100;

  var g = d3.select(path + ".chart")
    .data([data])      // why does this have to be an array around the data array?
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate("+radius+","+radius+")");

  // functions for generating arcs
  var arc = d3.svg.arc()
              .outerRadius(radius)
              .innerRadius(0);
  var textarc = d3.svg.arc().outerRadius(radius).innerRadius(50);

  var pie = d3.layout.pie()
              .value(function(d) {return d.value;});

  // generate slices of the pie
  var arcs = g.selectAll("g.slice")
              .data(pie)
              .enter()
              .append("g")
              .attr("class", "slice");

  arcs.append("path")
      .attr("fill", function(d,i){return color(d.data.name);})
      .attr("d", arc);

  // caption
  arcs.append("text")
      .attr("transform", function(d) {
        return "translate(" + textarc.centroid(d) + ")";
      })
      .attr("style", "text-anchor: middle")
      .text(function(d,i) { return data[i].name; });

}

//------------------------------------------------------------
function histogram(dataset, attr, path, color)
{
  var raw_values = jQuery.map(dataset.data_rows, function(item,i) {return item[attr];});
  raw_values = jQuery.grep(raw_values, function(val, i) { return val != null;});

  var formatCount = d3.format(",.0f");

  var margin = {top: 10, right: 30, bottom: 30, left: 30};
  var padding = {top: 10, bottom: 100};
  var width = 550 - margin.left - margin.right;
  var height = 400 - margin.top - margin.bottom - padding.top - padding.bottom;

  var scale_x = d3.scale.linear()
                .domain([0,d3.max(raw_values)])
                .range([0,width]);

  // array of groups of binned values
  var data = d3.layout.histogram()
      .bins(scale_x.ticks(10))            // returns a function based on an array of tick values
      //.bins([0,1000000,2000000,3000000,4000000,5000000,30000000 ])            // returns a function based on an array of tick values
      (raw_values);

  var scale_y = d3.scale.linear()
                .domain([0, d3.max(data, function(d) { return d.y; })])
                .range([height, 0]);

  var xAxis = d3.svg.axis()
      .scale(scale_x)
      .orient("bottom");

  var svg = d3.select(path + " svg.chart")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom + padding.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + (margin.top + padding.top)+ ")");

  var bar = svg.selectAll(".bar")
      .data(data)
      .enter().append("g")
      .attr("class", "bar")
      .attr("transform", function(d) { return "translate(" + scale_x(d.x) + "," + scale_y(d.y) + ")"; });

  bar.append("rect")
      .attr("x", 1)
      .attr("width", scale_x(data[0].dx) - 1)
      .attr("height", function(d) { return height - scale_y(d.y); })
      .attr("fill", color(0));

  bar.append("text")
      .attr("dy", ".75em")
      .attr("y", -20)
      .attr("x", scale_x(data[0].dx) / 2)
      .attr("text-anchor", "middle")
      //.attr("text-anchor", "end")
      //.attr("transform", function(d) {return "rotate(-65)"; } )
      .text(function(d) { return formatCount(d.y); });

  svg.append("g")
      .attr("class", "x_axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
      .selectAll("text")                        // rotate the axis labels
        .attr("dx", "-1.5em")
        .attr("dy", ".75em")
        .attr("text-anchor", "end")
        .attr("transform", function(d) {return "rotate(-65)"; } );

}

//------------------------------------------------------------
//------------------------------------------------------------
function icicle(dataset) 
{
  var width = 960,
      height = 800;

  var color = d3.scale.category20();

  var svg = d3.select("body").append("svg")
      .attr("width", width)
      .attr("height", height);

  var partition = d3.layout.partition()
      .size([width, height])
      .value(function(d) { return d.size; });

  var nodes = partition.nodes(dataset.root);

  svg.selectAll(".node")
      .data(nodes)
    .enter().append("rect")
      .attr("class", "node")
      .attr("x", function(d) { return d.x; })
      .attr("y", function(d) { return d.y; })
      .attr("width", function(d) { return d.dx; })
      .attr("height", function(d) { return d.dy; })
      .style("fill", function(d) { return color((d.children ? d : d.parent).name); });

  svg.selectAll(".label")
      .data(nodes.filter(function(d) { return d.dx > 6; }))
    .enter().append("text")
      .attr("class", "label")
      .attr("dy", ".35em")
      .attr("transform", function(d) { return "translate(" + (d.x + d.dx /(d.depth+1) ) + "," + (d.y + d.dy / 8) + ")rotate(90)"; })
      .text(function(d) { return d.depth + d.name; });
}

//------------------------------------------------------------
//------------------------------------------------------------
function init(opts)
{
  //include("http://d3js.org/d3.v3.min.js");

  if(opts.standalone) {
    jQuery("head").append('<link rel="stylesheet" href="//code.jquery.com/ui/1.10.4/themes/smoothness/jquery-ui.css">');
    jQuery("head").append('<style type="text/css">div.layer { clear: both; } div.smallchart { display: inline-block; float: left; } #chart div.barchart { font: 10px sans-serif; background-color: steelblue; text-align: left; height: 5; padding: 3px; margin: 1px; color: white; } svg.chart { margin-top: 15px; } .chart rect { fill: steelblue; } .chart rect.recommended { fill: green; } .chart rect.current{ fill: red; } .chart line.divider { stroke: #000000; stroke-opacity: 0.3; } .chart text { fill: black; font: 10px sans-serif; /* text-anchor: start; */ text-anchor: end; } g.x_axis { fill: none; font-weight: normal; stroke: #000000; stroke-width: 1; } <style>');

    dataset = new DataSet({json: test_data});

  } else {
    dataset = new DataSet({load: oops});
  }

  var root = jQuery("body");

  if(!opts.standalone) {
    root.append("<div id=d3test>");
    root = jQuery("#d3test");
  }

  root.append("<div class=layer>");
  parent = jQuery("div.layer").last();
   
  parent.append("<div id=status class=smallchart><h2>Account Status</h2><svg class=chart></svg></div>")
  var colorspec = new ColorSpec()
           .set("Error", "red")
           //.set("Re-Analyze", "#6baed6")
           .set("Re-Analyze", "orange")
           .set("ok", "green");
  pie_chart(count_pct(dataset, "status"), "#status ", colorspec.picker());

  parent.append("<div id=authority_label class=smallchart><h2>Authority Label</h2><svg class=chart></svg></div>")
  //bar_chart(count_pct(dataset, "authority_label"), [{name: "value", color: "steelblue"}], "#authority_label ");
  var colorspec = new ColorSpec()
                        .set("Joint", "orange")
                        .set("Sole", "green");
  pie_chart(count_pct(dataset, "authority_label"), "#authority_label ", colorspec.picker());

  root.append("<div class=layer>");
  parent = jQuery("div.layer").last();

  parent.append("<div id=tracking_preference class=smallchart><h2>Tracking Pref</h2><svg class=chart></svg></div>")
  //pie_chart(count_pct(dataset, "tracking_preference").sort(function(a,b) { return a.name - b.name; }), "#tracking_preference ");
  bar_chart(count_pct(dataset, "tracking_preference").sort(function(a,b) { return a.name - b.name; }), [{name: "value", color: "steelblue"}], "#tracking_preference ");

  root.append("<div class=layer>");
  parent = jQuery("div.layer").last();

  var colorspec = new ColorSpec()
  parent.append("<div id=opportunity class=smallchart><h2>Opportunity</h2><svg class=chart></svg></div>")
  histogram(dataset, "opportunity", "#opportunity", colorspec.picker());


  var colorspec = new ColorSpec()
  parent.append("<div id=aum class=smallchart><h2>aum</h2><svg class=chart></svg></div>")
  histogram(dataset, "aum", "#aum", colorspec.picker());

  if(!opts.standalone) {
    root.dialog({modal: true, width:900});
  }
}

function inSmartleaf()
{
  return jQuery("body.appPage").length > 0;
}

// standalone=false if running in the app
jQuery(document).ready( function() { init({standalone: !inSmartleaf()}); } );






//------------------------------------------------------------
//- Test data below !!!! -------------------------------------

test_data= '[{"status":"Error","authority_label":"Sole","aum":1165603,"cash":434370,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"ok","authority_label":"Sole","aum":316584,"cash":3390,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"ok","authority_label":"Sole","aum":327416,"cash":3908,"opportunity":0.15,"tracking_preference":3,"tracking_error_pre":1.9,"tracking_error_post":1.8},{"status":"Error","authority_label":"Sole","aum":266384,"cash":190905,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":791827,"cash":10839,"opportunity":2.85,"tracking_preference":2,"tracking_error_pre":3,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Sole","aum":4919044,"cash":318273,"opportunity":0.34,"tracking_preference":3,"tracking_error_pre":2.1,"tracking_error_post":1.9},{"status":"Re-Analyze","authority_label":"Sole","aum":5157153,"cash":48764,"opportunity":0.5,"tracking_preference":1,"tracking_error_pre":0.3,"tracking_error_post":0.2},{"status":"Error","authority_label":"Joint","aum":1115075,"cash":1115075,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":101936,"cash":1936,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":126079,"cash":26079,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":123854,"cash":15918,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":465672,"cash":8754,"opportunity":0.7,"tracking_preference":2,"tracking_error_pre":0.8,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":504641,"cash":4566,"opportunity":0.01,"tracking_preference":3,"tracking_error_pre":0.6,"tracking_error_post":0.6},{"status":"Re-Analyze","authority_label":"Sole","aum":1159499,"cash":13617,"opportunity":0.12,"tracking_preference":5,"tracking_error_pre":3.7,"tracking_error_post":3.7},{"status":"Error","authority_label":"Sole","aum":888048,"cash":69006,"opportunity":0,"tracking_preference":4,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"What-If","aum":892758,"cash":28597,"opportunity":0.88,"tracking_preference":4,"tracking_error_pre":4.4,"tracking_error_post":4.1},{"status":"Error","authority_label":"Joint","aum":151740,"cash":858,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Joint","aum":3289,"cash":3289,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":73024,"cash":1932,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2223185,"cash":50162,"opportunity":0.68,"tracking_preference":5,"tracking_error_pre":4.7,"tracking_error_post":3.6},{"status":"Re-Analyze","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":5.97,"tracking_preference":4,"tracking_error_pre":6.9,"tracking_error_post":2.9},{"status":"Error","authority_label":"Sole","aum":32939,"cash":24372,"opportunity":0,"tracking_preference":4,"tracking_error_pre":0,"tracking_error_post":0},{"status":"ok","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":2.22,"tracking_preference":4,"tracking_error_pre":6.2,"tracking_error_post":2.3},{"status":"ok","authority_label":"Sole","aum":111654,"cash":82649,"opportunity":2.22,"tracking_preference":4,"tracking_error_pre":6.2,"tracking_error_post":2.3},{"status":"ok","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":2.22,"tracking_preference":4,"tracking_error_pre":6.2,"tracking_error_post":2.3},{"status":"ok","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":2.22,"tracking_preference":4,"tracking_error_pre":6.2,"tracking_error_post":2.3},{"status":"Re-Analyze","authority_label":"Sole","aum":357436,"cash":15389,"opportunity":1.29,"tracking_preference":2,"tracking_error_pre":1.3,"tracking_error_post":0.6},{"status":"Re-Analyze","authority_label":"Sole","aum":187497,"cash":187497,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":204540,"cash":105290,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":204515,"cash":204515,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":147560,"cash":147560,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2227,"cash":2227,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1016980,"cash":271048,"opportunity":0,"tracking_preference":4,"tracking_error_pre":3.1,"tracking_error_post":3.1},{"status":"Re-Analyze","authority_label":"Sole","aum":38305,"cash":38305,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":177,"cash":177,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":770440,"cash":10020,"opportunity":1.67,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":2284627,"cash":30460,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2922094,"cash":6702,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":442860,"cash":21740,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":209696,"cash":887,"opportunity":2.53,"tracking_preference":1,"tracking_error_pre":1.3,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Sole","aum":1080860,"cash":21043,"opportunity":1.98,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":625110,"cash":1088,"opportunity":0.76,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":1227110,"cash":7243,"opportunity":2.17,"tracking_preference":0,"tracking_error_pre":0.6,"tracking_error_post":0.2},{"status":"Error","authority_label":"Sole","aum":211184,"cash":5406,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":727906,"cash":68702,"opportunity":0.06,"tracking_preference":5,"tracking_error_pre":1.6,"tracking_error_post":1.3},{"status":"Re-Analyze","authority_label":"Sole","aum":30294,"cash":30294,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1335443,"cash":10671,"opportunity":1.09,"tracking_preference":2,"tracking_error_pre":2.6,"tracking_error_post":2.4},{"status":"Re-Analyze","authority_label":"Sole","aum":21178,"cash":21178,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":156172,"cash":9952,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0.1,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":170367,"cash":10513,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0.1,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Joint","aum":200981,"cash":200981,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":305433,"cash":34189,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2,"cash":2,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1170695,"cash":11401,"opportunity":1.78,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Joint","aum":112167,"cash":8358,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":112167,"cash":8358,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":112167,"cash":8358,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":133,"cash":133,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":34631262,"cash":474168,"opportunity":1.63,"tracking_preference":1,"tracking_error_pre":1.1,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"Sole","aum":236003,"cash":1180,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":19253232,"cash":206941,"opportunity":0.97,"tracking_preference":1,"tracking_error_pre":0.9,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":12096877,"cash":367905,"opportunity":0,"tracking_preference":3,"tracking_error_pre":2.3,"tracking_error_post":2.3},{"status":"Re-Analyze","authority_label":"Sole","aum":11173475,"cash":112472,"opportunity":0,"tracking_preference":3,"tracking_error_pre":2.2,"tracking_error_post":2.2},{"status":"Re-Analyze","authority_label":"Joint","aum":149711,"cash":149711,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":90000,"cash":90000,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":14818340,"cash":204117,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":314362,"cash":3440,"opportunity":0.78,"tracking_preference":2,"tracking_error_pre":0.9,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":7293002,"cash":224781,"opportunity":0.81,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":63,"cash":63,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":339906,"cash":4353,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":4707078,"cash":125669,"opportunity":0.17,"tracking_preference":3,"tracking_error_pre":2.6,"tracking_error_post":2.6},{"status":"Re-Analyze","authority_label":"Joint","aum":531926,"cash":25145,"opportunity":0.3,"tracking_preference":3,"tracking_error_pre":2.3,"tracking_error_post":2},{"status":"Re-Analyze","authority_label":"Joint","aum":487088,"cash":4150,"opportunity":0.05,"tracking_preference":3,"tracking_error_pre":1.2,"tracking_error_post":1.1},{"status":"Re-Analyze","authority_label":"Joint","aum":5816133,"cash":55147,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":270883,"cash":3475,"opportunity":1.26,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":398855,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":244019,"cash":993,"opportunity":0.34,"tracking_preference":0,"tracking_error_pre":0.2,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":1099341,"cash":26912,"opportunity":0.75,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":9094,"cash":9094,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":42755,"cash":42755,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Joint","aum":165498,"cash":1072,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2285725,"cash":138683,"opportunity":1.1,"tracking_preference":2,"tracking_error_pre":1,"tracking_error_post":0.7},{"status":"Error","authority_label":"Sole","aum":578442,"cash":3377,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2290187,"cash":107851,"opportunity":0.01,"tracking_preference":3,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Error","authority_label":"Sole","aum":7636,"cash":7636,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":11265,"cash":1075,"opportunity":1.6,"tracking_preference":1,"tracking_error_pre":1.5,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":85180,"cash":1737,"opportunity":0,"tracking_preference":1,"tracking_error_pre":1,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"What-If","aum":10610,"cash":10610,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1001812,"cash":26740,"opportunity":1.33,"tracking_preference":1,"tracking_error_pre":7.5,"tracking_error_post":7.4},{"status":"Re-Analyze","authority_label":"Sole","aum":529557,"cash":41485,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":157,"cash":157,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1407606,"cash":5196,"opportunity":0.38,"tracking_preference":4,"tracking_error_pre":0.6,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":716649,"cash":38432,"opportunity":5.34,"tracking_preference":2,"tracking_error_pre":10.2,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":554554,"cash":554554,"opportunity":4.58,"tracking_preference":3,"tracking_error_pre":13.8,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":200,"cash":200,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":709619,"cash":709619,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"ok","authority_label":"Sole","aum":838270,"cash":0,"opportunity":2.6,"tracking_preference":1,"tracking_error_pre":2.1,"tracking_error_post":1.7},{"status":"Re-Analyze","authority_label":"Sole","aum":2911454,"cash":14001,"opportunity":1.33,"tracking_preference":1,"tracking_error_pre":0.9,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Sole","aum":332268,"cash":291227,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1571800,"cash":272,"opportunity":0.3,"tracking_preference":3,"tracking_error_pre":1.6,"tracking_error_post":1.1},{"status":"Re-Analyze","authority_label":"Sole","aum":1668588,"cash":46916,"opportunity":0.09,"tracking_preference":2,"tracking_error_pre":1.1,"tracking_error_post":1.2},{"status":"Re-Analyze","authority_label":"Sole","aum":390054,"cash":390054,"opportunity":0,"tracking_preference":6,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":618490,"cash":41134,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":321,"cash":321,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1437858,"cash":7007,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":146431,"cash":5844,"opportunity":0.41,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":1446933,"cash":14277,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":77365,"cash":486,"opportunity":0.4,"tracking_preference":0,"tracking_error_pre":0.2,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":2728816,"cash":23506,"opportunity":0.48,"tracking_preference":4,"tracking_error_pre":0.7,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":386289,"cash":4262,"opportunity":0.02,"tracking_preference":4,"tracking_error_pre":0.3,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1799448,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":764865,"cash":10617,"opportunity":1.83,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Joint","aum":5,"cash":5,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":259870,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2820,"cash":2820,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1625622,"cash":20109,"opportunity":0.5,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Joint","aum":983602,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":269,"cash":269,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":56002,"cash":56002,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":0,"cash":0,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1193,"cash":1193,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":13170,"cash":13170,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":112839,"cash":2283,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":420896,"cash":15947,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":1117,"cash":1117,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":227133,"cash":1207,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":3671460,"cash":36697,"opportunity":0,"tracking_preference":1,"tracking_error_pre":1.4,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":932635,"cash":13569,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1256677,"cash":11363,"opportunity":1.16,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":1057525,"cash":80999,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":363024,"cash":363024,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":552196,"cash":6143,"opportunity":1.1,"tracking_preference":3,"tracking_error_pre":4.7,"tracking_error_post":4.2},{"status":"Re-Analyze","authority_label":"Sole","aum":23882,"cash":23882,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":620343,"cash":5743,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":3824,"cash":3824,"opportunity":7.76,"tracking_preference":1,"tracking_error_pre":16.5,"tracking_error_post":6.2},{"status":"Re-Analyze","authority_label":"Sole","aum":226783,"cash":226783,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":779931,"cash":358,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":38323,"cash":38323,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":217,"cash":217,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":3439993,"cash":228553,"opportunity":1.93,"tracking_preference":1,"tracking_error_pre":1.6,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":13807,"cash":0,"opportunity":1.88,"tracking_preference":1,"tracking_error_pre":2,"tracking_error_post":1.8},{"status":"Re-Analyze","authority_label":"Sole","aum":499879,"cash":9070,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":205444,"cash":2715,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":668331,"cash":14181,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Sole","aum":298229,"cash":7844,"opportunity":1.34,"tracking_preference":1,"tracking_error_pre":2.3,"tracking_error_post":2.3},{"status":"Re-Analyze","authority_label":"Sole","aum":967676,"cash":10032,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1013598,"cash":13747,"opportunity":0.22,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":1067414,"cash":2539,"opportunity":2.27,"tracking_preference":1,"tracking_error_pre":1,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":326152,"cash":8272,"opportunity":1.83,"tracking_preference":1,"tracking_error_pre":0.9,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":896288,"cash":473,"opportunity":1.89,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":176012,"cash":9829,"opportunity":0.31,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":1117314,"cash":11497,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":332762,"cash":52595,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":594166,"cash":11369,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":961535,"cash":5188,"opportunity":0.47,"tracking_preference":1,"tracking_error_pre":1,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"Sole","aum":5275456,"cash":18215,"opportunity":1.11,"tracking_preference":2,"tracking_error_pre":4,"tracking_error_post":4.2},{"status":"Re-Analyze","authority_label":"Sole","aum":579513,"cash":30659,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":326944,"cash":0,"opportunity":0.13,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":37,"cash":37,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":49140,"cash":49140,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1333101,"cash":790923,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":0,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":259133,"cash":242,"opportunity":0.01,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":1308729,"cash":60818,"opportunity":2.33,"tracking_preference":1,"tracking_error_pre":1.4,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"Sole","aum":1245077,"cash":18973,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1249590,"cash":1400,"opportunity":1.12,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":579830,"cash":208003,"opportunity":6.82,"tracking_preference":1,"tracking_error_pre":9.7,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":1153155,"cash":2973,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":7880128,"cash":77319,"opportunity":0.26,"tracking_preference":4,"tracking_error_pre":0.9,"tracking_error_post":0.9},{"status":"Re-Analyze","authority_label":"Sole","aum":206868,"cash":15841,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":516204,"cash":2669,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":571803,"cash":601,"opportunity":2.39,"tracking_preference":1,"tracking_error_pre":5.2,"tracking_error_post":5.1},{"status":"Re-Analyze","authority_label":"Joint","aum":591217,"cash":591217,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":979786,"cash":110,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1370007,"cash":7280,"opportunity":2.8,"tracking_preference":2,"tracking_error_pre":3.2,"tracking_error_post":1.5},{"status":"Re-Analyze","authority_label":"Sole","aum":746106,"cash":24345,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":694074,"cash":8748,"opportunity":0.87,"tracking_preference":2,"tracking_error_pre":1.1,"tracking_error_post":0.6},{"status":"Re-Analyze","authority_label":"Sole","aum":125772,"cash":11598,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":6033326,"cash":64006,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":11207324,"cash":68781,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":18628,"cash":18628,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1848321,"cash":20997,"opportunity":0,"tracking_preference":4,"tracking_error_pre":0.2,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":165357,"cash":42459,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":1171911,"cash":9657,"opportunity":1.18,"tracking_preference":2,"tracking_error_pre":1.3,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Joint","aum":2169477,"cash":16554,"opportunity":1,"tracking_preference":2,"tracking_error_pre":1.1,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":2087132,"cash":37030,"opportunity":0.03,"tracking_preference":3,"tracking_error_pre":1.3,"tracking_error_post":1.3},{"status":"Re-Analyze","authority_label":"Sole","aum":2050750,"cash":22925,"opportunity":0.13,"tracking_preference":3,"tracking_error_pre":0.7,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":691880,"cash":5219,"opportunity":1.51,"tracking_preference":1,"tracking_error_pre":0.6,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":0,"cash":0,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":906218,"cash":5410,"opportunity":1.06,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":1721,"cash":1721,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":40754,"cash":547,"opportunity":0.02,"tracking_preference":1,"tracking_error_pre":0.2,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":4969,"cash":62,"opportunity":0.03,"tracking_preference":1,"tracking_error_pre":0.3,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":304992,"cash":14237,"opportunity":1.02,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":6441,"cash":6441,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":542415,"cash":9067,"opportunity":0.89,"tracking_preference":2,"tracking_error_pre":3.4,"tracking_error_post":3.2},{"status":"Re-Analyze","authority_label":"Sole","aum":588278,"cash":10427,"opportunity":0.66,"tracking_preference":3,"tracking_error_pre":3.2,"tracking_error_post":2.8},{"status":"Re-Analyze","authority_label":"Sole","aum":1967332,"cash":37873,"opportunity":1.05,"tracking_preference":4,"tracking_error_pre":3.8,"tracking_error_post":3.6},{"status":"Re-Analyze","authority_label":"Sole","aum":95275,"cash":95275,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":871194,"cash":80857,"opportunity":0.01,"tracking_preference":3,"tracking_error_pre":0.3,"tracking_error_post":0.2}]';

