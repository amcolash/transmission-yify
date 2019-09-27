import React, { Component } from 'react';
import { FaPlus, FaMinus } from 'react-icons/fa';

import Progress from './Progress';
import '../css/TorrentList.css';

class TorrentList extends Component {
    constructor(props) {
        super(props);

        this.state = { collapsed: true };
    }

    expand() {
        this.setState({ collapsed: false });
    }

    collapse() {
        this.setState({ collapsed: true });
    }

    toggleCollapse() {
        this.setState({ collapsed: !this.state.collapsed });
    }

    render() {
        const { cancelTorrent, torrents, getProgress } = this.props;

        if (torrents.length === 0) return null;

        const sorted = torrents.sort((a, b) => {
            const progressA = getProgress(a.hashString);
            const progressB = getProgress(b.hashString);

            if (progressA === progressB) return a.name.localeCompare(b.name);
            else return progressA - progressB;
        });

        return (
            <div className="torrentList">
                <h3>
                    <span>Downloads ({sorted.length})</span>
                    <button onClick={ () => this.toggleCollapse() }>
                        {this.state.collapsed ? <FaPlus/> : <FaMinus/>}
                    </button>
                </h3>

                {!this.state.collapsed ? (
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
                ) : null}
                <hr/>
            </div>
        );
    }
}

export default TorrentList;