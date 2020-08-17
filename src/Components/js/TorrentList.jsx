import '../css/TorrentList.css';

import React, { Component, createRef } from 'react';

import { focusToIndex, getFocusIndex, getFocusable } from '../../Util/Focus';
import { hasParent } from '../../Util/Util';
import Progress from './Progress';

class TorrentList extends Component {
  constructor(props) {
    super(props);
    this.state = { filter: true };
    this.ref = createRef();
  }

  getSnapshotBeforeUpdate(prevProps, prevState) {
    // If the download/delete button has focus right before the component is re-rendered
    const isFocused = document.activeElement.classList.contains('red') && hasParent(document.activeElement, this.ref.current);
    return {
      index: isFocused ? getFocusIndex(getFocusable(this.ref.current), document.activeElement, true) : -1,
      el: document.activeElement,
    };
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // If the download/delete button was focused before re-render, then re-focus since there is a component swap
    if (snapshot.index !== -1 && snapshot.el !== document.activeElement) {
      focusToIndex(this.ref.current, snapshot.index);
    }
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
        <div className="innerList" ref={this.ref}>
          {sorted.map((torrent) => (
            <Progress key={torrent.hashString} torrent={torrent} cancelTorrent={cancelTorrent} getProgress={getProgress} fullName={true} />
          ))}
        </div>
      </div>
    );
  }
}

export default TorrentList;
