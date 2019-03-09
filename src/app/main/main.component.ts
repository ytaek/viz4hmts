import { Component, OnDestroy, OnInit, Injectable, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/of';
import { _ } from 'underscore';
import { MatSliderModule } from '@angular/material/slider';
import { DTW } from 'dtw';
//import { exists } from 'fs';
declare var require: any

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})

@Injectable()
export class MainComponent implements OnInit, OnDestroy {
  title = 'app';
  maxWidth = 1200;
  margin = { top: 0, right: 0, bottom: 0, left: 0 };
  width = this.maxWidth - this.margin.left - this.margin.right;
  height = 80 - this.margin.top - this.margin.bottom;
  showListSizeAtRightPane = 8;
  previousSelection;
  dataRowCount = 0;
  verticalPatternSets: any;
  dataLength = 0;
  focusStartIndex = 0;
  focusEndIndex = 0;
  userSelectedAreaStartIndex = 0;
  userSelectedAreaEndIndex = 0;
  timeUnit = 0.02;
  public rankingMethod = "pearson";
  public w2Value = 2;
  public rankCount = 50;
  public maxRankCount = 50;
  public timeRankResult = [];
  public x: any;
  public focusX: any;
  private readonly _internalSubscription = new Subscription();

  constructor(private http: Http) {
    let dataCsv = "./assets/data/eeg.5x.150s.csv"; 
    let test = 0;

    if (test === 1) {
      d3.csv("./assets/data/diseaseRelatedStocks.csv", function (d) {
        let parseDate = d3.timeParse("%m-%d-%Y");
        // d.date += 1;
        d.price = +d.price;
        d.date = parseDate(d.date);
        return d; 
      }).then((data) => this.init(data, this.width, this.height));
    } else {
      d3.csv(dataCsv, function (d) {
        // let parseDate = d3.timeParse("%b %Y");
        // let parseDate = d3.timeParse("%m-%d-%Y");
        // d.date += 1;
        d.date = +d.date;
        d.price = +d.price;
        // d.date = parseDate(d.date);
        return d; 
      }).then((data) => this.init(data, this.width, this.height));
    }
  }

  private type(d): any {
    let parseDate = d3.timeParse("%b %Y");
    d.price = +d.price;
    d.date = parseDate(d.date);

    return d;
  }

  public w2Change(value: Number): any {
    console.log("w2 changed => ", value);
    let __this = this;
    this.brushed(__this);
  }

  public rankCountChange(value: Number): any {
    console.log("w2 changed => ", value);
    let __this = this;
    this.brushed(__this);
  }

  ngOnInit() {

  }

  ngOnDestroy() {

  }


