import React, { Component } from 'react';
import  { FaDownload, FaBatteryEmpty, FaBatteryQuarter, FaBatteryHalf, FaBatteryFull } from 'react-icons/fa';

import Spinner from './Spinner';
import Progress from './Progress';
import '../css/Version.css';

class Version extends Component {
    render() {
        const { version, started, getProgress, getLink, getTorrent, downloadTorrent, cancelTorrent } = this.props;
        
        return (
            <div className={"version" + (version.peers ? "" : " inline padding")} key={version.url}>
                <div className='qualityPeers'>
                    <b>{version.quality}</b>
                    <span className='peers'>
                        {
                            version.seeds === 0 ? <FaBatteryEmpty className='gray'/> :
                            version.seeds < 20 ? <FaBatteryQuarter className='red'/> :
                            version.seeds < 50 ? <FaBatteryHalf className='orange'/> :
                                                <FaBatteryFull className='green'/>
                        }
                    </span>
                </div>
                {getProgress(version.hashString) ? (
                    <Progress
                        torrent={getTorrent(version.hashString)}
                        getLink={getLink}
                        cancelTorrent={cancelTorrent}
                        getProgress={getProgress}
                    />
                ) : (
                    <button className="orange download" onClick={() => downloadTorrent(version)} url={version.url}>
                        {started.indexOf(version.hashString) !== -1 ? (
                            <Spinner visible noMargin button />
                        ) : (
                            <FaDownload/>
                        )}
                    </button>
                )}
            </div>
        );
    }
}

export default Version;