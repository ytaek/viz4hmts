import { Component, OnInit } from '@angular/core';
import { Http } from '@angular/http';
import * as d3 from 'd3';
import { BuiltinType } from '@angular/compiler';

@Component({
  selector: 'app-phase2',
  templateUrl: './phase2.component.html',
  styleUrls: ['./phase2.component.scss'],
})
export class Phase2Component implements OnInit {
  maxWidth = 1200;
  maxHeight = 80;
  margin = { top: 0, right: 0, bottom: 0, left: 0 };
  width = this.maxWidth - this.margin.left - this.margin.right;
  height = this.maxHeight - this.margin.top - this.margin.bottom;
  previousSelections: any;
  lineBrushList = [];
  lineBrush;
  lineSelectionList = [];

  public focusX: any;
  public contextX: any;
  public channelCount: Number;
  public dataLength: Number;

  constructor(private http: Http) {
    let dataCsv = "./assets/data/eeg.5x.150s.csv"; 
    d3.csv(dataCsv, function (d) {
      d.date = +d.date; // str to int
      d.price = +d.price;
      return d; 
    }).then((data) => this.initDraw(data));
  }

  public initDraw(data: Array<any>) {
    let __this = this;

    let margin = this.margin;
    let width = this.width;
    let height = this.height;

    let lineBrushList = [];
    let searchResultList = [];

    let x = d3.scaleLinear().range([0, this.width]);
    let y = d3.scaleLinear().range([this.height, 0]);
    let line = d3.line()
      .x(function (d) { return x(d.date); })
      .y(function (d) { return y(d.price); });
    // Nest data by symbol.
    var symbols = d3.nest()
      .key(function (d) { return d.symbol; })
      .entries(data);
    // Compute the maximum price per symbol, needed for the y-domain.
    symbols.forEach(function (s) {
      s.maxPrice = d3.max(s.values, function (d) { return d.price; });
      s.minPrice = d3.min(s.values, function (d) { return d.price; });
      searchResultList.push(null);
      this.lineSelectionList.push(null);
    }, this);
    
    // Compute the minimum and maximum date across symbols.
    // We assume values are sorted by date.
    x.domain([
      d3.min(symbols, function (s) { return s.values[0].date; }),
      d3.max(symbols, function (s) { return s.values[s.values.length - 1].date; })
    ]);
  
    this.channelCount = symbols.length;
    this.dataLength = symbols[0].values.length;
    this.contextX = x;

    ////////////////////////////////////////
    // DRAW time series lines
    // Add an SVG element for each symbol, with the desired dimensions and margin.
    var svg = d3.select("#lines").selectAll("svg")
      .data(symbols)
      .enter()
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("class", "lineBox")
      .attr("width", width)
      .attr("height", height)
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      ;
    
    // Add the line path elements. Note: the y-domain is set per element.
    svg.append("path")
      .attr("class", "line");

    // Add a small label for the symbol name.
    svg.append("text")
      .attr("x", width - 6)
      .attr("y", height - 6)
      .style("text-anchor", "end")
      .text(function (d) { return d.key; });

    // rank div
    d3.select("#ranks")
      .selectAll("div")
      .data(symbols)
      .enter()
      .append("div")
      .attr("valign", "center")
      .attr("style", "height:" + (height + margin.top + margin.bottom) + "px;")
      // .attr("aaa", "bb")
      .attr("id", function (d, i) { return "rank" + i; });

    ////////////////////////////////////////
    // DRAW line brushes
    let lineBrush = d3.brushX().on("end", function(d, i) {
      let id = d3.select(this).attr("id");
      let chIndex = id.substring("lineBrushes".length, id.length);
      return __this.drawLineBrushButtons(__this, d3.event.selection, chIndex);
    });

    this.lineBrush = lineBrush;
    // this.lineBrush = lineBrush;
    var gBrushes = svg.append('g');
    gBrushes.attr("class", "lineBrush")
      .attr("id", (d, i) => "lineBrushes" + i)
      .call(lineBrush)
    ;
    svg.append("g").attr("id", (d, i) => ("lineBrushButtonArea" + i)).attr("visibility", "hidden");

    ////////////////////////////////////////
    // DRAW focus area
    var marginb = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    widthb = this.maxWidth - marginb.left - marginb.right,
    heightb = 50 - marginb.top - marginb.bottom;

    var svg = d3.select("#focus").append("svg")
      .attr("width", widthb + marginb.left + marginb.right)
      .attr("height", heightb + marginb.top + marginb.bottom)
      .append("g")
      .attr("transform", "translate(" + marginb.left + "," + marginb.top + ")");

    svg.append("rect")
      .attr("class", "grid-background")
      .attr("width", widthb)
      .attr("height", heightb);


    svg.append("g")
      .attr("id", "focusXAxis")
      .call(d3.axisBottom(x).tickFormat(d3.format("")))
      .selectAll("text")	
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");

    ////////////////////////////////////////
    // DRAW focus brush
    d3.select("#focus").select("svg").append("g").attr("id", "contextTimePoints");

    let focusBrush = d3.brushX()
      // .extent([[0, 0], [width, height2]])
      .on("end", () => this.focusBrushed(__this));

    svg.append('g')
      .attr("id", "focusArea")
      .attr("class", "focusBrush")
      .call(focusBrush);

    ////////////////////////////////////////
    // DRAW context area
    let contextHeight = height;
    let contextSvg = d3.select("#context").append("svg")
      .attr("width", widthb + marginb.left + marginb.right)
      .attr("height", contextHeight)
      .append("g")
      .attr("transform", "translate(" + marginb.left + "," + marginb.top + ")");

    contextSvg.append("rect")
      .attr("class", "grid-background")
      .attr("width", widthb)
      .attr("height", contextHeight);

    contextSvg.append("g")
      .call(d3.axisBottom(x).tickFormat(d3.format("")))
      .selectAll("text")	
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");

    // add time points g
    d3.select("#focusAndContext").select("svg").append("g").attr("id", "timePoints");
    d3.select("#focusAndContext").select("svg").append("g").attr("id", "userSelectedArea");

    var contextBrush = d3.brushX()
      .extent([[0, 0], [width, contextHeight]])
      .on("end", () => this.contextBrushed(__this));

    contextSvg.append('g')
      .attr("class", "brush")
      .call(contextBrush)
      // .call(contextBrush.move, x.range());
      .call(contextBrush.move, [150, 1200]);
  }
  