  public init(data: Array<any>, width: number, height: number) {
    console.log(data);
    let margin = this.margin;
    let maxWidth = this.maxWidth;

    let lineBrushList = [];
    let searchResultList = [];

    this.x = d3.scaleLinear().range([0, width]);
    let x = this.x;
    let y = d3.scaleLinear().range([height, 0]);

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
      // s.minPrice = d3.min(s.values, function (d) { return d.price; });
      s.minPrice = d3.min(s.values, function (d) { return d.price; });;
      searchResultList.push(null);
    });
    
    this.dataRowCount = symbols.length;
    this.dataLength = symbols[0].values.length;
    this.focusEndIndex = this.dataLength;

    // Compute the minimum and maximum date across symbols.
    // We assume values are sorted by date.
    x.domain([
      d3.min(symbols, function (s) { return s.values[0].date; }),
      d3.max(symbols, function (s) { return s.values[s.values.length - 1].date; })
    ]);
    
    console.log(symbols[0].values);
    console.log(d3.max(symbols[0].values, function (d) { return d.date; }))
    console.log(d3.min(symbols[0].values, function (d) { return d.date; }))
    console.log(x(124), x(1), x.invert(0.5), x.invert(500))


    // Add an SVG element for each symbol, with the desired dimensions and margin.
    var svg = d3.select("#lines").selectAll("svg")
      .data(symbols)
      .enter().append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      // .attr("width", width)
      // .attr("height", height)
      .append("g")
      .attr("class", "lineBox")
      .attr("width", width)
      .attr("height", height)
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      ;
    

    // Add the line path elements. Note: the y-domain is set per element.
    svg.append("path")
      .attr("class", "line")
      // .attr("width", width + margin.left + margin.right)
      // .attr("height", height + margin.top + margin.bottom)
      // .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      // .attr("d", function (d) { y.domain([d.minPrice, d.maxPrice]); return line(d.values); })
      // .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      ;

    // Add a small label for the symbol name.
    svg.append("text")
      .attr("x", width - 6)
      .attr("y", height - 6)
      .style("text-anchor", "end")
      .text(function (d) { return d.key; });

    var gBrushes = svg.append('g');
    gBrushes.attr("class", "lineBrush")
      .call(d3.brushX())
      .attr("id", function (d, i) {
        return "lineBrushes" + i;
      });
    
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
    
    var marginb = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    widthb = maxWidth - marginb.left - marginb.right,
    heightb = 50 - marginb.top - marginb.bottom;

    var svg = d3.select("#selects").append("svg")
      .attr("width", widthb + marginb.left + marginb.right)
      .attr("height", heightb + marginb.top + marginb.bottom)
      .append("g")
      .attr("transform", "translate(" + marginb.left + "," + marginb.top + ")");

    svg.append("rect")
      .attr("class", "grid-background")
      .attr("width", widthb)
      .attr("height", heightb);

    svg.append("g")
      .attr("id", "selectsXAxis")
      // .call(d3.axisBottom(x))
      .call(d3.axisBottom(x).tickFormat(d3.format("")))
      .selectAll("text")	
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");

    d3.select("#selects").select("svg").append("g").attr("id", "contextTimePoints");

    let __this = this;
    var brush = d3.brushX()
      // .extent([[0, 0], [width, height2]])
      .on("end", () => this.brushed(__this));

    var gBrush = svg.append('g')
      .attr("id", "userSelectionArea")
      .attr("class", "userSelectionBrush")
      .call(brush);

    var fgHeight = height;
    // focusAndContext
    var fcSvg = d3.select("#focusAndContext").append("svg")
      .attr("width", widthb + marginb.left + marginb.right)
      .attr("height", fgHeight)
      .append("g")
      .attr("transform", "translate(" + marginb.left + "," + marginb.top + ")");

    fcSvg.append("rect")
      .attr("class", "grid-background")
      .attr("width", widthb)
      .attr("height", fgHeight);

    fcSvg.append("g")
      // .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%m/%d/%y")).ticks(20).tickSize(6, 0))
      // .call(d3.axisBottom(x).tickFormat(d3.format("")).ticks(30).tickSize(6, 0))
      .call(d3.axisBottom(x).tickFormat(d3.format("")))
      .selectAll("text")	
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");

    // add time points g
    d3.select("#focusAndContext").select("svg").append("g").attr("id", "timePoints");
    d3.select("#focusAndContext").select("svg").append("g").attr("id", "userSelectedArea");

    var fgBrush = d3.brushX()
      .extent([[0, 0], [width, fgHeight]])
      .on("end", () => this.fGbrushed(__this));
      
    var gFgBrush = fcSvg.append('g')
      .attr("class", "brush")
      .call(fgBrush)
      .call(fgBrush.move, x.range());
  }


   
  /////////////////////////////////
  // focus and context Brushing
  public fGbrushed(__this: any): void {
    let width = __this.width;
    let height = __this.height;
    // let fx = d3.scaleTime().range([0, __this.width]);
    let fx = d3.scaleLinear().range([0, width]);
    let fy = d3.scaleLinear().range([height, 0]);
    let svgs = d3.select("#lines").selectAll("svg");
    __this.focusX = fx;

    console.log(d3.event.selection, fx.domain(), "width = ", width);

    let dataLength = __this.dataLength;
    let start = __this.x.invert(d3.event.selection[0]);
    let end = __this.x.invert(d3.event.selection[1]);
    // let start = Math.round(d3.event.selection[0] / width * dataLength);
    // let end = Math.round(d3.event.selection[1] / width * dataLength) - 1;
    // console.log(d3.event.selection)
    // console.log("start, end", start, end)
    // console.log("x(start, end)", __this.x(start), __this.x(end))
    // console.log("x.invert(start, end)", __this.x.invert(d3.event.selection[0]), __this.x.invert(d3.event.selection[1]))
    fx.domain([start, end]);
    // fx.domain([__this.x.invert(start), __this.x.invert(end)]);
    // fx.domain([0, 1013]);
    // fx.domain(d3.event.selection)

    // REDRAW CONTEXT
    let fline = d3.line()
      .x(function (d) { return fx(d.date); })
      .y(function (d) { return fy(d.price); });

    svgs.each(function () {
      // d3.select(this).select("path").remove();
      d3.select(this).select("path")
        .attr("class", "line")
        .attr("d", function (d) {
          let sliceRanger = d3.scaleLinear().range([0, dataLength]).domain([0, d3.max(d.values, function (d) { return d.date; })]);
          let sliced = d.values.slice(sliceRanger(start), sliceRanger(end));
// console.log(d3.event.selection)
// console.log(sliceRanger(start), sliceRanger(end));
// console.log("st, end = ", start, end)
// console.log(d3.max(sliced, function (d) { return d.price; }), d3.min(sliced, function (d) { return d.price; }))          
          fy.domain([d3.min(sliced, function (d) { return d.price; }), d3.max(sliced, function (d) { return d.price; })]);
          // fy.domain([d.minPrice, d.maxPrice]);
          // fy.domain([-0.004, 0]);
          return fline(d.values); })
        ;
        // .attr("transform", "translate(10, 0)")
    });

    // REDRAW SELECTION AXIS
    d3.select("#selectsXAxis")
      .call(d3.axisBottom(fx).tickFormat(d3.format("")).ticks(30).tickSize(6, 0))
    ;

    // IF SearchedPattern exists.
    if (__this.previousSelection !== undefined) {

      // REDRAW SELECTIONS
      __this.drawSearchedPatterns();

      // Move selections
      // console.log(__this.previousSelection, __this.previousSelection.map(d=>fx(d)));
      d3.select("#userSelectionArea").select(".selection")
        .attr("x", fx(__this.previousSelection[0]))
        .attr("width", fx(__this.previousSelection[1]) - fx(__this.previousSelection[0]))
      ;
      d3.selectAll(".lineBrush")
        .each(function (brushObject, i) {
          d3.select(this).call(d3.brushX().move, __this.previousSelection.map(d=>fx(d)));
        });
    }
  }




  
  public drawSearchedPatterns() {
    let verticalPatternSets = this.verticalPatternSets;
    let fx = this.focusX;

    for (let i = 0; i < this.dataRowCount; i ++) {
      let rankSelection = d3.select("#lineBrushes" + i).selectAll(".rankSelection").data(verticalPatternSets[i]);
      rankSelection
        .enter()
        .append("rect")
        .merge(rankSelection)
        .attr("class", "rankSelection")
        .attr("fill", "pink")
        .attr("fill-opacity", "0.05")
        .attr("stroke", "pink")
        .attr("x", function(d) {
          d.rankX = fx(d.startIndex);
          return d.rankX;
        })
        .attr("y", 0)
        .attr("width", function(d) {
          d.rankWidth = fx(d.endIndex) - fx(d.startIndex);
          return d.rankWidth;
        })
        .attr("height", this.height);
  
      rankSelection.exit().remove();
    }

    let uniqScreenContextTimePoints = _.uniq(verticalPatternSets.map(d => fx(d[0].t)));
    // console.log(uniqScreenContextTimePoints);
    // draw search result on context axis
    let contextTimePoints = d3.select("#contextTimePoints").selectAll("line").data(uniqScreenContextTimePoints);
    contextTimePoints
      .enter()
      .append("line")
      .merge(contextTimePoints)
      .attr("x1", (d) => (d))
      .attr("x2", (d) => (d))
      .attr("y1", this.height)
      .attr("y2", 0)
      .attr("stroke-width", 1)
      .attr("stroke", "red")
    ;
    contextTimePoints.exit().remove();
  }

  private round(value: number, unit: number) {
    let residual = value % unit;
    if (residual > unit / 2) return value - residual + unit;
    else return value - residual;;
  }

  public brushed(__this: any): void {
    let searchResultList = [];
    let dataLength = 0;
    let start = 0;
    let end = 0;

    let width = this.width;
    let height = this.height;

    let fx = __this.focusX;
    let x = __this.x;

    // let width = 940;
    console.log(d3.event);
    let screenSelection;
    if (d3.event == null) screenSelection = __this.previousSelection;
    else screenSelection = d3.event.selection;

    console.log("sel = ", screenSelection);
    __this.calDTW(null, null, null);

    start = Math.round(fx.invert(screenSelection[0]));
    end = Math.round(fx.invert(screenSelection[1]));
    __this.previousSelection = [start, end];
console.log(screenSelection, start, end)
    let startTimeValue = this.round(screenSelection[0], this.timeUnit);
    let endTimeValue = this.round(screenSelection[1], this.timeUnit);
    let startIndex = parseInt( (startTimeValue / this.timeUnit) + "");
    let endIndex = parseInt( (endTimeValue / this.timeUnit) + "");

    ///////////////////////////////////
    // for all line charts
    d3.selectAll(".lineBrush")
      // .filter((d, i) => (i === 0))
      .each(function (brushObject, i) {
        d3.select(this).call(d3.brushX().move, screenSelection);
        
        let fullResultList = __this.calDTW(d3.select(this).data()[0].values.map(d => d.price), startIndex, endIndex, 10);
        let resultList = fullResultList
          .sort((a, b) => (a.distance - b.distance))
          .filter(function(d, i) {
            d.yDistRanking = i;
            return i < __this.showListSizeAtRightPane;
          }).map(function (d, i) {
            d["rankX"] = fx(d.startIndex);
            d["rankWidth"] = fx(d.endIndex - d.startIndex);
            return d;
        });
// /*
        let rankDiv = d3.select("#rank" + i).selectAll(".rankDiv").data(resultList);
        // console.log(rankDiv);
        rankDiv
          .enter()
          .append("div")
          .append("u")
          .attr("class", "rankDiv")
          .merge(rankDiv)
          .text(function (d, i) {
            return (i+1) + ":" + Math.round(d.distance) + " / " + d.startIndex + "~" + d.endIndex;
          })
          .on("click", function (d) {
            drawRankSelection([d], i);
          });
        // ALL button
        
        d3.select("#rank" + i).selectAll(".allRankDiv").remove();
        d3.select("#rank" + i).append("div").append("u")
          .attr("class", "allRankDiv")
          .text("[ALL]")
          .on("click", d => drawRankSelection(resultList, i));

        function drawRankSelection(list, i) {
          let rankSelection = d3.select("#lineBrushes" + i).selectAll(".rankSelection").data(list)

          rankSelection
            .enter()
            .append("rect")
            .merge(rankSelection)
            .attr("class", "rankSelection")
            .attr("fill", "blue")
            .attr("fill-opacity", "0.3")
            .attr("stroke", "blue")
            .attr("x", (d) => (d.rankX))
            .attr("y", 0)
            .attr("width", (d) => (d.rankWidth))
            .attr("height", height);

          rankSelection.exit().remove();
        }
// */
        searchResultList.push(fullResultList.sort((a, b) => (a.startIndex - b.startIndex)));
      }
    );

    
    
    // calculate matching
    let verticalPatternSets = getVerticalPatternSet(searchResultList, this.rankCount, this.w2Value);
    __this.verticalPatternSets = verticalPatternSets;

    console.log("verticalPatternSets", verticalPatternSets);
    
    // draw search results, user selections in global axis
    let uniqScreenTimePoints = _.uniq(verticalPatternSets.map(d => x(d[0].t)));
    console.log(uniqScreenTimePoints);
    let drawedPoints = d3.select("#timePoints").selectAll("line").data(uniqScreenTimePoints);    
    drawedPoints
      .enter()
      .append("line")
      .merge(drawedPoints)
      .attr("x1", (d) => (d))
      .attr("x2", (d) => (d))
      .attr("y1", this.height)
      .attr("y2", 0)
      .attr("stroke-width", 1)
      .attr("stroke", "red")
    ;
    drawedPoints.exit().remove();
    
    // draw user selections
    let userSelectedArea = d3.select("#userSelectedArea").selectAll("rect").data([__this.previousSelection.map(d => x(d))]);
    userSelectedArea
      .enter()
      .append("rect")
      .merge(userSelectedArea)
      .attr("width", (d) => (d[1] - d[0]))
      .attr("height", this.height)
      .attr("x", (d) => d[0])
      .attr("y", 0)
      .attr("fill", "grey")
      .attr("fill-opacity", "0.5")
    ;
    userSelectedArea.exit().remove();
    

    // draw pattern selections
    __this.drawSearchedPatterns();
    
    function getVerticalPatternSet(allVariateDistanceList, rankCount, w2) {
      let timeSlotLength = allVariateDistanceList[0].length;

      console.log("searchResultList", allVariateDistanceList);
      let variateDistancesByTimeSlot = allVariateDistanceList.map(function(list, variateIndex) {
        let totalDistanceByTimeSlot = [];

        for (let t = 0; t < list.length; t++) {
          totalDistanceByTimeSlot.push(list.map(function(d, i) {
              let xDist = w2 * (t - d.startIndex);
              xDist = xDist * xDist;
              // if (yDist < 0) yDist *= -1;            
              let maxValue = 100000000;

              // let xDist = Math.log(d.distance);
              // yDist = 0;
              let yDist = d.distance;
              let distance = Math.min(maxValue, yDist) + Math.min(maxValue, xDist);

              return {distance:Math.floor(distance), yDist:Math.floor(yDist), xDist:Math.floor(xDist)
                , t:t, startIndex:d.startIndex, endIndex:d.endIndex
                , yDistRanking:d.yDistRanking
                , yDistance:d.distance, xDistance:(t-d.startIndex)};
            }).sort((a, b) => a.distance - b.distance)
            .filter(function(d, i, arr) {
              if (i > 0) arr[i].diff = arr[i].distance - arr[i-1].distance;
              else arr[i].diff = 0;
              return i < rankCount;
            })
          );
        }
        return totalDistanceByTimeSlot;
      });
      console.log("variateDistancesByTimeSlot", variateDistancesByTimeSlot);
      console.log("calculated weight2 = ", w2);
      let selectionsByTime = [];
      for (let t = 0; t < timeSlotLength; t++) {
        let timeList = variateDistancesByTimeSlot.map((d) => d[t]);
        let cnt = rankCount - 1;
        let selectionByRank = [];
        // init
        selectionByRank.push(timeList.map(function(d, i, arr) {
          let res = d.splice(0, 1)[0];
          if (res === undefined) console.log("??", d, i, arr);
          return res;
          // return d.splice(0, 1)[0];
        }));
        // console.log("before", selectionByRank[0]);
        for (let i = 0; i < Math.min(cnt, timeSlotLength); i++) {
          // get min
          let itemAndIndex = timeList.map((d) => (d[0])).reduce(function(prev, cur, i, arr) {
            if (cur == undefined) console.log(prev, cur, i, arr);
            return prev[0] > cur.diff ? [cur.diff, i] : prev;
          }, [Number.MAX_VALUE, -1]);
          
          // copy last values as deep copy
          selectionByRank.push(selectionByRank[i].map(d => d));

          // change as min
          let minVariateIndex = itemAndIndex[1];
          selectionByRank[i + 1][minVariateIndex] = timeList[minVariateIndex].splice(0, 1)[0];
          // console.log("after", selectionByRank);
        }
        selectionsByTime.push(selectionByRank);
      }

      console.log("selectionsByTime", selectionsByTime);
      
      let flatSelection = [];
      selectionsByTime.forEach(function(elem) {
        flatSelection = flatSelection.concat(elem);
      });

      return flatSelection.sort(function(a, b) {
         return a.reduce((prev, cur) => prev + cur.distance, 0) - b.reduce((prev, cur) => prev + cur.distance, 0);
      }).filter((d, i) => i < rankCount);
    }
  }



  // public getVerticalPatternSet(distanceValuesList, range, maxRange, this.rankCount, this.w2Value) {
  //   // 1. get list
  //   // 2. calculate value scoring (0 - 100 by similarity)
  //   // 3. time slot iteration
  //   //  - in 500ms(range parameter), +500ms(maxRange param)
  //   //  - similarity: 100, distance: 100
  //   //  - if similarity is 0 or distance > 1000, skip.

  //   // time slot 하나당 rank 5개 일단 모으고, 
  //   // t를 10개 보여주는걸로 할까?  어느 정도 이상 되면.
    
    

  // }



  ///////////////////
  // DTW
  ///////////////////
  public calDTW(list, start, end, stride = 1) {
    if (list === null) return;
console.log(list, start, end)
    let dataPoints = [];
    dataPoints = list.filter(function (d, i) {
      return i >= start && i <= end;
    });

    var DTW = require('dtw');
    var dtw = new DTW();

    let comparisonWidth = dataPoints.length + 0;
    let iterationPoints = list.map((d, i) => i)
      .filter(index => index % stride == 0)
      .filter(index => index < list.length - comparisonWidth)
      .filter(index => !(index > start - comparisonWidth && index <= end + comparisonWidth));

    let resultList = iterationPoints.map(function (i) {
      let compTargetPoints = list.slice(i, i + comparisonWidth);
      
      // z normalization: y-offset shifting
      let znormedCompTargetPoints = zNormalize(compTargetPoints);
      let znormedDataPoints = zNormalize(dataPoints);
console.log(dataPoints, compTargetPoints);
      let distance = dtw.compute(dataPoints, compTargetPoints);
      var path = dtw.path();

      return { distance: distance, startIndex: i, endIndex: i + comparisonWidth, path: path };
    });
    // }).sort((a, b) => (a.distance - b.distance));

    // return resultList.filter((d, i) => (i < listSize)).filter(d => d.distance != 0);
    return resultList;

    function zNormalize(arr) {
      let mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.map(d => d - mean);
    }
  }
}

