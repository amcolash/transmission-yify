import '../css/Progress.css';

import React, { Component, Fragment } from 'react';
import { FaExclamationCircle, FaTrash } from 'react-icons/fa';

import * as ptn from '../../Util/TorrentName';

class Progress extends Component {
  render() {
    const { torrent, cancelTorrent, fullName, getProgress, hideInfo, hideBar } = this.props;

    if (!torrent || !torrent.name) return null;

    const parsed = ptn(torrent.name);
    const season = parsed.season ? `S${parsed.season.toString().padStart(2, '0')}` : '';
    const episode = parsed.episode ? `E${parsed.episode.toString().padStart(2, '0')} ` : '';
    const year = parsed.year ? ` (${parsed.year})` : '';
    const resolution = parsed.resolution ? ` [${parsed.resolution}]` : '';
    const parsedName = `${parsed.title} ${season}${episode} ${year} ${resolution}`.replace(/\s+/g, ' ').trim(); // Add it all up and trim extra spaces

    const name = fullName ? torrent.name : parsedName; //torrent.name.substring(0, torrent.name.indexOf(")") + 1) + (type ? " [" + type + "]" : "");
    const speed = (torrent.rateDownload / 1024 / 1024).toFixed(2);
    const progress = getProgress(torrent.hashString);
    const peers = torrent.peersSendingToUs;

    return (
      <div className={!hideInfo ? 'progressFull' : 'progress'}>
        {hideInfo ? null : (
          <Fragment>
            <div className="filename">{name}</div>
            <div className="spacer"></div>
          </Fragment>
        )}
        {!hideInfo && progress < 99 ? (
          <div className={'status ' + (speed > 0.25 ? 'green' : speed > 0.05 ? 'orange' : 'red')}>
            {speed < 0.05 ? <FaExclamationCircle /> : null}
            {speed} MB/s, peers: {peers}
          </div>
        ) : null}
        {hideBar ? null : (
          <Fragment>
            <progress value={progress > 0 ? progress : null} max="100" />
            <div className="percent">{progress}% </div>
          </Fragment>
        )}
        <button className="red" onClick={() => cancelTorrent(torrent.hashString, true)}>
          <FaTrash />
        </button>
        {/* {progress >= 100 ? <button className="green" onClick={() => cancelTorrent(torrent.hashString, false)}><FaArchive/></button> : null} */}
      </div>
    );
  }
}

export default Progress;
