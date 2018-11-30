import React, { Component, Fragment } from 'react';
import axios from 'axios';
import magnet from 'magnet-uri';
import Modal from 'react-responsive-modal';
import {
    FaAngleDoubleRight, FaAngleDoubleLeft, FaAngleRight, FaAngleLeft, FaExclamationTriangle
} from 'react-icons/lib/fa';

import './MovieList.css';
import Cover from './Cover';
import Spinner from './Spinner';
import Details from './Details';
import TorrentList from './TorrentList';
import Plex from './Plex';
import Search from './Search';
import Beta from './Beta';

const searchCache = [];
const hashMapping = {};
const alternateVersion = {};
var torrentUpdateTimer;

class MovieList extends Component {

    constructor(props) {
        super(props);

        this.state = {
            error: null,
            isLoaded: false,
            movies: [],
            page: 1,
            modal: false,
            movie: {},
            torrents: [],
            started: [],
            search: '',
            genre: '',
            quality: 'All',
            order: 'last added',
            type: 'movies',
            isSearching: false,
            storage: null,
            serverStats: null,
            width: 0,
            height: 0,
            docker: true
        }

        this.updateSearch = this.updateSearch.bind(this);
        this.getTorrent = this.getTorrent.bind(this);
        this.getProgress = this.getProgress.bind(this);
        this.updateWindowDimensions = this.updateWindowDimensions.bind(this);

        this.server = "http://" + window.location.hostname + ":9000";
    }
    
    componentDidMount() {
        // Get movie list
        this.updateData();
        this.updateStats();
        
        // Get data from server
        this.updateLocation();
        this.updateDocker();

        // First update for torrents
        this.updateTorrents();

        // Update window size
        this.updateWindowDimensions();
        window.addEventListener('resize', this.updateWindowDimensions);
    }
    
    componentWillUnmount() {
        window.removeEventListener('resize', this.updateWindowDimensions);
    }

    updateWindowDimensions() {
        this.setState({ width: window.innerWidth, height: window.innerHeight });
    }

    updateDocker() {
        axios.get(this.server + '/docker').then(response => {
            this.setState({ docker: response.data });
        }, error => {
            console.error(error);
        });
    }

    updateLocation() {
        axios.get(this.server + '/ip').then(response => {
            this.setState({ location: response.data.city + ', ' + response.data.country_name });
        }, error => {
            console.error(error);
        });
    }

    updateStats() {
        axios.get('https://tv-v2.api-fetch.website/status?').then(response => {
            this.setState({ serverStats: response.data });
        }, error => {
            console.error(error);
        });
    }

