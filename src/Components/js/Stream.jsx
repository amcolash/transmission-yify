import '../css/Stream.css';

import axios from 'axios';
import React, { Component, Fragment } from 'react';
import { FaTimes } from 'react-icons/fa';

class Stream extends Component {
  state = { files: undefined, file: undefined };
  componentDidMount() {
    this.updateData();
  }

  updateData() {
    axios
      .get(this.props.server + '/fileList')
      .then((response) => this.setState({ files: response.data }))
      .catch((err) => console.error(err));
  }

  render() {
    return (
      <Fragment>
        <h2>Stream Files</h2>
        {this.state.file ? (
          <div style={{ position: 'relative' }}>
            <FaTimes
              style={{ position: 'absolute', top: 5, right: 5, cursor: 'pointer' }}
              onClick={() => this.setState({ file: undefined })}
            />
            <video controls autoPlay style={{ width: '95vw', height: '60vh', background: 'black' }}>
              <source src={this.props.server + '/files' + this.state.file} />
            </video>
          </div>
        ) : (
          this.state.files &&
          this.state.files.map((f) => (
            <div key={f} style={{ padding: 2 }}>
              <span className="pointer" onClick={() => this.setState({ file: f })}>
                {f}
              </span>
            </div>
          ))
        )}
      </Fragment>
    );
  }
}

export default Stream;
