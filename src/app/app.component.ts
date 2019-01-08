import { Component, OnDestroy, OnInit, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/of';
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
  // private width: number;
  // private height: number;
  // public searchResultList: Array<any>;
  private readonly _internalSubscription = new Subscription();

  constructor(private http: Http) {
    d3.csv("./assets/data/stocks.csv", function (d) {
      let parseDate = d3.timeParse("%b %Y");
      // d.date += 1;
      d.price = +d.price;
      d.date = parseDate(d.date);
      return d;
    }).then(function (data) {
      let lineBrushList = [];
      let searchResultList = [];
      let maxWidth = 1200;
      let margin = { top: 0, right: 10, bottom: 0, left: 10 };
      let width = maxWidth - margin.left - margin.right;
      let height = 150 - margin.top - margin.bottom;

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

      // svg.append("g")
      //   .call(d3.axisRight(y));

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
          // console.log(d, i, this);
          // newLineBrush(gBrushes, i);
          // drawLineBrushes(gBrushes, i);
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

      var brush = d3.brushX()
        // .extent([[0, 0], [width, height2]])
        .on("end", brushed);

      var gBrush = svg.append('g')
        .attr("class", "brush")
        .call(brush);
      
      function brushed(): void {
        // let width = 940;
        var selection = d3.event.selection;

        calDTW(null, null, null);

        let searchResultList = [];
        let dataLength = 0;
        let start = 0;
        let end = 0;
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
            let fullResultList = calDTW(d3.select(this).data()[0].values.map(d => d.price), start, end);
            let showListSize = 10;
            let resultList = fullResultList
              .sort((a, b) => (a.distance - b.distance))
              .filter((d, i) => (i < showListSize)).map(function (d, i) {
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
            // drawRankSelection([top], i);
            // drawRankSelection(top, i, 0);
            
            searchResultList.push(fullResultList.sort((a, b) => (a.startIndex - b.startIndex)));

            function drawRankSelection(list, i) {
              let rankSelection = d3.select("#lineBrushes" + i).selectAll(".rankSelection").data(list)
              // console.log("draw => ", rankSelection.selectAll("rankSelection"));
              // console.log("list = ", list);
              // console.log("1 rankS", rankSelection);

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
        
        //console.log(searchResultList);
        // calculate matching

        let verticalPatternSets = getVerticalPatternSet(searchResultList, 20);
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
        
        function drawPatternSelection(selectionList, i) {
          console.log("draw", selectionList);

          let rankSelection = d3.select("#lineBrushes" + i).selectAll(".rankSelection").data(selectionList);
          // console.log("draw => ", rankSelection.selectAll("rankSelection"));
          // console.log("list = ", list);
          // console.log("1 rankS", rankSelection);

          rankSelection
            .enter()
            .append("rect")
            .merge(rankSelection)
            .attr("class", "rankSelection")
            .attr("fill", "blue")
            .attr("fill-opacity", "0.05")
            .attr("stroke", "blue")
            .attr("x", (d) => (d.rankX))
            .attr("y", 0)
            .attr("width", (d) => (d.rankWidth))
            .attr("height", height);

          rankSelection.exit().remove();

          // console.log(rankElement);
          // let variateCount = rankElement.minList.length;
          // rankElement.minList.map(function (blockList, i) {
          //   let blockData = d3.select("#lineBrushes" + i).selectAll(".rankSelection").data([blockList]);
          //   blockData.push(blockData);
          //   console.log("blockData", blockData);
          //   let rankSelection = d3.select("#lineBrushes" + i).selectAll(".rankSelection");
          //   console.log(rankSelection.data());
          //   // console.log("blockList = ", blockList);
          //   blockList["rankX"] = blockList.startIndex * width / dataLength;
          //   blockList["rankWidth"] = (blockList.endIndex - blockList.startIndex) * width / dataLength;
          //   // console.log("2 rankS", rankSelection);

          //   rankSelection
          //     .enter()
          //     .append("rect")
          //     .merge(rankSelection)
          //     .attr("class", "rankSelection")
          //     .attr("fill", "blue")
          //     .attr("fill-opacity", "0.3")
          //     .attr("stroke", "blue")
          //     .attr("x", (d) => (d.rankX))
          //     .attr("y", 0)
          //     .attr("width", (d) => (d.rankWidth))
          //     .attr("height", height);

          //   // rankSelection.exit().remove();
          // });
        }

        function getVerticalPatternSet(allVariateDistanceList, rankCount) {
          let timeSlotLength = allVariateDistanceList[0].length;

          console.log("searchResultList", allVariateDistanceList);
          let variateDistancesByTimeSlot = allVariateDistanceList.map(function(list, i) {
            let totalDistanceByTimeSlot = [];

            for (let t = 0; t < list.length; t++) {
              totalDistanceByTimeSlot.push(list.map(function(d, i) {
                  let w2 = 10;
                  let yDist = w2 * (t - d.startIndex);
                  yDist = yDist * yDist;
                  // if (yDist < 0) yDist *= -1;            
                  let distance = d.distance + yDist;

                  return {distance:distance, xDistance:d.distance, yDistance:yDist
                    ,t:t, startIndex:d.startIndex, endIndex:d.endIndex};
                }).sort((a, b) => a.distance - b.distance)
                .filter(function(d, i, arr) {
                  if (i > 0) arr[i].diff = arr[i].distance - arr[i-1].distance;
                  else arr[i].diff = 0;
                  return i < rankCount;
                })
              );
            }
            // console.log(i, list.length, totalDistanceByTimeSlot);
            return totalDistanceByTimeSlot;
          });
          console.log("variateDistancesByTimeSlot", variateDistancesByTimeSlot);

          let selectionsByTime = [];
          for (let t = 0; t < timeSlotLength; t++) {
            let timeList = variateDistancesByTimeSlot.map((d) => d[t]);
            // console.log("timeList", timeList);
            let cnt = rankCount - 1;
            let selectionByRank = [];
            // init
            selectionByRank.push(timeList.map(function(d, i, arr) {
              return d.splice(0, 1)[0];
            }));
            // console.log("before", selectionByRank[0]);
            for (let i = 0; i < cnt; i++) {
              // get min
              let itemAndIndex = timeList.map((d) => (d[0])).reduce(function(prev, cur, i) {
                return prev[0].diff > cur.diff ? [cur, i] : prev;
              }, [{diff:Number.MAX_VALUE}, -1]);
              
              // copy last values as deep copy
              selectionByRank.push(selectionByRank[i].map(d => d));

              // change as min
              let minVariateIndex = itemAndIndex[1];
              selectionByRank[i + 1][minVariateIndex] = timeList[minVariateIndex].splice(0, 1)[0];
              // console.log("after", selectionByRank);
            }
            selectionsByTime.push(selectionByRank);
          }

          // console.log(selectionsByTime);
          
          let flatSelection = [];
          selectionsByTime.forEach(function(elem) {
            flatSelection = flatSelection.concat(elem);
          });

          return flatSelection.sort(function(a, b) {
             return a.reduce((prev, cur) => prev + cur, 0) - b.reduce((prev, cur) => prev + cur, 0);
          }).filter((d, i) => i < rankCount);
          // let multiVariateDistanceSumByTimeSlot = [];
          // for (let t = 0; t < timeSlotLength; t++) {
          //   multiVariateDistanceSumByTimeSlot.push(variateDistancesByTimeSlot.reduce(function(prev, list) {
          //     prev.distanceSum += list[t].distance;
          //     prev.minList.push(list[t]);
          //     return prev;
          //   }, {distanceSum:0, minList:[], t:t}));
          // }
          // console.log("SumByTimeSlot", multiVariateDistanceSumByTimeSlot);
          // return multiVariateDistanceSumByTimeSlot.sort((a, b) => (a.distanceSum - b.distanceSum));
        }

        function calDTW(list, start, end) {
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
            let distance = dtw.compute(dataPoints, compTargetPoints);
            var path = dtw.path();

            return { distance: distance, startIndex: i, endIndex: i + comparisonWidth, path: path };
          });
          // }).sort((a, b) => (a.distance - b.distance));

          // return resultList.filter((d, i) => (i < listSize)).filter(d => d.distance != 0);
          return resultList;
        }
      }
    });
  }

  private type(d): any {
    let parseDate = d3.timeParse("%b %Y");
    d.price = +d.price;
    d.date = parseDate(d.date);

    return d;
  }

  ngOnInit() {

  }

  ngOnDestroy() {

  }

}
