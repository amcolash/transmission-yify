import '../css/TorrentList.css';

import React, { Component } from 'react';

import Progress from './Progress';

class TorrentList extends Component {
  constructor(props) {
    super(props);

    this.state = { filter: true };
  }

  render() {
    const { cancelTorrent, torrents, getProgress } = this.props;

    const filteredTorrents = this.state.filter ? torrents.filter((t) => t.percentDone < 1) : torrents;
    const sorted = filteredTorrents.sort((a, b) => {
      const progressA = getProgress(a.hashString);
      const progressB = getProgress(b.hashString);

      if (progressA === progressB) return a.name.localeCompare(b.name);
      else return progressA - progressB;
    });

    return (
      <div className="torrentList">
        {torrents.length === 0 ? <h2>No Active Downloads</h2> : <h2>Downloads ({sorted.length})</h2>}
        <label htmlFor="filter">Filter Completed?</label>
        <input type="checkbox" id="filter" checked={this.state.filter} onChange={(e) => this.setState({ filter: e.target.checked })} />
        <div className="innerList">
          {sorted.map((torrent) => (
            <Progress key={torrent.hashString} torrent={torrent} cancelTorrent={cancelTorrent} getProgress={getProgress} fullName={true} />
          ))}
        </div>
      </div>
    );
  }
}

export default TorrentList;
