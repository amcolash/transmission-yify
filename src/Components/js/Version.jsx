import '../css/Version.css';

import React, { Component, createRef } from 'react';
import { FaBatteryEmpty, FaBatteryFull, FaBatteryHalf, FaBatteryQuarter, FaDownload } from 'react-icons/fa';

import { focusItem } from '../../Util/Focus';
import { hasParent } from '../../Util/Util';
import Progress from './Progress';
import Spinner from './Spinner';

class Version extends Component {
  constructor(props) {
    super(props);
    this.ref = createRef();
  }

  getSnapshotBeforeUpdate(prevProps, prevState) {
    // If the download/delete button has focus right before the component is re-rendered
    return {
      update:
        (document.activeElement.classList.contains('orange') || document.activeElement.classList.contains('red')) &&
        hasParent(document.activeElement, this.ref.current),
      el: document.activeElement,
    };
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // If the download/delete button was focused before re-render, then re-focus since there is a component swap
    if (snapshot.update && snapshot.el !== document.activeElement) {
      focusItem(this.ref.current, 0);
    }
  }

  render() {
    const { version, started, getProgress, getTorrent, downloadTorrent, cancelTorrent, hideInfo, hideBar } = this.props;

    return (
      <div className="version padding" key={version.hashString} ref={this.ref}>
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
            <button className="orange download" onClick={() => downloadTorrent(version)} title={version.filename}>
              {started.indexOf(version.hashString) !== -1 ? <Spinner visible noMargin button /> : <FaDownload />}
            </button>
          )}
        </div>
      </div>
    );
  }
}

export default Version;
