import React, { Component } from 'react';
import '../css/Spinner.css';

class Spinner extends Component {
  render() {
    const { visible, noMargin, button, big } = this.props;
    return (
      <div
        className={
          'spinner ' + (visible ? 'visible' : 'invisible') + (noMargin ? '' : ' margin') + (button ? ' button' : '') + (big ? ' big' : '')
        }
      ></div>
    );
  }
}

export default Spinner;
