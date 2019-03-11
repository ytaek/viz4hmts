import { Component, OnInit } from '@angular/core';
import { Http } from '@angular/http';
import * as d3 from 'd3';
import * as _ from 'underscore';
import { DTW } from 'dtw';
import { BuiltinType } from '@angular/compiler';
import { isDefaultChangeDetectionStrategy } from '@angular/core/src/change_detection/constants';

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
  contextHeight = 50;
  previousSelections: any;
  lineBrush;
  
  timeUnitSecond = 0;
  lineSelectionList = [];
  isLineSelectedForVerticalSearchList = [];
  horizontalSeachResultList = [];
  verticalPatternSets = [];

  public stride = 20;
  public focusX: any;
  public contextX: any;
  public channelCount: number;
  public dataLength: number;
  public showHorizontalSearchCount = 20;
  public searchTimeRelaxationMs = 5000;
  public showHorizontalSearchPercent = 10;
  public isKeepOrdering = false;
  public showTopVerticalPattenCount = 50;
  public resultCandidateCountPerWindow = 2;

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
      // s.maxPrice = d3.max(s.values, function (d) { return d.price; });
      // s.minPrice = d3.min(s.values, function (d) { return d.price; });
      searchResultList.push(null);
      this.lineSelectionList.push(null);
      this.horizontalSeachResultList.push(null);
      this.isLineSelectedForVerticalSearchList.push(false);
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
    this.timeUnitSecond = symbols[0].values[1].date - symbols[0].values[0].date;

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
    svg.append("g").attr("id", (d, i) => `lineBrushButtonArea${i}`).attr("visibility", "hidden");
    svg.append("g").attr("id", (d, i) => `hrzResultArea${i}`)
    svg.append("g").attr("id", (d, i) => `verticalResultArea${i}`)

    ////////////////////////////////////////
    // DRAW focus area
    var marginb = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    widthb = this.maxWidth - marginb.left - marginb.right,
    heightb = 30 - marginb.top - marginb.bottom;

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
    let contextHeight = this.contextHeight;
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
// console.log(d3.event.selection, start, end);

    // REDRAW CONTEXT
    let cline = d3.line()
      .x(function (d) { return fx(d.date); })
      .y(function (d) { return fy(d.price); });

    svgs.each(function () {
      d3.select(this).select("path")
        .attr("class", "line")
        .attr("d", function (d) {
          let sliceScale = d3.scaleLinear().range([0, dataLength]).domain([0, d3.max(d.values, function (d) { return d.date; })]);
          let sliced = d.values.slice(sliceScale(start), sliceScale(end));
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

    // REDRAW Horizontal Search Result
    __this.horizontalSeachResultList
      .filter(d => d !== null)
      .forEach((d, i) => __this.drawHorizontalSearchResults(i))
    ;

    // REDRAW verticalPatternSets
    if (this.verticalPatternSets.length > 0) this.drawVerticalPatternSets(this.verticalPatternSets);

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
      lineBrushButtonArea.append("text").attr("class", "verticalSpan");
      lineBrushButtonArea.append("text").attr("class", "findButton");
    }
    
    let butX = selection[1]- 7;
    let butY = __this.height - 5

    lineBrushButtonArea.select(".verticalSpan")
      .style("text-anchor", "end")
      .attr("x", selection[1]-10)
      .attr("y", __this.height - 8)
      .text("↕")
      .on("click", () => __this.verticalSpan(__this, i, selection));
      ;

    lineBrushButtonArea.select(".findButton")
      .style("text-anchor", "end")
      .attr("transform", "rotate(26 " + (butX) + "," +  butY + ")")
      .attr("x", butX)
      .attr("y", butY)
      .text("⚲")
      .on("click", () => __this.findHorizontal(__this, i, __this.focusX.invert(selection[0]), __this.focusX.invert(selection[1])));
      ;

    let brush = d3.select("#lineBrushes" + i).select(".selection");
    brush.on("mouseover", () => lineBrushButtonArea.attr("visibility", ""));
    brush.on("mouseleave", () => lineBrushButtonArea.attr("visibility", "hidden"));
    lineBrushButtonArea.on("mouseover", () => lineBrushButtonArea.attr("visibility", ""));

    __this.lineSelectionList[i] = selection.map(d => __this.focusX.invert(d));
    __this.isLineSelectedForVerticalSearchList[i] = true;
  }

  public verticalSpan(__this:any, chIndex: number, selection: any) {
    d3.selectAll(".lineBrush").call(this.lineBrush.move, selection);

    selection = selection.map(d => __this.focusX.invert(d));
    for (let i; i<__this.channelCount; i++) {
      __this.lineSelectionList[i] = selection;
      __this.isLineSelectedForVerticalSearchList[i] = true;
    }
  }


  public drawHorizontalSearchResults(chIndex: number) {
    console.log("drawHorizontalSearchResults")
    
    let resultList = this.horizontalSeachResultList[chIndex];
    d3.select(`#hrzResultArea${chIndex}`).selectAll(".hrzResult").remove();
    if (resultList === null) return;

    let hrzResult = d3.select(`#hrzResultArea${chIndex}`).selectAll(".hrzResult").data(resultList);

    hrzResult
      .enter()
      .append("rect")
      .filter(d => this.focusX(d.x + d.width) >= 0)
      .merge(hrzResult)
      .attr("class", "hrzResult")
      .attr("fill", "blue")
      .attr("fill-opacity", "0.001")
      .attr("stroke", "blue")
      .attr("x", (d) => this.focusX(d.x))
      .attr("y", 0)
      .attr("width", (d) => this.focusX(d.x + d.width) - this.focusX(d.x))
      .attr("height", this.height);

    hrzResult.exit().remove();
  }

  public verticalSearch() {
    // draw results
    this.verticalPatternSets = this.findVerticalPatterns();
    this.drawVerticalPatternSets(this.verticalPatternSets);
  }

  public drawVerticalPatternSets(verticalPatternSets: any) {
    let horizontalPatternSetList = _.range(this.channelCount).map(i => verticalPatternSets.map(d => d[i]));
    // console.log(verticalPatternSets, horizontalPatternSetList);

    horizontalPatternSetList.forEach( function (set, chIndex) {
      if (set[0] === null) return;

      d3.select(`#verticalResultArea${chIndex}`).selectAll(".verticalPattern").remove();
      let patterns = d3.select(`#verticalResultArea${chIndex}`).selectAll(".verticalPattern").data(set);
      patterns
        .enter()
        .append("rect")
        .merge(patterns)
        .attr("id", (d, i) => `pair${i}`)
        .attr("class", "verticalPattern")
        .attr("fill", "pink")
        .attr("fill-opacity", "0.05")
        .attr("stroke", "pink")
        .attr("x", (d) => this.focusX(d.x))
        .attr("y", 0)
        .attr("width", (d) => this.focusX(d.x + d.width) - this.focusX(d.x))
        .attr("height", this.height)
        .on("mouseover", (d, i) => overSet(true, i))
        ;
      
      patterns.exit().remove();
    }, this);

    // when over, draw new rects for selected pair
    function overSet(over: boolean, setIndex: number) {
      if (!over) {
        d3.selectAll(".hightlightPair").remove();
        return;
      }
      let patternSet = d3.selectAll(`#pair${setIndex}`);

      patternSet.each(function(d, chIndex) {
        let node = d3.select(this);
        d3.select(this.parentNode)
          .append("rect")
          .attr("id", (d, i) => `pair${i}`)
          .attr("class", "hightlightPair")
          .attr("stroke", "red")
          .attr("stroke-width", "2")
          .attr("fill", "transparent")
          .attr("x", node.attr("x"))
          .attr("y", 0)
          .attr("width", node.attr("width"))
          .attr("height", node.attr("height"))
          .on("mouseleave", (d, i) => overSet(false, chIndex))
      });
    }
  }


  ngOnInit() {
  }


  //////////////////////////////////////////////////////////
  // CALCULATIONS
  //////////////////////////////////////////////////////////

  public findVerticalPatterns() {
    let resultLists = [];
    let selectionIndexes = [];

    for(let i = 0; i < this.channelCount; i++) resultLists.push(null);

    // calculate each channel horizontally.
    this.lineSelectionList.forEach( function(selection, chIndex) {
      if (this.isLineSelectedForVerticalSearchList[chIndex] !== true) return;

      let startTimeValue = this.round(selection[0], this.timeUnitSecond);
      let endTimeValue = this.round(selection[1], this.timeUnitSecond);
      let startIndex = parseInt( (startTimeValue / this.timeUnitSecond) + "");
      let endIndex = parseInt( (endTimeValue / this.timeUnitSecond) + "");

      let fullResultList = this.calDTW(d3.select("#lineBrushes" + chIndex).data()[0].values.map(d => d.price), startIndex, endIndex, this.stride);
      let rankScale = d3.scaleLinear().range([0, 50]).domain([0, fullResultList.length]);
      let normalizedValueScale = d3.scaleLinear().range([0, 50]).domain(d3.extent(fullResultList, d => d.distance));

      selectionIndexes.push([startIndex, endIndex]);
      let resultList = fullResultList.sort((a, b) => (a.distance - b.distance))
        .map(function (d, i) {
          d["hZRank"] = i;
          d["x"] = d.startIndex * this.timeUnitSecond;
          d["width"] = (d.endIndex - d.startIndex) * this.timeUnitSecond;
          d["hZRankScore"] = rankScale(i);
          d["normValScore"] = normalizedValueScale(d.distance);
          d["score"] = d.hZRankScore + d.normValScore;
          return d;
        }, this)
        .sort((a, b) => (a.startIndex - b.startIndex))
      ;
      
      console.log(chIndex, resultList);
      resultLists[chIndex] = resultList;
    }, this); // selectionList loop

    // summation channel score by time
    // resultLists.
    return this.findVerticalTopPatternsWithFullResultList(resultLists, selectionIndexes);
  }

  private findVerticalTopPatternsWithFullResultList(resultLists: any, selectionIndexes: any) {
    console.log("lineSelectionList", this.lineSelectionList);

    let validChCnt = selectionIndexes.filter(d => d !== null).length;

    // find Top20
    let topCnt = this.showTopVerticalPattenCount;
    let topVerticalPairs = [];

    class verticalPair {
      pairs: Array<any>;
      sum: number;
      
      constructor() {
        this.pairs = [];
        this.sum = 0;
      }
    }
    
    // reduce[chIndex, startIndex]
    let orderedStartIndexList = selectionIndexes.reduce(function(prev, cur, chIndex) {
      if (cur === null) return prev;
      prev.push([chIndex, cur[0]]);
      return prev;
    }, []).sort((a, b) => (a[1] - b[1])).map(d => d[0]);
// console.log("orderedStartIndexList", orderedStartIndexList);

    let searchRelaxationUnit = Math.ceil(this.searchTimeRelaxationMs / 1000 / this.timeUnitSecond / this.stride);
    let minStartIndex = d3.min(selectionIndexes.filter(d => d !== null), (d) => d[0]);
    let dataLength = this.dataLength;
    let iterationPointsByChannel = [];
    let iterationPoints = _.range(0, dataLength, this.stride);
    let endInterationPoint = iterationPoints.length - 1;
    
    
    this.lineSelectionList.forEach( function(selection, chIndex) {
      if (selection === null) {
        iterationPointsByChannel.push(null);
        return;
      }

      let selIndex = selectionIndexes[chIndex];
      let selWidth = selIndex[1] - selIndex[0];
      let lgap = selIndex[0] - minStartIndex; 

      iterationPointsByChannel.push(iterationPoints.map(function(timePoint) {
        let relaxation = lgap + searchRelaxationUnit;
        let searchRange = [
          Math.max(0, timePoint - relaxation), 
          Math.min(timePoint + selWidth + relaxation, dataLength)
        ];
        
        // searchRange should be wider than one side relaxation
        if (searchRange[1] - searchRange[0] >= selWidth + relaxation) return searchRange;
        else return null;
      }).filter(d => d !== null));

      endInterationPoint = Math.min(endInterationPoint, iterationPointsByChannel[chIndex].length - 1);
    }, this);
  
    // console.log(iterationPoints, endInterationPoint, iterationPointsByChannel)

    let minCut = Number.MAX_VALUE;
    for (let window = 0; window < endInterationPoint; window++) {
// console.log("window#", window);
      // set min cut
      if (topVerticalPairs.length >= this.showTopVerticalPattenCount) {
        minCut = topVerticalPairs[this.showTopVerticalPattenCount - 1];
      }
      let isSkip = false;
      let resultQueueList = [];
      
      resultLists.forEach( function(result, chIndex) {
        if (iterationPointsByChannel[chIndex] === null || isSkip) { 
          resultQueueList.push(null);
          return;
        }
        let searchRange = iterationPointsByChannel[chIndex][window];
        let subList = result.filter(d => d.startIndex >= searchRange[0] && d.startIndex < searchRange[1]);
        if (subList.length === 0) isSkip = true;
        // console.log("subList", searchRange, subList);

        subList.sort( (a, b) => (a.distance - b.distance));
        resultQueueList.push(subList);
      }); //resultLists loop

      if (isSkip) continue;
      // console.log("resultQueueList", resultQueueList);

      let topPairsPerWindow = [];
      // extract TOP pairs from window
      while (topPairsPerWindow.length < this.resultCandidateCountPerWindow) {
        // console.log(resultQueueList, resultQueueList.filter(d => d !== null).reduce((prev, cur) => prev += cur.length, 0), validChCnt);
        // check not enough set
        if (resultQueueList.filter(d => d !== null).reduce((prev, cur) => prev += cur.length, 0) < validChCnt) {
          break;
        }
        
        let pair = new verticalPair();
        let nextMinChIndex = -1;
        [pair, nextMinChIndex,] = resultQueueList.reduce( function(prev, list, chIndex) {
          if (list === null) {
            prev[0].pairs.push(null);
            return prev;
          }

          let diff = (list.length >= 2 ? list[1].distance - list[0].distance : Number.MAX_VALUE);
          if (prev[2] > diff) {
            prev[1] = chIndex;
            prev[2] = diff;
          }
          
          prev[0].sum += list[0].distance;
          prev[0].pairs.push(list[0]);
          return prev;
        }, [pair, -1, Number.MAX_VALUE]);

        // keep ordering
        let same = true;
        if (this.isKeepOrdering) {
          let orderedIndex = pair.pairs.reduce(function(prev, cur, chIndex) {
            if (cur === null) return prev;
            prev.push([chIndex, cur.startIndex]);
            return prev;
          }, []).sort((a, b) => (a[1] - b[1])).map(d => d[0]);

          for (let i = 0; i < orderedStartIndexList.length; i++) {
            if (orderedStartIndexList[i] !== orderedIndex[i]) {
              same = false;
              break;
            }
          }
// console.log("cmp", orderedStartIndexList, orderedIndex, same);
        }

        // check sum is below topPairsLastLength;
        if (minCut < pair.sum) break;

        if (same) topPairsPerWindow.push(pair);
        if (nextMinChIndex === -1) break;
        resultQueueList[nextMinChIndex].splice(0,1);

//         // check only one pair exists
//         if (nextMinChIndex != -1) {
//           resultQueueList[nextMinChIndex].splice(0,1);
//           if (same) topPairsPerWindow.push(pair);
//         } else resultQueueList.forEach(d => d = []);

// console.log("topPairsPerWindow", topPairsPerWindow)
      } // topCnt loop

      if (topPairsPerWindow.length > 0) {
        topPairsPerWindow.map(d => topVerticalPairs.push(d));
        topVerticalPairs.sort((a, b) => (a.sum - b.sum));
// console.log("topVerticalPairs", topVerticalPairs)
        // trim
        topVerticalPairs.splice(topCnt, topPairsPerWindow.length);
      }
    }


    // 해당 iterationpoint에서 rank 2~5개만 뽑고
    // -> 그 중에서 500개를 하는게 나을 듯.
    return topVerticalPairs.map(d => d.pairs);
  }


  public findHorizontal(__this: any, chIndex: number, startTimeValue: number, endTimeValue: number) {
    startTimeValue = __this.round(startTimeValue, __this.timeUnitSecond);
    endTimeValue = __this.round(endTimeValue, __this.timeUnitSecond);

    let startIndex = parseInt( (startTimeValue / __this.timeUnitSecond) + "");
    let endIndex = parseInt( (endTimeValue / __this.timeUnitSecond) + "");

    console.log("find horizontal patterns => ", [startTimeValue, endTimeValue], [startIndex, endIndex], __this.timeUnitSecond, __this.dataLength);
    
    // FIND TOPs
    let fullResultList = __this.calDTW(d3.select("#lineBrushes" + chIndex).data()[0].values.map(d => d.price), startIndex, endIndex, __this.stride);
    let rankScale = d3.scaleLinear().range([0, 50]).domain([0, fullResultList.length]);
    let normalizedValueScale = d3.scaleLinear().range([0, 50]).domain(d3.extent(fullResultList, d => d.distance));

    let resultList = fullResultList.sort((a, b) => (a.distance - b.distance))
      // .filter(function(d, i) {
      //   d.hZRank = i;
      //   return i < __this.showHorizontalSearchCount;
      // })
      .map(function (d, i) {
        d["hZRank"] = i;
        d["x"] = d.startIndex * __this.timeUnitSecond;
        d["width"] = (d.endIndex - d.startIndex) * __this.timeUnitSecond;
        d["hZRankScore"] = rankScale(i);
        d["normValScore"] = normalizedValueScale(d.distance);
        d["score"] = d.hZRankScore + d.normValScore;
        return d;
      })
      .filter(function(d, i) {
          // return d.score < __this.showHorizontalSearchCount;
          // return d.score < 1;
          return d.hZRankScore < __this.showHorizontalSearchPercent && d.normValScore < __this.showHorizontalSearchPercent;
        })
      ;
    // console.log(fullResultList);
    console.log(resultList);
    
    __this.horizontalSeachResultList[chIndex] = resultList;
    __this.drawHorizontalSearchResults(chIndex);
  }

  private round(value: number, unit: number) {
    let residual = value % unit;
    if (residual > unit / 2) return value - residual + unit;
    else return value - residual;;
  }

  ///////////////////
  // DTW
  ///////////////////
  public calDTW(list, start, end, stride = 1) {
    if (list === null) return;

    let dataPoints = [];
    dataPoints = list.filter(function (d, i) {
      return i >= start && i <= end;
    });

    let DTW = require('dtw');
    let dtw = new DTW();

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

      // let distance = dtw.compute(znormedDataPoints, znormedCompTargetPoints);
      let distance = dtw.compute(dataPoints, compTargetPoints);
      var path = dtw.path();

      return { 
        distance: distance, 
        startIndex: i, 
        endIndex: i + comparisonWidth, 
        // path: path,
      };
    });

    // return resultList.filter((d, i) => (i < listSize)).filter(d => d.distance != 0);
    return resultList;

    function zNormalize(arr) {
      let mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.map(d => d - mean);
    }
  }
}
