import React, { Component, Fragment } from 'react';
import axios from 'axios';
import { DebounceInput } from 'react-debounce-input';
import Modal from 'react-responsive-modal';


import './MovieList.css';
import Movie from './Movie';
import Spinner from './Spinner';
import Details from './Details';
import TorrentList from './TorrentList';

class MovieList extends Component {

    constructor(props) {
        super(props);

        this.state = {
            error: null,
            isLoaded: false,
            isSearching: false,
            movies: [],
            search: '',
            page: 1,
            totalPages: 1,
            modal: false,
            movie: {},
            torrents: []
        }

        this.getTorrent = this.getTorrent.bind(this);
        this.getProgress = this.getProgress.bind(this);

        this.server = window.location.hostname + ":9000";
        if (this.server.indexOf("localhost") !== -1) {
            this.server = "http://" + this.server;
        }
    }

    componentDidMount() {
        this.updateData();

        // First update, then schedule polling
        this.updateTorrents();
        setInterval(() => this.updateTorrents(), 5000); // Poll torrents every 5 seconds (might be overkill)
    }

    updateTorrents() {
        axios.get(this.server + '/torrents').then(response => {
            this.setState({ torrents: response.data });
        }, error => {
            console.error(error);
        });
    }

    updateData() {
        this.setState({
            isSearching: true
        });

        const limit = 20;
        const query = this.state.search;
        const page = this.state.page;
        const params = 'limit=' + limit + '&page=' + page + (query.length > 0 ? '&sort_by=title&order_by=asc&query_term=' + query : '');
        const ENDPOINT = 'https://yts.am/api/v2/list_movies.json?' + params;

        axios.get(ENDPOINT).then(response => {
            const data = response.data.data;
            const total = data.movie_count;
            const totalPages = Math.ceil(total / limit);

            this.setState({
                movies: data.movies,
                isLoaded: true,
                isSearching: false,
                totalPages: totalPages
            });
        }, error => {
            this.setState({
                error: error,
                isLoaded: true,
                isSearching: false,
            });
        });
    }

    cancelTorrent = (infoHash) => {
        axios.delete(this.server + '/torrents/' + infoHash).then(response => {
            this.updateTorrents();
        }, error => {
            console.error(error);
        });
    }

    downloadTorrent = (version) => {
        axios.post(this.server + '/torrents', { link: version.url }).then(response => {
            this.updateTorrents();
        }, error => {
            console.error(error);
        });
    }

    getVersions(movie) {
        var versions = [];

        for (var i = 0; i < movie.torrents.length; i++) {
            const torrent = movie.torrents[i];
            versions.push({
                quality: torrent.quality,
                peers: torrent.peers.toFixed(0),
                seeds: torrent.seeds.toFixed(0),
                ratio: (torrent.peers / torrent.seeds).toFixed(3),
                url: torrent.url,
                infoHash: torrent.hash.toLowerCase(),
                size: torrent.size
            });
        }

        return versions;
    }

    getTorrent(infoHash) {
        for (var i = 0; i < this.state.torrents.length; i++) {
            const torrent = this.state.torrents[i];
            if (torrent.infoHash === infoHash) return torrent;
        }

        return null;
    }

    getProgress(infoHash) {
        const torrent = this.getTorrent(infoHash);
        return torrent !== null ? torrent.progress[0] + 0.001 : null;
    }

    openLink = (infoHash) => {
        const { torrents } = this.state;

        for (var i = 0; i < torrents.length; i++) {
            const torrent = torrents[i];
            if (torrent.infoHash === infoHash) {
                var largestSize = 0;
                var largestIndex = 0;

                for (var j = 0; j < torrent.files.length; j++) {
                    const file = torrent.files[j];
                    if (file.length > largestSize) {
                        largestIndex = j;
                        largestSize = file.length;
                    }
                }

                window.open(this.server + torrent.files[largestIndex].link);
                return;
            }
        }
    }

    onOpenModal = (movie) => {
        this.setState({ movie: movie, modal: true });
    };

    onCloseModal = () => {
        this.setState({ modal: false });
    };

    changeSearch(newValue) {
        this.setState({ search: newValue, page: 1 }, () => this.updateData());
    }

    changePage(direction) {
        const { page, totalPages } = this.state;
        var newPage = direction + page;
        if (newPage < 1 || newPage > totalPages) return;

        this.setState({ page: newPage }, () => this.updateData());
    }

    render() {
        const { error, isLoaded, movies, modal, movie, page, totalPages, torrents, search, isSearching } = this.state;

        if (error) {
            return <div className="message">Error: {error.message}</div>;
        } else if (!isLoaded) {
            return (
            <div className="message">
                <span>Loading...</span>
                <Spinner visible={true}/>
            </div>
            );
        } else {
            return (
                <Fragment>
                    <Modal open={modal} onClose={this.onCloseModal} center>
                        <Details
                            movie={movie}
                            server={this.server}
                            torrents={torrents}
                            updateTorrents={this.updateTorrents}
                            cancelTorrent={this.cancelTorrent}
                            downloadTorrent={this.downloadTorrent}
                            openLink={this.openLink}
                            getProgress={this.getProgress}
                            getTorrent={this.getTorrent}
                            getVersions={this.getVersions}
                        />
                    </Modal>
            
                    <TorrentList
                        torrents={torrents}
                        cancelTorrent={this.cancelTorrent}
                        openLink={this.openLink}
                    />

                    <div className="search">
                        <label>
                            Search
                            <DebounceInput
                                value={search}
                                minLength={2}
                                debounceTimeout={500}
                                onChange={event => this.changeSearch(event.target.value) }
                            />
                            <button className="red" onClick={() => this.changeSearch('') }>✖</button>
                        </label>

                        <Spinner visible={isSearching} />
                    </div>

                    {search.length === 0 ? (
                        <h2>Recently Uploaded</h2>
                    ) : null}

                    <div className="movie-list">
                        {(movies && movies.length > 0) ? (
                            movies.map(movie => (
                                <Movie
                                    key={movie.id}
                                    movie={movie}
                                    click={this.onOpenModal}
                                    downloadTorrent={this.downloadTorrent}
                                    cancelTorrent={this.cancelTorrent}
                                    torrents={this.torrents}
                                    getProgress={this.getProgress}
                                    getVersions={this.getVersions}
                                />
                            ))
                        ) :
                            <div className="message">No Results</div>
                        }
                    </div>

                    {(movies && movies.length > 0) ? (
                        <div className="pager">
                            {page > 1 ? (
                                <span className="arrow" onClick={() => this.changePage(-1)}>⇦</span>
                            ) : null}
                            
                            <span>{page}</span>
                            
                            {page < totalPages ? (
                                <span className="arrow" onClick={() => this.changePage(1)}>⇨</span>
                            ) : null}

                            <Spinner visible={isSearching} />
                        </div>
                    ) : null}
                </Fragment>
            );
        }
    }
}

export default MovieList;