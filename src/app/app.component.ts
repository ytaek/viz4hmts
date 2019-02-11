import { Component, OnDestroy, OnInit, Injectable, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/of';
import { MatSliderModule } from '@angular/material/slider';
import { DTW } from 'dtw';
import { exists } from 'fs';
declare var require: any

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

@Injectable()
export class AppComponent implements OnInit, OnDestroy {
  title = 'app';
  maxWidth = 1200;
  margin = { top: 0, right: 0, bottom: 0, left: 0 };
  width = this.maxWidth - this.margin.left - this.margin.right;
  height = 70 - this.margin.top - this.margin.bottom;
  showListSizeAtRightPane = 8;
  previousSelections;

  public w2Value = 2;
  public rankCount = 50;
  public maxRankCount = 50;
  public timeRankResult = [];
  public x: any;
  public focusX: any;
  private readonly _internalSubscription = new Subscription();

  constructor(private http: Http) {
    let dataCsv = "./assets/data/eeg.10.1000.csv";
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
    
    // Compute the minimum and maximum date across symbols.
    // We assume values are sorted by date.
    x.domain([
      d3.min(symbols, function (s) { return s.values[0].date; }),
      d3.max(symbols, function (s) { return s.values[s.values.length - 1].date; })
    ]);

    console.log(x(1000), x(600), x.invert(0.5), x.invert(500))


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

    let __this = this;
    var brush = d3.brushX()
      // .extent([[0, 0], [width, height2]])
      .on("end", () => this.brushed(__this));

    var gBrush = svg.append('g')
      .attr("class", "brush")
      .call(brush);

    var fgHeight = height;
    // focusAndContext
    var fcSvg = d3.select("#selects").append("svg")
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
      .call(d3.axisBottom(x).tickFormat(d3.format("")).ticks(30).tickSize(6, 0))
      .selectAll("text")	
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");

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
    
    console.log(d3.event.selection, fx.domain(), "width = ", width);

    let dataLength = svgs.data()[0].values.length;
    let start = Math.round(d3.event.selection[0] / width * dataLength);
    let end = Math.round(d3.event.selection[1] / width * dataLength) - 1;
    console.log("start, end", start, end)
    fx.domain([start, end]);
    // fx.domain([0, 1013]);
    // fx.domain(d3.event.selection)

    let fline = d3.line()
    .x(function (d) { return fx(d.date); })
    .y(function (d) { return fy(d.price); });

    svgs.each(function () {
      // d3.select(this).select("path").remove();
      d3.select(this).select("path")
        .attr("class", "line")
        .attr("d", function (d) { 
          fy.domain([d.minPrice, d.maxPrice]);
          // console.log("x", fline(d.values));
          return fline(d.values); })
        ;
        // .attr("transform", "translate(10, 0)")
    });

    // console.log(d3.select("#selectsXAxis").select("g"))
    d3.select("#selectsXAxis")
      .call(d3.axisBottom(fx).tickFormat(d3.format("")).ticks(30).tickSize(6, 0))
    // console.log("FGBrush", d3.event);

    __this.focusX = fx;
  }

  public brushed(__this: any): void {
    // let width = 940;
    console.log(d3.event);
    var selection;
    if (d3.event == null) selection = __this.previousSelections;
    else selection = d3.event.selection;
    __this.previousSelections = selection;

    console.log("sel = ", selection);
    __this.calDTW(null, null, null);

    let searchResultList = [];
    let dataLength = 0;
    let start = 0;
    let end = 0;

    let width = this.width;
    let height = this.height;

    let fx = __this.focusX;
    start = Math.round(fx.invert(selection[0]));
    end = Math.round(fx.invert(selection[1]));
    console.log(start, end);

    ///////////////////////////////////
    // for all line charts
    d3.selectAll(".lineBrush")
      // .filter((d, i) => (i === 0))
      .each(function (brushObject, i) {
        d3.select(this).call(d3.brushX().move, selection);
        
        var sel = d3.brushSelection(this);
        dataLength = d3.select(this).data()[0].values.length;
        // start = Math.round(sel[0] / width * dataLength);
        // end = Math.round(sel[1] / width * dataLength);

        // console.log(d3.brushSelection(this), dataLength, start, end);
        let fullResultList = __this.calDTW(d3.select(this).data()[0].values.map(d => d.price), start, end);
        let resultList = fullResultList
          .sort((a, b) => (a.distance - b.distance))
          .filter(function(d, i) {
            d.yDistRanking = i;
            return i < __this.showListSizeAtRightPane;
          }).map(function (d, i) {
            d["rankX"] = d.startIndex * width / dataLength;
            d["rankWidth"] = (d.endIndex - d.startIndex) * width / dataLength;
            return d;
        });
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

        
        
        searchResultList.push(fullResultList.sort((a, b) => (a.startIndex - b.startIndex)));

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
      }
    );
    
    // calculate matching
    let verticalPatternSets = getVerticalPatternSet(searchResultList, this.rankCount, this.w2Value);
    console.log("verticalPatternSets", verticalPatternSets);
    
    // verticalPatternSets.forEach(elem => (elem.forEach((d, i) => drawPatternSelection(d, i))));
    // verticalPatternSets.filter((d, i) => (i < 10));
    let variateCount = verticalPatternSets[0].length;
    
    for (let i = 0; i < variateCount; i ++) {
      drawPatternSelection(verticalPatternSets.map(function(element) {
        let elem = element[i];
        elem["rankX"] = elem.startIndex * width / dataLength;
        elem["rankWidth"] = (elem.endIndex - elem.startIndex) * width / dataLength;
        return elem;
      }), i);
    }

    __this.timeRankResult = verticalPatternSets.map(d => d[0].t);
    console.log(__this.timeRankResult);
    function drawPatternSelection(selectionList, i) {
      console.log("draw", i, selectionList);

      let rankSelection = d3.select("#lineBrushes" + i).selectAll(".rankSelection").data(selectionList);
console.log(rankSelection);
      rankSelection
        .enter()
        .append("rect")
        .merge(rankSelection)
        .attr("class", "rankSelection")
        .attr("fill", "pink")
        .attr("fill-opacity", "0.05")
        .attr("stroke", "pink")
        // .attr("x", (d) => (d.rankX))
        .attr("x", function(d) { return d.rankX;})
        .attr("y", 0)
        .attr("width", (d) => (d.rankWidth))
        .attr("height", height);

      rankSelection.exit().remove();
    }

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
        // console.log(variateIndex, list.length, totalDistanceByTimeSlot);
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

  public calDTW(list, start, end) {
    if (list === null) return;

    let dataPoints = [];
    dataPoints = list.filter(function (d, i) {
      return i >= start && i <= end;
    });

    let comparisonWidth = dataPoints.length + 0;
    let iterationPoints = list.map((d, i) => i).filter(index => index < list.length - comparisonWidth)
      .filter(index => !(index > start - comparisonWidth && index <= end + comparisonWidth));

    let resultList = iterationPoints.map(function (i) {
      var DTW = require('dtw');
      var dtw = new DTW();

      let compTargetPoints = list.slice(i, i + comparisonWidth);
      
      // z normalization: y-offset shifting
      let znormedCompTargetPoints = zNormalize(compTargetPoints);
      let znormedDataPoints = zNormalize(dataPoints);

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

