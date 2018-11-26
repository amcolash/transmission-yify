import React, { Component, Fragment } from 'react';
import axios from 'axios';
import Modal from 'react-responsive-modal';
import {
    FaAngleDoubleRight, FaAngleDoubleLeft, FaAngleRight, FaAngleLeft, FaExclamationTriangle
} from 'react-icons/lib/fa';

import './MovieList.css';
import Movie from './Movie';
import Spinner from './Spinner';
import Details from './Details';
import TorrentList from './TorrentList';
import Plex from './Plex';
import Search from './Search';

const searchCache = [];

class MovieList extends Component {

    constructor(props) {
        super(props);

        this.state = {
            error: null,
            isLoaded: false,
            movies: [],
            totalMovies: 0,
            page: 1,
            totalPages: 1,
            modal: false,
            movie: {},
            torrents: [],
            started: [],
            search: '',
            genre: '',
            order: 'last added',
            isSearching: false,
            storage: null,
            width: 0,
            height: 0
        }

        this.updateSearch = this.updateSearch.bind(this);
        this.getTorrent = this.getTorrent.bind(this);
        this.getProgress = this.getProgress.bind(this);
        this.updateWindowDimensions = this.updateWindowDimensions.bind(this);

        this.server = "http://" + window.location.hostname + ":9000";
    }
    
    componentDidMount() {
        this.updateData();
        
        this.updateLocation();
        
        // First update for torrents
        this.updateTorrents();

        this.updateWindowDimensions();
        window.addEventListener('resize', this.updateWindowDimensions);
    }
    
    componentWillUnmount() {
        window.removeEventListener('resize', this.updateWindowDimensions);
    }

    updateWindowDimensions() {
        this.setState({ width: window.innerWidth, height: window.innerHeight });
    }

    updateLocation() {
        // If the server is not patched or something goes wrong, no worries
        axios.get(this.server + '/ip').then(response => {
            this.setState({ location: response.data.city + ', ' + response.data.country_name });
        }, error => {
            console.error(error);
        });
    }

    updateTorrents() {
        axios.get(this.server + '/torrents').then(response => {
            const torrents = response.data.torrents ? response.data.torrents.filter(torrent => {
                return torrent.downloadDir.indexOf("/data") !== -1 || true; // NO_COMMIT
            }) : [];

            const started = this.state.started.filter(hashString => {
                for (var i = 0; i < torrents.length; i++) {
                    if (torrents[i].hashString === hashString) return false;
                }
                return true;
            });

            this.setState({
                torrents: torrents,
                started: started
            });

            setTimeout(() => this.updateTorrents(), 5000); // Poll torrents every 5 seconds (might be overkill)
        }, error => {
            console.error(error);
            setTimeout(() => this.updateTorrents(), 60000); // Poll again in 1 minute since it seems server is down
        });

        // Additionally get storage info here
        axios.get(this.server + '/storage').then(response => {
            var percent = response.data.used;
            try {
                this.setState({ storage: parseFloat(percent).toFixed(1) });
            } catch (err) {
                console.error(err);
            }
        }, error => {
            console.error(error);
        });
    }

    updateSearch(search, genre, order, quality) {
        this.setState({
            search: search,
            genre: genre,
            order: order,
            quality: quality,
            page: 1,
        }, () => this.updateData());
    }
    
    updateData() {
        const { search, page, genre, order } = this.state;
        
        this.setState({
            isSearching: true
        });

        const direction = order === 'title' ? '1' : '-1';
        const type = 'movies';
        const params = (search.length > 0 ? '&keywords=' + search : '') +
            '&sort=' + order + '&order=' + direction +
            (genre.length > 0 ? '&genre=' + genre : '');
        const ENDPOINT = 'https://tv-v2.api-fetch.website/' + type + '/' + page + '?' + params;

        window.scrollTo(0, 0);
        if (searchCache[ENDPOINT]) {
            this.handleData(searchCache[ENDPOINT]);
        } else {
            axios.get(ENDPOINT).then(response => {
                searchCache[ENDPOINT] = response.data;
                this.handleData(response.data);
            }, error => {
                this.setState({
                    error: error,
                    isLoaded: true,
                    isSearching: false,
                });
            });
        }
    }

    handleData(data) {
        // const total = data.movie_count;
        // const totalPages = Math.ceil(total / limit);

        // fix weird years (since it seems the year can vary based on region released first)
        var now = new Date().getFullYear();
        data.map(movie => {
            movie.year = Math.min(now, movie.year);
            return movie;
        });

        this.setState({
            movies: data,
            isLoaded: true,
            isSearching: false,
            totalPages: 1,
            totalMovies: 0
        });
    }

    cancelTorrent = (hashString) => {
        axios.delete(this.server + '/torrents/' + hashString).then(response => {
            this.updateTorrents();
        }, error => {
            console.error(error);
        });
    }

    downloadTorrent = (version) => {
        this.setState({
            started: [ ...this.state.started, version.hashString ]
        });

        axios.post(this.server + '/torrents', { url: version.url }).then(response => {
            this.updateTorrents();
        }, error => {
            console.error(error);
        });

        this.torrentList.expand();
    }

