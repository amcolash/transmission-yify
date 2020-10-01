import '../css/Stream.css';

import axios from 'axios';
import React, { Component } from 'react';
import { FaTimesCircle } from 'react-icons/fa';

import Spinner from './Spinner';

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
    const { files, file } = this.state;

    return (
      <div className="streamList">
        <h2>Stream Files</h2>
        <div className="list">
          {file ? (
            <div className="player">
              <FaTimesCircle onClick={() => this.setState({ file: undefined })} />
              <video controls autoPlay>
                <source src={this.props.server + '/files' + file} />
            </video>
          </div>
          ) : files ? (
            files.map((f) => (
              <div key={f} style={{ padding: 2, paddingLeft: f.match(/\//g).length * 16 }}>
              <span className="pointer" onClick={() => this.setState({ file: f })}>
                {f}
              </span>
            </div>
          ))
          ) : (
            <Spinner visible />
        )}
        </div>
      </div>
    );
  }
}

export default Stream;
