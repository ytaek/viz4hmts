import { Component, OnDestroy, OnInit, Injectable, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/of';
import { MatSliderModule } from '@angular/material/slider';
import { DTW } from 'dtw';
declare var require: any

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

@Injectable()
export class AppComponent implements OnInit, OnDestroy {
  title = 'app';
  maxWidth = 1000;
  margin = { top: 0, right: 10, bottom: 0, left: 10 };
  width = this.maxWidth - this.margin.left - this.margin.right;
  height = 120 - this.margin.top - this.margin.bottom;
  showListSizeAtRightPane = 8;

  public w2Value = 2;
  public rankCount = 50;
  public timeRankResult = [];
  private readonly _internalSubscription = new Subscription();

  constructor(private http: Http) {
    d3.csv("./assets/data/stocks.csv", function (d) {
      let parseDate = d3.timeParse("%b %Y");
      // d.date += 1;
      d.price = +d.price;
      d.date = parseDate(d.date);
      return d;
    }).then((data) => this.init(data));
  }

  private type(d): any {
    let parseDate = d3.timeParse("%b %Y");
    d.price = +d.price;
    d.date = parseDate(d.date);

    return d;
  }

  public w2Change(value: Number): any {
    console.log("w2 changed => ", value);
  }

  public rankCountChange(value: Number): any {
    console.log("w2 changed => ", value);
  }

  ngOnInit() {

  }

  ngOnDestroy() {

  }


  public init(data: Array<any>) {
    let width = this.width;
    let height = this.height;
    let margin = this.margin;
    let maxWidth = this.maxWidth;

    let lineBrushList = [];
    let searchResultList = [];

    let x = d3.scaleTime().range([0, width]);
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
      s.minPrice = 0;
      searchResultList.push(null);
    });
    
    // Compute the minimum and maximum date across symbols.
    // We assume values are sorted by date.
    x.domain([
      d3.min(symbols, function (s) { return s.values[0].date; }),
      d3.max(symbols, function (s) { return s.values[s.values.length - 1].date; })
    ]);

    // Add an SVG element for each symbol, with the desired dimensions and margin.
    var svg = d3.select("#lines").selectAll("svg")
      .data(symbols)
      .enter().append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    // Add the line path elements. Note: the y-domain is set per element.
    svg.append("path")
      .attr("class", "line")
      .attr("d", function (d) { y.domain([d.minPrice, d.maxPrice]); return line(d.values); });

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
      .attr("aaa", "bb")
      .attr("id", function (d, i) { return "rank" + i; });
    
    var marginb = {
      top: 0,
      right: 10,
      bottom: 0,
      left: 10
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
      .call(d3.axisBottom(x)); 

    let __this = this;
    var brush = d3.brushX()
      // .extent([[0, 0], [width, height2]])
      .on("end", () => this.brushed(__this));

    var gBrush = svg.append('g')
      .attr("class", "brush")
      .call(brush);
  }

  public brushed(__this: any): void {
    // let width = 940;
    var selection = d3.event.selection;
    __this.calDTW(null, null, null);

    let searchResultList = [];
    let dataLength = 0;
    let start = 0;
    let end = 0;

    let width = this.width;
    let height = this.height;

    ///////////////////////////////////
    // for all line charts
    d3.selectAll(".lineBrush")
      // .filter((d, i) => (i === 0))
      .each(function (brushObject, i) {
        d3.select(this).call(d3.brushX().move, selection);
        
        var sel = d3.brushSelection(this);
        dataLength = d3.select(this).data()[0].values.length;
        start = Math.round(sel[0] / width * dataLength);
        end = Math.round(sel[1] / width * dataLength);

        // console.log(d3.brushSelection(this), dataLength, start, end);
        let fullResultList = __this.calDTW(d3.select(this).data()[0].values.map(d => d.price), start, end);
        let resultList = fullResultList
          .sort((a, b) => (a.distance - b.distance))
          .filter(function(d, i) {
            d.xDistRanking = i;
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

        let top = resultList[0];
        
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

      rankSelection
        .enter()
        .append("rect")
        .merge(rankSelection)
        .attr("class", "rankSelection")
        .attr("fill", "pink")
        .attr("fill-opacity", "0.05")
        .attr("stroke", "pink")
        .attr("x", (d) => (d.rankX))
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
              let yDist = w2 * (t - d.startIndex);
              yDist = yDist * yDist;
              // if (yDist < 0) yDist *= -1;            
              let maxValue = 100000000;

              // let xDist = Math.log(d.distance);
              // yDist = 0;
              let xDist = d.distance;
              let distance = Math.min(maxValue, xDist) + Math.min(maxValue, yDist);

              return {distance:Math.floor(distance), xDist:Math.floor(xDist), yDist:Math.floor(yDist)
                , t:t, startIndex:d.startIndex, endIndex:d.endIndex
                , xDistRanking:d.xDistRanking
                , xDistance:d.distance, yDistance:(t-d.startIndex)};
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
          return d.splice(0, 1)[0];
        }));
        // console.log("before", selectionByRank[0]);
        for (let i = 0; i < Math.min(cnt, timeSlotLength); i++) {
          // get min
          let itemAndIndex = timeList.map((d) => (d[0])).reduce(function(prev, cur, i) {
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