    getVersions(movie) {
        var versions = {};

        if (movie.torrents) {
            for (var i = 0; i < movie.torrents.length; i++) {
                const torrent = movie.torrents[i];

                let version = {
                    quality: torrent.quality,
                    peers: torrent.peers.toFixed(0),
                    seeds: torrent.seeds.toFixed(0),
                    ratio: torrent.peers > 0 ? (torrent.seeds / torrent.peers).toFixed(3) : 0,
                    url: torrent.url,
                    hashString: torrent.hash.toLowerCase(),
                    size: torrent.size
                };

                if (!versions[version.quality] || versions[version.quality].ratio < version.ratio) {
                    versions[version.quality] = version;
                }
            }
        }

        return Object.values(versions);
    }

    getTorrent(hashString) {
        for (var i = 0; i < this.state.torrents.length; i++) {
            const torrent = this.state.torrents[i];
            if (torrent.hashString === hashString) return torrent;
        }

        return null;
    }

    getProgress(hashString) {
        const torrent = this.getTorrent(hashString);
        return (torrent !== null) ? (torrent.percentDone * 100).toFixed(0) : null;
    }

    onOpenModal = (movie) => {
        this.setState({ movie: movie, modal: true });
    };

    onCloseModal = () => {
        this.setState({ modal: false });
    };

    changePage(direction) {
        const { page, totalPages } = this.state;
        var newPage = direction + page;
        if (page === newPage) return;
        if (newPage < 1) newPage = 1;
        if (newPage > totalPages) newPage = totalPages;

        this.setState({ page: newPage }, () => this.updateData());
    }

    render() {
        const {
            error, isLoaded, movies, modal, movie, page, totalPages, torrents, isSearching, location,
            totalMovies, started, width, storage
        } = this.state;

        if (error) {
            return <div className="message">Error: {error.message}</div>;
        } else if (!isLoaded) {
            return (
            <div className="message">
                <span>Loading...</span>
                <Spinner visible/>
            </div>
            );
        } else {
            return (
                <Fragment>
                    <Plex server={this.server}/>
                    <Modal open={modal} onClose={this.onCloseModal} center={width > 800}>
                        <Details
                            movie={movie}
                            server={this.server}
                            torrents={torrents}
                            started={started}
                            updateTorrents={this.updateTorrents}
                            cancelTorrent={this.cancelTorrent}
                            downloadTorrent={this.downloadTorrent}
                            getProgress={this.getProgress}
                            getTorrent={this.getTorrent}
                            getVersions={this.getVersions}
                        />
                    </Modal>
            
                    {location === "Seattle, United States" ? (
                        <span className="warning red">
                            <FaExclamationTriangle/>
                            <span>Server not secure</span>
                        </span>
                    ) : null}

                    <TorrentList
                        torrents={torrents}
                        cancelTorrent={this.cancelTorrent}
                        getLink={this.getLink}
                        getProgress={this.getProgress}
                        ref={instance => { this.torrentList = instance; }}
                    />

                    <Search
                        updateSearch={this.updateSearch}
                        isSearching={this.state.isSearching}
                        search={this.state.search}
                        genre={this.state.genre}
                        quality={this.state.quality}
                        order={this.state.order}
                        page={this.state.page}
                    />

                    <h2>{totalMovies} Movies</h2>

                    <div className="movie-list">
                        {(movies && movies.length > 0) ? (
                            movies.map(movie => (
                                movie.torrents ? (
                                    <Movie
                                        key={movie._id}
                                        movie={movie}
                                        click={this.onOpenModal}
                                        downloadTorrent={this.downloadTorrent}
                                        cancelTorrent={this.cancelTorrent}
                                        torrents={this.torrents}
                                        started={started}
                                        getProgress={this.getProgress}
                                        getVersions={this.getVersions}
                                        server={this.server}
                                    />
                                ) : null
                            ))
                        ) :
                            <div className="message">No Results</div>
                        }
                    </div>

                    {(movies && movies.length > 0) ? (
                        <div className="pager">
                            <FaAngleDoubleLeft
                                className="arrow"
                                style={{ visibility: page > 1 ? "visible" : "hidden" }}
                                onClick={() => this.changePage(-5)}
                            />
                            <FaAngleLeft
                                className="arrow"
                                style={{ visibility: page > 1 ? "visible" : "hidden" }}
                                onClick={() => this.changePage(-1)}
                            />
                            <span>{page}</span>
                            <FaAngleRight
                                className="arrow"
                                style={{ visibility: page < totalPages ? "visible" : "hidden" }}
                                onClick={() => this.changePage(1)}
                            />
                            <FaAngleDoubleRight
                                className="arrow"
                                style={{ visibility: page < totalPages ? "visible" : "hidden" }}
                                onClick={() => this.changePage(5)}
                            />

                            <br/>
                            
                            <Spinner visible={isSearching} noMargin />

                            <div className="footer">
                                {location ? (
                                    <Fragment>
                                        <br/>
                                        <br/>
                                        <span className="location">Server Location: {location}</span>
                                    </Fragment>
                                ) : null}
                                <br/>
                                <br/>
                                {storage ? (
                                    <Fragment>
                                        <span>Disk Usage: {storage}%</span>
                                        <progress value={storage} max="100"/>
                                    </Fragment>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </Fragment>
            );
        }
    }
}

export default MovieList;