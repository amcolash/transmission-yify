import '../css/Spinner.css';

import React, { Component } from 'react';

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
