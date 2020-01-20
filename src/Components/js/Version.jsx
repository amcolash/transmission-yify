import React, { Component } from 'react';
import { FaDownload, FaBatteryEmpty, FaBatteryQuarter, FaBatteryHalf, FaBatteryFull } from 'react-icons/fa';

import Spinner from './Spinner';
import Progress from './Progress';
import '../css/Version.css';

class Version extends Component {
  render() {
    const { version, started, getProgress, getTorrent, downloadTorrent, cancelTorrent, hideInfo, hideBar } = this.props;

    return (
      <div className="version padding" key={version.hashString}>
        <div className="qualityPeers">
          <b>{version.quality}</b>
          {version.seeds !== undefined || version.hs ? (
            <span className="peers">
              {version.hs ? (
                <FaBatteryQuarter className="purple" />
              ) : version.seeds === 0 ? (
                <FaBatteryEmpty className="gray" />
              ) : version.seeds < 20 ? (
                <FaBatteryQuarter className="red" />
              ) : version.seeds < 50 ? (
                <FaBatteryHalf className="orange" />
              ) : (
                <FaBatteryFull className="green" />
              )}
            </span>
          ) : null}
        </div>
        <div className="leftMargin">
          {getProgress(version.hashString) ? (
            <Progress
              torrent={getTorrent(version.hashString)}
              cancelTorrent={cancelTorrent}
              getProgress={getProgress}
              hideInfo={hideInfo}
              hideBar={hideBar}
            />
          ) : (
            <button className="orange download" onClick={() => downloadTorrent(version)} title={version.filename} /*url={version.url}*/>
              {started.indexOf(version.hashString) !== -1 ? <Spinner visible noMargin button /> : <FaDownload />}
            </button>
          )}
        </div>
      </div>
    );
  }
}

export default Version;
