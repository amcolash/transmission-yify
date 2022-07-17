import '../css/Stream.css';

import { basename } from 'path';

import axios from 'axios';
import levenshtein from 'js-levenshtein';
import React, { Component } from 'react';
import { FaPlayCircle, FaTimesCircle } from 'react-icons/fa';

import * as ptn from '../../Util/TorrentName';
import Spinner from './Spinner';

class Stream extends Component {
  state = { files: undefined, file: undefined, search: '', type: 'movie', error: undefined };

  componentDidMount() {
    this.updateData();
  }

  updateData() {
    axios
      .get(this.props.server + '/fileList')
      .then((response) => this.setState({ files: response.data }))
      .catch((err) => {
        console.error(err);
        this.setState({ error: err });
      });
  }

  render() {
    const { files, file, search, type, error } = this.state;

    return (
      <div className="streamList">
        <h2>Stream Files</h2>
        <div className="list">
          {error ? (
            <div>
              <h3>There was an error loading files from the server</h3>
              <span>{JSON.stringify(error)}</span>
            </div>
          ) : file ? (
            <div className="player">
              <div className="controls">
                <FaTimesCircle
                  onClick={() => this.setState({ file: undefined })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') this.setState({ file: undefined });
                  }}
                  tabIndex="0"
                  className="close"
                />
              </div>
              <video controls autoPlay>
                <source src={this.props.server + '/files' + file} />
              </video>
            </div>
          ) : files ? (
            <div>
              <div className="searchbar">
                <input placeholder="Search" value={search} onChange={(e) => this.setState({ search: e.target.value })} />

                <label htmlFor="type">Media Type</label>
                <select name="type" onChange={(e) => this.setState({ type: e.target.value })} value={type}>
                  <option value="movie">Movie</option>
                  <option value="tv">TV Show</option>
                </select>
              </div>
              <hr />

              {files
                .map((f) => {
                  const parsed = ptn(basename(f));
                  parsed.file = f;

                  if (!parsed.title) return null;

                  parsed.title = parsed.title
                    .replace('/', '')
                    .replace(/\./g, '')
                    .replace(/^\d+\) /, '')
                    .replace(/^\[.+\]\s*/, '')
                    .replace(/^\s*[-_]*/, '')
                    .trim();

                  if (parsed.title.match(/^\d+$/)) return null;
                  if (parsed.title.toLowerCase().indexOf('sample') !== -1) return null;

                  if (search.length > 0) {
                    const lev = levenshtein(parsed.title.toLowerCase(), search.toLowerCase());
                    const match = 1 - lev / Math.max(parsed.title.length, search.length);

                    if (match < 0.75 && parsed.title.toLowerCase().indexOf(search.toLowerCase()) === -1) return null;
                  }

                  if (type === 'movie' && f.indexOf('/TV') !== -1) return null;
                  if (type === 'tv' && f.indexOf('/TV') === -1) return null;

                  return parsed;
                })
                .filter((p) => p !== null)
                .sort((a, b) => {
                  return a.title.localeCompare(b.title);
                })
                .map((parsed) => (
                  <div
                    key={parsed.file}
                    className="item pointer"
                    title={parsed.file}
                    tabIndex="0"
                    onClick={() => {
                      if (!window.cordova) this.setState({ file: parsed.file });
                      else {
                        const url = this.props.server + '/files' + parsed.file;

                        window.plugins.webintent.startActivity(
                          {
                            action: window.plugins.webintent.ACTION_VIEW,
                            package: 'org.videolan.vlc',
                            url,
                            type: 'video/*',
                          },
                          function () {
                            alert('ok');
                          },
                          function () {
                            alert('Failed to open URL via Android Intent.');
                            console.log('Failed to open URL via Android Intent. URL: ' + url);
                          }
                        );
                      }
                    }}
                  >
                    <FaPlayCircle />
                    <div className="space">
                      <div>
                        {parsed.title} {parsed.year && `(${parsed.year})`}
                        {parsed.season && `S${parsed.season.toString().padStart(2, '0')}`}
                        {parsed.episode && `E${parsed.episode.toString().padStart(2, '0')}`}
                      </div>
                      <div>{parsed.resolution && `[${parsed.resolution}${parsed.cam ? '-CAM' : ''}]`}</div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <Spinner visible />
          )}
        </div>
      </div>
    );
  }
}

export default Stream;