    updateTorrents() {
        if (torrentUpdateTimer) clearTimeout(torrentUpdateTimer);

        axios.get(this.server + '/torrents').then(response => {
            var torrents = response.data.torrents || [];
            if (this.state.docker) {
                torrents = torrents.filter(torrent => {
                    return torrent.downloadDir.indexOf("/data") !== -1 || torrent.downloadDir.indexOf("/TV") !== -1;
                });
            }

            torrents.map(torrent => {
                if (torrent.eta < 0 && hashMapping[torrent.hashString]) {
                    torrent.name = hashMapping[torrent.hashString];
                }
                return torrent;
            });

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

            torrentUpdateTimer = setTimeout(() => this.updateTorrents(), 5000); // Poll torrents every 5 seconds (might be overkill)
        }, error => {
            console.error(error);
            torrentUpdateTimer = setTimeout(() => this.updateTorrents(), 60000); // Poll again in 1 minute since it seems server is down
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

    updateSearch(search, genre, order, quality, type, page) {
        this.setState({
            search: search,
            genre: genre,
            order: order,
            quality: quality,
            type: type,
            page: page || this.state.page,
        }, () => this.updateData());
    }
    
    updateData() {
        const { search, page, genre, order, type } = this.state;
        
        this.setState({
            isSearching: true
        });

        const direction = order === 'title' ? '1' : '-1';
        const params = (search.length > 0 ? '&keywords=' + search : '') +
            '&sort=' + order + '&order=' + direction +
            (genre.length > 0 ? '&genre=' + genre : '');
        const ENDPOINT = 'https://tv-v2.api-fetch.website/' + type + '/' + page + '?' + params;

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

        // Only show movies with enough ratings to be useful
        if (this.state.order === 'rating') {
            data = data.filter(movie => {
                return movie.rating.votes > 10;
            });
        }

        if (this.state.quality === "3D") {
            this.get3D(data);
        } else {
            this.setState({
                movies: data,
                isLoaded: true,
                isSearching: false
            });
        }
    }

    get3D(movies) {
            const YIFY_ENDPOINT = 'https://yts.am/api/v2/list_movies.json?query_term=';
            
            var promises = [];
            for (var i = 0; i < movies.length; i++) {
                const id = movies[i].imdb_id;
                if (!alternateVersion[id]) promises.push(axios.get(YIFY_ENDPOINT + id));
            }

            axios.all(promises).then(results => {
                for (var i = 0; i < results.length; i++) {
                    const data = results[i].data;
                    if (data && data.data && data.data.movies) {
                        const movie = data.data.movies[0];
                        alternateVersion[movie.imdb_code] = {};
                        for (var j = 0; j < movie.torrents.length; j++) {
                            const version = movie.torrents[j];
                            if (version.quality === "3D") alternateVersion[movie.imdb_code] = version;
                        }
                    }
                }

                this.setState({
                    movies: movies,
                    isLoaded: true,
                    isSearching: false
                });
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

        hashMapping[version.hashString] = version.title;

        axios.post(this.server + '/torrents', { url: version.url, tv: version.tv }).then(response => {
            this.updateTorrents();
        }, error => {
            console.error(error);
        });

        // this.torrentList.expand();
    }

    getVersions = (movie) => {
        var versions = {};
        var hashes = {};

        // TV Episode
        if (movie.episode && movie.torrents) {
            for (let [quality, torrent] of Object.entries(movie.torrents)) {
                if (quality === "0") quality = "480p";
                let sort = 0;
                switch (quality) {
                    case "1080p": sort = 3; break;
                    case "720p": sort = 2; break;
                    case "480p": sort = 1; break;
                    default: sort = 0; break;
                }

                var mag = magnet.decode(torrent.url).infoHash ? magnet.decode(torrent.url).infoHash.toLowerCase() : torrent.url;

                let version = {
                    quality: quality,
                    sort: sort,
                    url: torrent.url,
                    hashString: torrent.hash || mag,
                    tv: true
                };

                // Prevent the same torrent from being added
                if (hashes[version.hashString]) continue;
                hashes[version.hashString] = quality;

                if (!versions[quality] || versions[quality].ratio < version.ratio) {
                    versions[quality] = version;
                }
            }

            return Object.values(versions).sort(function(a, b) {
                return b.sort - a.sort;
            });
        }

        // Normal movie
        if (movie.torrents && movie.torrents.en) {
            if (this.state.quality === "3D" && alternateVersion[movie.imdb_id] && alternateVersion[movie.imdb_id].hash) {
                const version = alternateVersion[movie.imdb_id];
                movie.torrents.en["3D"] = {
                    peer: version.peers,
                    seed: version.seeds,
                    url: version.url,
                    hash: version.hash.toLowerCase(),
                    filesize: version.size,
                    movie: true
                };
            } else {
                delete movie.torrents.en["3D"];
            }

            for (let [quality, torrent] of Object.entries(movie.torrents.en)) {
                if (quality === "0") quality = "480p";
                let sort = 0;
                switch (quality) {
                    case "1080p": sort = 3; break;
                    case "720p": sort = 2; break;
                    case "480p": sort = 1; break;
                    default: sort = 0; break;
                }

                let version = {
                    quality: quality,
                    sort: sort,
                    peers: torrent.peer.toFixed(0),
                    seeds: torrent.seed.toFixed(0),
                    ratio: torrent.peer > 0 ? (torrent.seed / torrent.peer).toFixed(3) : 0,
                    url: torrent.url,
                    hashString: torrent.hash || magnet.decode(torrent.url).infoHash.toLowerCase(),
                    size: torrent.filesize,
                    title: movie.title + " (" + movie.year + ") [" + quality + "]"
                };

                // Prevent the same torrent from being added
                if (hashes[version.hashString]) continue;
                hashes[version.hashString] = true;

                if (!versions[quality] || versions[quality].ratio < version.ratio) {
                    versions[quality] = version;
                }
            }
        }

        return Object.values(versions).sort(function(a, b) {
            return a.sort - b.sort;
        });
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
        const page= this.state.page;
        var newPage = direction + page;
        if (page === newPage) return;
        if (newPage < 1) newPage = 1;

        this.setState({ page: newPage }, () => this.updateData());
    }

    render() {
        const {
            error, isLoaded, movies, modal, movie, page, torrents, location,
            serverStats, started, width, storage
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
                    {(this.state.type === "shows" || this.state.type === "animes") ? <Beta/> : null}

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
                        type={this.state.type}
                        page={this.state.page}
                    />

                    <div className="movie-list">
                        {(movies && movies.length > 0) ? (
                            movies.map(movie => (
                                movie.torrents || this.state.type !== "movies" ? (
                                    <Cover
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
                            <h1>No Results</h1>
                        }
                    </div>

                    <div className="pager">
                        <FaAngleDoubleLeft
                            className="arrow"
                            style={{ display: page > 1 ? "inline-block" : "none" }}
                            onClick={() => this.changePage(-5)}
                        />
                        <FaAngleLeft
                            className="arrow"
                            style={{ display: page > 1 ? "inline-block" : "none" }}
                            onClick={() => this.changePage(-1)}
                        />
                        <span>{page}</span>
                        <FaAngleRight
                            className="arrow"
                            style={{ display: movies.length === 50 ? "inline-block" : "none" }}
                            onClick={() => this.changePage(1)}
                        />
                        <FaAngleDoubleRight
                            className="arrow"
                            style={{ display: movies.length === 50 ? "inline-block" : "none" }}
                            onClick={() => this.changePage(5)}
                        />
                    </div>

                    <div className="footer">
                        <hr/>

                        {serverStats ? (
                            <p>Total Movies: {serverStats.totalMovies}, Total Shows: {serverStats.totalShows}</p>
                        ) : null}
                        {location ? (
                            <p>Server Location: {location}</p>
                        ) : null}
                        {storage ? (
                            <p>
                                <span>Disk Usage: {storage}%</span>
                                <progress value={storage} max="100"/>
                            </p>
                        ) : null}
                    </div>
                </Fragment>
            );
        }
    }
}

export default MovieList;