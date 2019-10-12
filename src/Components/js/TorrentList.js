import React, { Component, Fragment } from 'react';

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
                {torrents.length === 0 ? <h3>No Active Downloads</h3> : (
                    <Fragment>
                        <h3>Downloads ( {sorted.length} )</h3>
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
                    </Fragment>
                )}
            </div>
        );
    }
}

export default TorrentList;