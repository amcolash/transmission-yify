import React, { Component } from 'react';
import { FaBatteryEmpty, FaBatteryQuarter, FaBatteryHalf, FaBatteryFull, FaDownload } from 'react-icons/fa';
import magnet from 'magnet-uri';

import Progress from  './Progress';
import Spinner from './Spinner';
import '../css/Pirate.css';

class Pirate extends Component {
    render() {
      const { media, cancelTorrent, downloadTorrent, getLink, getProgress, getTorrent, started } = this.props;

      if (!media.magnetLink) return null;

      const hashString = magnet.decode(media.magnetLink).infoHash.toLowerCase();
      const version = {
        title: media.name,
        url: media.magnetLink,
        hashString
      };

      return <div className="pirateRow">
        <div className='peers'>
          {
            media.seeds === 0 ? <FaBatteryEmpty className='gray'/> :
            media.seeds < 20 ?  <FaBatteryQuarter className='red'/> :
            media.seeds < 50 ?  <FaBatteryHalf className='orange'/> :
                                <FaBatteryFull className='green'/>
          }
        </div>
        
        <div className="title">{media.name}</div>
        <div className="spacer"></div>

        <div className="dl">
          {getProgress(hashString) ? (
            <Progress
              torrent={getTorrent(hashString)}
              getLink={getLink}
              cancelTorrent={cancelTorrent}
              getProgress={getProgress}
              hideInfo
            />
          ) : (
            <button className="orange download" onClick={() => downloadTorrent(version)}>
              {started.indexOf(hashString) !== -1 ? (
                <Spinner visible noMargin button />
              ) : (
                <FaDownload/>
              )}
            </button>
          )}
        </div>
      </div>;
    }
}

export default Pirate;