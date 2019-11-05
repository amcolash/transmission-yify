import React, { Component } from 'react';
import axios from 'axios';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import '../css/Analytics.css';

// Default highcharts colors
const colors = ["#7cb5ec", "#434348", "#90ed7d", "#f7a35c", "#8085e9", "#f15c80", "#e4d354", "#2b908f", "#f45b5b", "#91e8e1"];

class Analytics extends Component {
  constructor(props) {
    super(props);
    this.state = { analytics: {}, type: 'all' };
  }

  componentDidMount() {
    this.updateData();
  }

  // TODO: Refresh Button
  updateData() {
    const key = localStorage.getItem('key') || window.prompt("Password?", "");
    axios.get(this.props.server + '/analytics?key=' + key).then(response => {
      localStorage.setItem('key', key);
      this.setState({analytics: response.data});
    }).catch(err => {
      //TODO: localStorage.removeItem('key');
      console.error(err);
    });
  }

  // Remove last section of a url path so remove things like id or page
  getSimpleUrl(url) {
    let simpleurl = url;

    if (url.split('/').length > 2) simpleurl = url.substring(0, url.lastIndexOf('/'));
    if (url.indexOf('/tmdb/seasons') !== -1) simpleurl = '/tmdb/seasons';

    return simpleurl;
  }

  // Take the nested analytics data and flatten it into a row-level like 1d array
  flattenType(data, type) {
    const flat = [];
    Object.keys(data).forEach(url => {
      data[url].forEach(entry => {
        const e = {url: type || url, ...entry};
        flat.push(e);
      });
    });
    return flat;
  }

  // Structure data similarly to the final data, but aggregate based on base url and add up method calls
  aggregateData(data) {
    const aggregated = {};
    data.forEach(entry => {
      const simpleurl = this.getSimpleUrl(entry.url);
      const key = simpleurl + ":" + entry.method;
      aggregated[key] = aggregated[key] || {};

      let date = new Date(entry.timestamp);
      date.setHours(0,0,0,0);
      date = date.getTime();

      if (aggregated[key][date]) aggregated[key][date]++;
      else aggregated[key][date] = 1; 
    });

    return aggregated;
  }

  // Transform data into a highcharts series
  generateSeries(data) {
    const series = [];
    Object.keys(data).forEach((url, index) => {
      const baseUrl = url.substring(0, url.indexOf(':'));
      const seriesData = [];
      Object.keys(data[url]).forEach(day => {
        seriesData.push([Number.parseInt(day), data[url][day]]);
      });

      series.push({
        name: url,
        data: seriesData,
        stack: baseUrl,
        stacking: 'column',
        color: colors[index % colors.length]
      });
    });

    return series;
  }

  parseAnalytics(analytics, type) {
    if (Object.keys(analytics).length === 0) return [];

    let flat = [];
    if (analytics[type]) {
      flat = this.flattenType(analytics[type]);
    } else {
      Object.keys(analytics).forEach(t => {
        flat = flat.concat(this.flattenType(analytics[t], t));
      });
    }

    const aggregated = this.aggregateData(flat);
    const series = this.generateSeries(aggregated);

    console.log(series)

    return series;
  }

  render() {
    const { analytics, type } = this.state;

    const types = analytics ? Object.keys(analytics).sort() : [];
    const series = this.parseAnalytics(analytics, type);

    const options = {
      chart: {
        type: 'column'
      },
      title: {
        text: type
      },
      xAxis: {
        labels: {
          format: '{value:%b %d, %Y}'
        },
        type: 'datetime',
      },
      yAxis: {
        minTickInterval: 1
      },
      series
    };
    
    return (
      <div className="analyticsList">
        <h2>Analytics</h2>
        <div>
          {types.length > 0 ? (
            <div className="searchItem">
                <span>Type</span>
                <select onChange={(event) => this.setState({type: event.target.value})} value={type} >
                  <option key="all" value="all">All</option>
                  {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
            </div>
          ) : null}
        </div>
        <br/>
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
        <br/>
        {/* {analytics && type ? JSON.stringify(analytics[type]) : null} */}
      </div>
    );
  }
}
  
export default Analytics;