import '../css/Pirate.css';

import magnet from 'magnet-uri';
import React, { Component } from 'react';
import { FaBatteryEmpty, FaBatteryFull, FaBatteryHalf, FaBatteryQuarter, FaDownload } from 'react-icons/fa';

import Progress from './Progress';
import Spinner from './Spinner';

class Pirate extends Component {
  render() {
    const { media, cancelTorrent, downloadTorrent, getProgress, getTorrent, started } = this.props;

    if (!media.magnetLink) return null;

    const hashString = magnet.decode(media.magnetLink).infoHash.toLowerCase();
    const version = {
      title: media.name,
      url: media.magnetLink,
      hashString,
    };

    let size, units;

    if (media.size) {
      units = media.size.match(/[A-Za-z]+/)[0].replace('i', '');
      size = Number.parseFloat(media.size.match(/\d+\.?\d*/)[0]);
      size = size < 10 ? size.toFixed(2) : size < 100 ? size.toFixed(1) : size.toFixed(0);
    }

    return (
      <div className="pirateRow">
        <div className="categories">
          <div className="category">{media.category}</div>
          <div className="subcategory">{media.subCategory}</div>
        </div>
        <div className="peers">
          {media.seeds === 0 ? (
            <FaBatteryEmpty className="gray" />
          ) : media.seeds < 20 ? (
            <FaBatteryQuarter className="red" />
          ) : media.seeds < 50 ? (
            <FaBatteryHalf className="orange" />
          ) : (
            <FaBatteryFull className="green" />
          )}
        </div>

        <div className="title" title={media.name}>
          {media.name}
        </div>
        <div className="spacer"></div>
        <div className="size">{size + ' ' + units}</div>

        <div className="dl">
          {getProgress(hashString) ? (
            <Progress torrent={getTorrent(hashString)} cancelTorrent={cancelTorrent} getProgress={getProgress} hideInfo />
          ) : (
            <button className="orange download" onClick={() => downloadTorrent(version, true)}>
              {started.indexOf(hashString) !== -1 ? <Spinner visible noMargin button /> : <FaDownload />}
            </button>
          )}
        </div>
      </div>
    );
  }
}

export default Pirate;