  public contextBrushed(__this: any): void {
    let width = __this.width;
    let height = __this.height;
    let fx = d3.scaleLinear().range([0, width]);
    let fy = d3.scaleLinear().range([height, 0]);
    let svgs = d3.select("#lines").selectAll("svg");
    __this.focusX = fx;

    let dataLength = __this.dataLength;
    let start = this.contextX.invert(d3.event.selection[0]);
    let end = this.contextX.invert(d3.event.selection[1]);
    fx.domain([start, end])
    console.log(d3.event.selection, start, end);

    // REDRAW CONTEXT
    let cline = d3.line()
      .x(function (d) { return fx(d.date); })
      .y(function (d) { return fy(d.price); });

    svgs.each(function () {
      d3.select(this).select("path")
        .attr("class", "line")
        .attr("d", function (d) {
          let sliceRanger = d3.scaleLinear().range([0, dataLength]).domain([0, d3.max(d.values, function (d) { return d.date; })]);
          let sliced = d.values.slice(sliceRanger(start), sliceRanger(end));
          fy.domain([d3.min(sliced, function (d) { return d.price; }), d3.max(sliced, function (d) { return d.price; })]);
          return cline(d.values); })
        ;
    });

    // REDRAW FOCUS AXIS
    d3.select("#focusXAxis")
      .call(d3.axisBottom(fx).tickFormat(d3.format("")).ticks(30).tickSize(6, 0))
    ;

    // REDRAW Line BRUSH
    d3.selectAll(".lineBrush")
      .each(function (brushObject, i) {
        if (__this.lineSelectionList[i] !== null) {
          d3.select(this).call(__this.lineBrush.move, 
            __this.lineSelectionList[i].map(d => __this.focusX(d)));
        }
      })
    ;

    // IF SearchedPattern exists.
    if (__this.previousSelection !== undefined) {

      // REDRAW SELECTIONS
      __this.drawSearchedPatterns();

      // Move selections
      d3.select("#userSelectionArea").select(".selection")
        .attr("x", fx(__this.previousSelection[0]))
        .attr("width", fx(__this.previousSelection[1]) - fx(__this.previousSelection[0]))
      ;
    }
  }


