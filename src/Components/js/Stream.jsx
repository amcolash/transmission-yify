import '../css/Stream.css';

import axios from 'axios';
import levenshtein from 'js-levenshtein';
import React, { Component } from 'react';
import { FaPlayCircle, FaTimesCircle } from 'react-icons/fa';

import * as ptn from '../../Util/TorrentName';
import Spinner from './Spinner';

class Stream extends Component {
  state = { files: undefined, file: undefined, search: '', type: 'movie' };

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
    const { files, file, search, type } = this.state;

    return (
      <div className="streamList">
        <h2>Stream Files</h2>
        <div className="searchbar">
          <label htmlFor="search">Search</label>
          <input type="search" name="search" value={search} onChange={(e) => this.setState({ search: e.target.value })} />

          <label htmlFor="type">Media Type</label>
          <select name="type" onChange={(e) => this.setState({ type: e.target.value })}>
            <option value="movie">Movie</option>
            <option value="tv">TV Show</option>
          </select>
        </div>
        <hr />
        <div className="list">
          {file ? (
            <div className="player">
              <FaTimesCircle onClick={() => this.setState({ file: undefined })} />
              <video controls autoPlay>
                <source src={this.props.server + '/files' + file} />
              </video>
            </div>
          ) : files ? (
            files.sort().map((f) => {
              const parsed = ptn(f);
              if (search.length > 0 && parsed.title) {
                const lev = levenshtein(parsed.title.toLowerCase(), search.toLowerCase());
                const match = 1 - lev / Math.max(parsed.title.length, search.length);

                if (match < 0.75 && parsed.title.toLowerCase().indexOf(search.toLowerCase()) === -1) return null;
              }

              if (type === 'movie' && f.indexOf('/TV') !== -1) return null;
              if (type === 'tv' && f.indexOf('/TV') === -1) return null;

              return (
                <div key={f} className="item">
                  <FaPlayCircle />
                  <span className="pointer" onClick={() => this.setState({ file: f })}>
                    {f}
                  </span>
                </div>
              );
            })
          ) : (
            <Spinner visible />
          )}
        </div>
      </div>
    );
  }
}

export default Stream;
