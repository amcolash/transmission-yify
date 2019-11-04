import React, { Component } from 'react';
import axios from 'axios';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import '../css/Analytics.css';

class Analytics extends Component {
  constructor(props) {
    super(props);
    this.state = { analytics: {}, type: null };
  }

  componentDidMount() {
    const key = localStorage.getItem('key') || window.prompt("Password?", "");
    axios.get(this.props.server + '/analytics?key=' + key).then(response => {
      localStorage.setItem('key', key);
      this.setState({analytics: response.data, type: Object.keys(response.data)[0]});
    }).catch(err => {
      localStorage.removeItem('key');
      console.error(err);
    });
  }

  render() {
    const { analytics, type } = this.state;

    const types = analytics ? Object.keys(analytics) : [];

    const options = {
      title: {
        text: type
      },
      series: [{
        data: [1, 2, 3]
      }]
    };
    
    return (
      <div className="analyticsList">
        <h2>Analytics</h2>
        <div>
          {types.length > 0 ? (
            <div className="searchItem">
                <span>Type</span>
                <select onChange={(event) => this.setState({type: event.target.value})} value={type} >
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
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
        {JSON.stringify(analytics)}
      </div>
    );
  }
}
  
export default Analytics;