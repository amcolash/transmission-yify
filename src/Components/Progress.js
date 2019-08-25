import React, { Component } from 'react';
import {
    FaTrash, FaExclamationCircle
} from 'react-icons/lib/fa';
import * as  ptn  from 'parse-torrent-name';

class Progress extends Component {
    
    render() {
        const { torrent, cancelTorrent, fullName, getProgress } = this.props;

        if (!torrent || !torrent.name) return null;

        const parsed = ptn(torrent.name);
        const season = parsed.season ? `S${parsed.season.toString().padStart(2, '0')}` : '';
        const episode = parsed.season ? `E${parsed.episode.toString().padStart(2, '0')} ` : '';
        const year = parsed.year ? ` (${parsed.year})` : '';
        const resolution = parsed.resolution ? ` [${parsed.resolution}]` : (parsed.excess && parsed.excess.includes('[3D]') ? '[3D]' : '');
        const parsedName = `${parsed.title} ${season}${episode} ${year} ${resolution}`.replace(/\s+/g,' ').trim(); // Add it all up and trim extra spaces

        const name = fullName ? torrent.name : parsedName;//torrent.name.substring(0, torrent.name.indexOf(")") + 1) + (type ? " [" + type + "]" : "");
        const speed = (torrent.rateDownload / 1024 / 1024).toFixed(2);
        const progress = getProgress(torrent.hashString);
        const peers = torrent.peersSendingToUs;

        return (
            <div className="progress">
                <span>{name}</span>
                <progress value={progress > 1 ? progress : null } max="100" />
                <span>{progress}% </span>
                {progress < 99 ? (
                    <span className={speed > 0.25 ? "green" : speed > 0.125 ? "orange" : "red"}>
                        {speed < 0.15 ? (
                            <FaExclamationCircle
                                style={{ paddingRight: "0.25em" }}
                            />
                        ) : null}
                        [{speed} MB/s], peers: {peers}
                    </span>
                ) : null}
                <button className="red" onClick={() => cancelTorrent(torrent.hashString)}><FaTrash/></button>
            </div>
        );
    }
}

export default Progress;