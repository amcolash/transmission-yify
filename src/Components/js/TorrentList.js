import React, { Component } from 'react';

import Progress from './Progress';
import '../css/TorrentList.css';

class TorrentList extends Component {
    render() {
        const { cancelTorrent, torrents, getProgress } = this.props;

        const sorted = torrents.sort((a, b) => {
            const progressA = getProgress(a.hashString);
            const progressB = getProgress(b.hashString);

            if (progressA === progressB) return a.name.localeCompare(b.name);
            else return progressA - progressB;
        });

        return (
            <div className="torrentList">
                {torrents.length === 0 ? <h2>No Active Downloads</h2> : <h2>Downloads ({sorted.length})</h2>}
                <div>
                    {(sorted.map(torrent => (
                        <Progress
                            key={torrent.hashString}
                            torrent={torrent}
                            cancelTorrent={cancelTorrent}
                            getProgress={getProgress}
                            fullName={false}
                        />
                    )))}
                </div>
            </div>
        );
    }
}

export default TorrentList;