  public focusBrushed(__this: any) {
  
    console.log(d3.event.selection);

  }

  public drawLineBrushButtons(__this: any, selection: any, i: any) {
    let lineBrushButtonArea = d3.select("#lineBrushButtonArea" + (i));
    if (lineBrushButtonArea.select(".findButton").empty()) {
      lineBrushButtonArea.append("text").attr("class", "findButton");
      lineBrushButtonArea.append("text").attr("class", "verticalSpan");
    }
    
    let butX = d3.event.selection[1]- 7;
    let butY = __this.height - 5

    lineBrushButtonArea.select(".findButton")
      .style("text-anchor", "end")
      .attr("transform", "rotate(26 " + (butX) + "," +  butY + ")")
      .attr("x", butX)
      .attr("y", butY)
      .text("⚲")
      .on("click", () => __this.findHorizontal());
      ;

    lineBrushButtonArea.select(".verticalSpan")
      .style("text-anchor", "end")
      .attr("x", d3.event.selection[1]-10)
      .attr("y", __this.height - 8)
      .text("↕")
      .on("click", () => __this.verticalSpan(__this, i, selection));
      ;

    let brush = d3.select("#lineBrushes" + i).select(".selection");
    brush.on("mouseover", () => lineBrushButtonArea.attr("visibility", ""));
    brush.on("mouseleave", () => lineBrushButtonArea.attr("visibility", "hidden"));
    lineBrushButtonArea.on("mouseover", () => lineBrushButtonArea.attr("visibility", ""));

    __this.lineSelectionList[i] = selection.map(d => __this.focusX.invert(d));
  }

  // public overLineBrush(__this: any, i: Number) {
  //   console.log("lineBrushed", d3.event.selection);

  //   let lineBrushButtonArea = d3.select("#lineBrushButtonArea" + (i));
  //   if (lineBrushButtonArea.select(".findButton").empty()) {
  //     lineBrushButtonArea.append("text").attr("class", "findButton");
  //     lineBrushButtonArea.append("text").attr("class", "verticalSpan");
  //   }
    
  //   let butX = d3.event.selection[1]- 7;
  //   let butY = __this.height - 5

  //   lineBrushButtonArea.select(".findButton")
  //     .style("text-anchor", "end")
  //     .attr("transform", "rotate(26 " + (butX) + "," +  butY + ")")
  //     .attr("x", butX)
  //     .attr("y", butY)
  //     .text("⚲")
  //     .on("click", () => __this.findHorizontal());
  //     ;

  //   let selection = d3.event.selection;
  //   lineBrushButtonArea.select(".verticalSpan")
  //     .style("text-anchor", "end")
  //     .attr("x", d3.event.selection[1]-10)
  //     .attr("y", __this.height - 8)
  //     .text("↕")
  //     .on("click", () => __this.verticalSpan(__this, i, selection));
  //     ;
    
  // }

  public verticalSpan(__this:any, chIndex: Number, selection: any) {
    d3.selectAll(".lineBrush").call(this.lineBrush.move, selection);

    selection = selection.map(d => __this.focusX.invert(d));
    for (let i; i<__this.channelCount; i++)
      __this.lineSelectionList[i] = selection;
  }

  public findHorizontal() {

  }
    
  ngOnInit() {
  }

}
