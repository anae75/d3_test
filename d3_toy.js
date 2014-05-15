var debugvar;

function str2number(str)
{
  str = str.replace(/,/g, "");
  match = str.match(/[\d\.]+/);
  return match ? parseFloat(match[0]) : 0.0;
}

function DataSet(opts)
{
  this.data_rows = [];
  if(opts.json) {
    this.from_json(opts.json);
  }
}

DataSet.prototype.length = function() 
{
  return this.data_rows.length;
}

DataSet.prototype.load_data = function()
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
            cell_data.opportunity = str2number(cell.text());
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
  return color;
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

//------------------------------------------------------------

function pie_chart(data, path, color) {
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
      .attr("fill", function(d,i){console.log(d); return color(d.data.name);})
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
//------------------------------------------------------------
function init()
{
  //jQuery("head").append('<link rel="stylesheet" href="//code.jquery.com/ui/1.10.4/themes/smoothness/jquery-ui.css">');
  //include("http://d3js.org/d3.v3.min.js");
  dataset = new DataSet({json: test_data});

  //pct_data = JSON.parse('[{"name":"Sole","value":0.855},{"name":"Joint","value":0.135},{"name":"What-If","value":0.01}]');

  var colorspec = new ColorSpec();
  colorspec.set("Error", "red");
  colorspec.set("Re-Analyze", "#6baed6");
  colorspec.set("", "green");
  var color = function(key) { return colorspec.get(key); } 
  pie_chart(count_pct(dataset, "status"), "#status ", color);

  //pie_chart(count_pct(dataset, "tracking_preference").sort(function(a,b) { return a.name - b.name; }), "#tracking_preference ");
  bar_chart(count_pct(dataset, "tracking_preference").sort(function(a,b) { return a.name - b.name; }), [{name: "value", color: "steelblue"}], "#tracking_preference ");

  //bar_chart(count_pct(dataset, "authority_label"), [{name: "value", color: "steelblue"}], "#authority_label ");
  var colorspec = new ColorSpec();
  var color = function(key) { return colorspec.get(key); } 
  pie_chart(count_pct(dataset, "authority_label"), "#authority_label ", color);
}

jQuery(document).ready( function() { init(); } );

//------------------------------------------------------------
//- Test data below !!!! -------------------------------------

test_data= '[{"status":"Error","authority_label":"Sole","aum":1167121,"cash":434370,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"","authority_label":"Sole","aum":317747,"cash":3390,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"","authority_label":"Sole","aum":328165,"cash":3908,"opportunity":0.14,"tracking_preference":3,"tracking_error_pre":1.9,"tracking_error_post":1.8},{"status":"Error","authority_label":"Sole","aum":266213,"cash":190905,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"","authority_label":"Sole","aum":791391,"cash":10839,"opportunity":2.85,"tracking_preference":2,"tracking_error_pre":3,"tracking_error_post":0.7},{"status":"","authority_label":"Sole","aum":4927810,"cash":318273,"opportunity":0.34,"tracking_preference":3,"tracking_error_pre":2.1,"tracking_error_post":1.9},{"status":"","authority_label":"Sole","aum":5156591,"cash":48764,"opportunity":0.5,"tracking_preference":1,"tracking_error_pre":0.3,"tracking_error_post":0.2},{"status":"Error","authority_label":"Joint","aum":1115075,"cash":1115075,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":101936,"cash":1936,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":126079,"cash":26079,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":123774,"cash":15918,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"","authority_label":"Sole","aum":466323,"cash":8754,"opportunity":0.7,"tracking_preference":2,"tracking_error_pre":0.8,"tracking_error_post":0.2},{"status":"","authority_label":"Sole","aum":505674,"cash":4566,"opportunity":0.01,"tracking_preference":3,"tracking_error_pre":0.6,"tracking_error_post":0.6},{"status":"Re-Analyze","authority_label":"Sole","aum":1162893,"cash":13617,"opportunity":0.12,"tracking_preference":5,"tracking_error_pre":3.7,"tracking_error_post":3.7},{"status":"Error","authority_label":"Sole","aum":890201,"cash":69006,"opportunity":0,"tracking_preference":4,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"What-If","aum":895605,"cash":28597,"opportunity":0.88,"tracking_preference":4,"tracking_error_pre":4.4,"tracking_error_post":4.1},{"status":"Error","authority_label":"Joint","aum":152074,"cash":858,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Joint","aum":3289,"cash":3289,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":73171,"cash":1932,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2230368,"cash":50162,"opportunity":0.68,"tracking_preference":5,"tracking_error_pre":4.7,"tracking_error_post":3.6},{"status":"Re-Analyze","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":5.97,"tracking_preference":4,"tracking_error_pre":6.9,"tracking_error_post":2.9},{"status":"Error","authority_label":"Sole","aum":32940,"cash":24372,"opportunity":0,"tracking_preference":4,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":0,"tracking_preference":4,"tracking_error_pre":6.8,"tracking_error_post":6.8},{"status":"Re-Analyze","authority_label":"Sole","aum":111657,"cash":82649,"opportunity":0,"tracking_preference":4,"tracking_error_pre":6.8,"tracking_error_post":6.8},{"status":"Re-Analyze","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":0,"tracking_preference":4,"tracking_error_pre":6.8,"tracking_error_post":6.8},{"status":"Re-Analyze","authority_label":"Sole","aum":49413,"cash":36575,"opportunity":0,"tracking_preference":4,"tracking_error_pre":6.8,"tracking_error_post":6.8},{"status":"Re-Analyze","authority_label":"Sole","aum":358308,"cash":15389,"opportunity":1.29,"tracking_preference":2,"tracking_error_pre":1.3,"tracking_error_post":0.6},{"status":"Re-Analyze","authority_label":"Sole","aum":187497,"cash":187497,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":204540,"cash":105290,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":204515,"cash":204515,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":147560,"cash":147560,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2227,"cash":2227,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1018968,"cash":271048,"opportunity":0,"tracking_preference":4,"tracking_error_pre":3.1,"tracking_error_post":3.1},{"status":"Re-Analyze","authority_label":"Sole","aum":38305,"cash":38305,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":177,"cash":177,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":771638,"cash":10020,"opportunity":1.67,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":2284592,"cash":30460,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2922026,"cash":6702,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":442860,"cash":21740,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":209819,"cash":887,"opportunity":2.53,"tracking_preference":1,"tracking_error_pre":1.3,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Sole","aum":1083276,"cash":21043,"opportunity":1.98,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":625586,"cash":1088,"opportunity":0.76,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":1230946,"cash":7243,"opportunity":2.17,"tracking_preference":0,"tracking_error_pre":0.6,"tracking_error_post":0.2},{"status":"Error","authority_label":"Sole","aum":211661,"cash":5406,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":730415,"cash":68702,"opportunity":0.06,"tracking_preference":5,"tracking_error_pre":1.6,"tracking_error_post":1.3},{"status":"Re-Analyze","authority_label":"Sole","aum":30294,"cash":30294,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1341554,"cash":10671,"opportunity":1.09,"tracking_preference":2,"tracking_error_pre":2.6,"tracking_error_post":2.4},{"status":"Re-Analyze","authority_label":"Sole","aum":21178,"cash":21178,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":155926,"cash":9952,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0.1,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":170102,"cash":10513,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0.1,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Joint","aum":200981,"cash":200981,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":306151,"cash":34189,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2,"cash":2,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"","authority_label":"Sole","aum":1172223,"cash":11401,"opportunity":1.78,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Joint","aum":113156,"cash":8358,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":113156,"cash":8358,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":113156,"cash":8358,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":133,"cash":133,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":34680296,"cash":474168,"opportunity":1.63,"tracking_preference":1,"tracking_error_pre":1.1,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"Sole","aum":235748,"cash":1180,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":19277977,"cash":206941,"opportunity":0.97,"tracking_preference":1,"tracking_error_pre":0.9,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":12101096,"cash":367905,"opportunity":0,"tracking_preference":3,"tracking_error_pre":2.3,"tracking_error_post":2.3},{"status":"Re-Analyze","authority_label":"Sole","aum":11185637,"cash":112472,"opportunity":0,"tracking_preference":3,"tracking_error_pre":2.2,"tracking_error_post":2.2},{"status":"Re-Analyze","authority_label":"Joint","aum":149711,"cash":149711,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":90000,"cash":90000,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":14817983,"cash":204117,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":314086,"cash":3440,"opportunity":0.78,"tracking_preference":2,"tracking_error_pre":0.9,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":7302210,"cash":224781,"opportunity":0.81,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":63,"cash":63,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":339840,"cash":4353,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":4714169,"cash":125669,"opportunity":0.17,"tracking_preference":3,"tracking_error_pre":2.6,"tracking_error_post":2.6},{"status":"Re-Analyze","authority_label":"Joint","aum":532746,"cash":25145,"opportunity":0.3,"tracking_preference":3,"tracking_error_pre":2.3,"tracking_error_post":2},{"status":"Re-Analyze","authority_label":"Joint","aum":487387,"cash":4150,"opportunity":0.05,"tracking_preference":3,"tracking_error_pre":1.2,"tracking_error_post":1.1},{"status":"Re-Analyze","authority_label":"Joint","aum":5824691,"cash":55147,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":270949,"cash":3475,"opportunity":1.26,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":399207,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":244397,"cash":993,"opportunity":0.34,"tracking_preference":0,"tracking_error_pre":0.2,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":1099854,"cash":26912,"opportunity":0.75,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":9094,"cash":9094,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":42755,"cash":42755,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Joint","aum":165663,"cash":1072,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2289193,"cash":138683,"opportunity":1.1,"tracking_preference":2,"tracking_error_pre":1,"tracking_error_post":0.7},{"status":"Error","authority_label":"Sole","aum":579330,"cash":3377,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2292675,"cash":107851,"opportunity":0.01,"tracking_preference":3,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Error","authority_label":"Sole","aum":7636,"cash":7636,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":11272,"cash":1075,"opportunity":1.6,"tracking_preference":1,"tracking_error_pre":1.5,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":85306,"cash":1737,"opportunity":0,"tracking_preference":1,"tracking_error_pre":1,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"What-If","aum":10610,"cash":10610,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1003626,"cash":26740,"opportunity":1.33,"tracking_preference":1,"tracking_error_pre":7.5,"tracking_error_post":7.4},{"status":"Re-Analyze","authority_label":"Sole","aum":529512,"cash":41485,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":157,"cash":157,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1411100,"cash":5196,"opportunity":0.38,"tracking_preference":4,"tracking_error_pre":0.6,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":715831,"cash":38432,"opportunity":5.34,"tracking_preference":2,"tracking_error_pre":10.2,"tracking_error_post":0.2},{"status":"","authority_label":"Sole","aum":554554,"cash":554554,"opportunity":4.58,"tracking_preference":3,"tracking_error_pre":13.8,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":200,"cash":200,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":709619,"cash":709619,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":840468,"cash":0,"opportunity":0.15,"tracking_preference":1,"tracking_error_pre":2,"tracking_error_post":2},{"status":"Re-Analyze","authority_label":"Sole","aum":2913055,"cash":14001,"opportunity":1.33,"tracking_preference":1,"tracking_error_pre":0.9,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Sole","aum":332268,"cash":291227,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1574961,"cash":272,"opportunity":0.3,"tracking_preference":3,"tracking_error_pre":1.6,"tracking_error_post":1.1},{"status":"Re-Analyze","authority_label":"Sole","aum":1673548,"cash":46916,"opportunity":0.09,"tracking_preference":2,"tracking_error_pre":1.1,"tracking_error_post":1.2},{"status":"Re-Analyze","authority_label":"Sole","aum":390054,"cash":390054,"opportunity":0,"tracking_preference":6,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":620344,"cash":41134,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Error","authority_label":"Sole","aum":321,"cash":321,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1438167,"cash":7007,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":146600,"cash":5844,"opportunity":0.41,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":1449354,"cash":14277,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":77381,"cash":486,"opportunity":0.4,"tracking_preference":0,"tracking_error_pre":0.2,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":2735215,"cash":23506,"opportunity":0.48,"tracking_preference":4,"tracking_error_pre":0.7,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":386803,"cash":4262,"opportunity":0.02,"tracking_preference":4,"tracking_error_pre":0.3,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1798263,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":765368,"cash":10617,"opportunity":1.83,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Joint","aum":5,"cash":5,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":259327,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":2820,"cash":2820,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1627654,"cash":20109,"opportunity":0.5,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Joint","aum":985643,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":269,"cash":269,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":56002,"cash":56002,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":0,"cash":0,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1193,"cash":1193,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":13170,"cash":13170,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":112887,"cash":2283,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":420915,"cash":15947,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":1117,"cash":1117,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":227191,"cash":1207,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":3679503,"cash":36697,"opportunity":0,"tracking_preference":1,"tracking_error_pre":1.4,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":930558,"cash":13569,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1253946,"cash":11363,"opportunity":1.16,"tracking_preference":1,"tracking_error_pre":0.4,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":1055328,"cash":80999,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":363024,"cash":363024,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":552868,"cash":6143,"opportunity":1.1,"tracking_preference":3,"tracking_error_pre":4.7,"tracking_error_post":4.2},{"status":"Re-Analyze","authority_label":"Sole","aum":23882,"cash":23882,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":621736,"cash":5743,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":3824,"cash":3824,"opportunity":7.76,"tracking_preference":1,"tracking_error_pre":16.5,"tracking_error_post":6.2},{"status":"Re-Analyze","authority_label":"Sole","aum":226783,"cash":226783,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":777831,"cash":358,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":38323,"cash":38323,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":217,"cash":217,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":3446769,"cash":228553,"opportunity":1.93,"tracking_preference":1,"tracking_error_pre":1.6,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":13852,"cash":0,"opportunity":1.88,"tracking_preference":1,"tracking_error_pre":2,"tracking_error_post":1.8},{"status":"Re-Analyze","authority_label":"Sole","aum":500570,"cash":9070,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":205356,"cash":2715,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":668502,"cash":14181,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.7,"tracking_error_post":0.7},{"status":"Re-Analyze","authority_label":"Sole","aum":298300,"cash":7844,"opportunity":1.34,"tracking_preference":1,"tracking_error_pre":2.3,"tracking_error_post":2.3},{"status":"Re-Analyze","authority_label":"Sole","aum":967281,"cash":10032,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1012678,"cash":13747,"opportunity":0.22,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":1069030,"cash":2539,"opportunity":2.27,"tracking_preference":1,"tracking_error_pre":1,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":326989,"cash":8272,"opportunity":1.83,"tracking_preference":1,"tracking_error_pre":0.9,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":899663,"cash":473,"opportunity":1.89,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":176134,"cash":9829,"opportunity":0.31,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":1118472,"cash":11497,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":332661,"cash":52595,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":594291,"cash":11369,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0.8,"tracking_error_post":0.8},{"status":"Re-Analyze","authority_label":"Sole","aum":961575,"cash":5188,"opportunity":0.47,"tracking_preference":1,"tracking_error_pre":1,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"Sole","aum":5291520,"cash":18215,"opportunity":1.11,"tracking_preference":2,"tracking_error_pre":4,"tracking_error_post":4.2},{"status":"Re-Analyze","authority_label":"Sole","aum":583233,"cash":30659,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":326950,"cash":0,"opportunity":0.13,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":37,"cash":37,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":49140,"cash":49140,"opportunity":0,"tracking_preference":3,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1333664,"cash":790923,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":0,"cash":0,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":259040,"cash":242,"opportunity":0.01,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.5},{"status":"Re-Analyze","authority_label":"Sole","aum":1310494,"cash":60818,"opportunity":2.33,"tracking_preference":1,"tracking_error_pre":1.4,"tracking_error_post":1},{"status":"Re-Analyze","authority_label":"Sole","aum":1248090,"cash":18973,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1250264,"cash":1400,"opportunity":1.12,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":581198,"cash":208003,"opportunity":6.82,"tracking_preference":1,"tracking_error_pre":9.7,"tracking_error_post":1.4},{"status":"Re-Analyze","authority_label":"Sole","aum":1152295,"cash":2973,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":7911132,"cash":77319,"opportunity":0.26,"tracking_preference":4,"tracking_error_pre":0.9,"tracking_error_post":0.9},{"status":"Re-Analyze","authority_label":"Sole","aum":207410,"cash":15841,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":515764,"cash":2669,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":573156,"cash":601,"opportunity":2.39,"tracking_preference":1,"tracking_error_pre":5.2,"tracking_error_post":5.1},{"status":"Re-Analyze","authority_label":"Joint","aum":591217,"cash":591217,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":980503,"cash":110,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1368830,"cash":7280,"opportunity":2.8,"tracking_preference":2,"tracking_error_pre":3.2,"tracking_error_post":1.5},{"status":"Re-Analyze","authority_label":"Sole","aum":746521,"cash":24345,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":693963,"cash":8748,"opportunity":0.87,"tracking_preference":2,"tracking_error_pre":1.1,"tracking_error_post":0.6},{"status":"Re-Analyze","authority_label":"Sole","aum":125806,"cash":11598,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":6045709,"cash":64006,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":11236053,"cash":68781,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":18628,"cash":18628,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":1853984,"cash":20997,"opportunity":0,"tracking_preference":4,"tracking_error_pre":0.2,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":165534,"cash":42459,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":1172991,"cash":9657,"opportunity":1.18,"tracking_preference":2,"tracking_error_pre":1.3,"tracking_error_post":0.7},{"status":"","authority_label":"Joint","aum":2170772,"cash":16554,"opportunity":1,"tracking_preference":2,"tracking_error_pre":1.1,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":2089379,"cash":37030,"opportunity":0.03,"tracking_preference":3,"tracking_error_pre":1.3,"tracking_error_post":1.3},{"status":"Re-Analyze","authority_label":"Sole","aum":2052802,"cash":22925,"opportunity":0.13,"tracking_preference":3,"tracking_error_pre":0.7,"tracking_error_post":0.4},{"status":"Re-Analyze","authority_label":"Sole","aum":693494,"cash":5219,"opportunity":1.51,"tracking_preference":1,"tracking_error_pre":0.6,"tracking_error_post":0.1},{"status":"Re-Analyze","authority_label":"Sole","aum":0,"cash":0,"opportunity":0,"tracking_preference":5,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":907934,"cash":5410,"opportunity":1.06,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":1721,"cash":1721,"opportunity":0,"tracking_preference":0,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":40769,"cash":547,"opportunity":0.02,"tracking_preference":1,"tracking_error_pre":0.2,"tracking_error_post":0.2},{"status":"Re-Analyze","authority_label":"Sole","aum":4975,"cash":62,"opportunity":0.03,"tracking_preference":1,"tracking_error_pre":0.3,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":305478,"cash":14237,"opportunity":1.02,"tracking_preference":1,"tracking_error_pre":0.5,"tracking_error_post":0.3},{"status":"Re-Analyze","authority_label":"Sole","aum":6441,"cash":6441,"opportunity":0,"tracking_preference":1,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Sole","aum":542340,"cash":9067,"opportunity":0.89,"tracking_preference":2,"tracking_error_pre":3.4,"tracking_error_post":3.2},{"status":"Re-Analyze","authority_label":"Sole","aum":588031,"cash":10427,"opportunity":0.66,"tracking_preference":3,"tracking_error_pre":3.2,"tracking_error_post":2.8},{"status":"Re-Analyze","authority_label":"Sole","aum":1971872,"cash":37873,"opportunity":1.05,"tracking_preference":4,"tracking_error_pre":3.8,"tracking_error_post":3.6},{"status":"Re-Analyze","authority_label":"Sole","aum":95275,"cash":95275,"opportunity":0,"tracking_preference":2,"tracking_error_pre":0,"tracking_error_post":0},{"status":"Re-Analyze","authority_label":"Joint","aum":871968,"cash":80857,"opportunity":0.01,"tracking_preference":3,"tracking_error_pre":0.3,"tracking_error_post":0.2}]';

