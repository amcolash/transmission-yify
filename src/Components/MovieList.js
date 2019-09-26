import React, { Component, Fragment } from 'react';
import axios from 'axios';
import magnet from 'magnet-uri';
import openSocket from 'socket.io-client';
import levenshtein from 'js-levenshtein';
import Modal from 'react-responsive-modal';
import {
    FaExclamationTriangle, FaMagnet, FaSearch, FaPowerOff
} from 'react-icons/fa';
// import {isMobile} from 'react-device-detect';

import './MovieList.css';
import Cover from './Cover';
import Spinner from './Spinner';
import Details from './Details';
import TorrentList from './TorrentList';
import Plex from './Plex';
import Search from './Search';
import Beta from './Beta';
import Pager from './Pager';
import Order from '../Data/Order';

const searchCache = [];
const hashMapping = {};

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
            order: '',
            type: 'animes',
            isSearching: false,
            storage: null,
            width: 0,
            height: 0,
            scroll: 0,
            docker: true,
            files: [],
            pb: null,
            build: null,
        }

        // Clean up old faq flag
        window.localStorage.removeItem('popcornfaq');
        window.localStorage.removeItem('popcornfaq1');
        window.localStorage.removeItem('popcornfaq2');

        this.updateSearch = this.updateSearch.bind(this);
        this.getTorrent = this.getTorrent.bind(this);
        this.getProgress = this.getProgress.bind(this);
        this.updateWindowDimensions = this.updateWindowDimensions.bind(this);

        this.server = "https://" + window.location.hostname + ":9000";
    }
    
    componentDidMount() {
        // Get movie list
        this.updateData();
        this.updateStats();
        
        // Get data from server
        this.updateLocation();
        this.updateDocker();

        // Update window size
        this.updateWindowDimensions();
        window.addEventListener('resize', this.updateWindowDimensions);

        // Update window scroll
        this.updateScroll();
        window.addEventListener('scroll', this.updateScroll);

        var socket = openSocket(this.server);
        socket.on('connect', data => {
            socket.emit('subscribe', 'torrents');
            socket.emit('subscribe', 'storage');
            socket.emit('subscribe', 'files');
        });

        socket.on('torrents', data => {
            if (data) this.updateTorrents(data);
        });

        socket.on('storage', data => {
            if (data) this.updateStorage(data);
        });

        socket.on('files', data => {
            if (data) this.updateFiles(data);
        });
    }
    
    componentWillUnmount() {
        window.removeEventListener('scroll', this.updateWindowDimensions);
        window.removeEventListener('resize', this.updateWindowDimensions);
    }

    updateWindowDimensions() {
        this.setState({ width: window.innerWidth, height: window.innerHeight });
    }

    updateScroll = () => {
        let scroll = (document.documentElement.scrollTop + document.body.scrollTop) / (document.documentElement.scrollHeight - document.documentElement.clientHeight);
        if (!isNaN(scroll)) this.setState({ scroll: scroll });
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
            if (response.data.city && response.data.country_name) {
                this.setState({ location: response.data.city + ', ' + response.data.country_name });
            } else {
                this.setState({ location: "ERROR" });
            }
        }, error => {
            console.error(error);
            this.setState({ location: "ERROR" });
        });

        // Update every minute (to make sure we are ok without a full refresh of page)
        // We don't need sockets here at the moment, but adding all stats to a socket
        // wouldn't be a bad idea at some point...
        setTimeout(() => this.updateLocation, 60 * 1000);
    }

    // Update a bunch of stats (pb link, build time)
    updateStats() {
        axios.get(this.server + '/pb').then(response => {
            this.setState({ pb: response.data });
        }, error => {
            console.error(error);
        });

        axios.get(this.server + '/build').then(response => {
            this.setState({ build: response.data });
        }, error => {
            console.error(error);
        });

        // Update every hour, don't need sockets here
        setTimeout(() => this.updateStats, 60 * 60 * 1000);
    }

    updateTorrents(data) {
        if (data.errno === "ECONNREFUSED") {
            this.setState({ error: { message: "Cannot access transmission" }});
        } else {
            var torrents = data.torrents || [];

            // Not sure if this is useful anymore?
            // if (this.state.docker) {
            //     torrents = torrents.filter(torrent => {
            //         return torrent.downloadDir.indexOf("/downloads") !== -1 || torrent.downloadDir.indexOf("/TV") !== -1;
            //     });
            // }

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

            var resetError = (this.state.error && this.state.error.message === "Cannot access transmission");

            this.setState({
                torrents: torrents,
                started: started,
                error: resetError ? null : this.state.error
            });
        }
    }

    updateStorage(data) {
        try {
            var percent = data.used;
            this.setState({ storage: parseFloat(percent).toFixed(1) });
        } catch (err) {
            console.error(err);
        }
    }

    updateFiles(data) {
        this.setState({files: data});
    }

    updateSearch(search, genre, order, type, page) {
        this.setState({
            search: search,
            genre: genre,
            order: order,
            type: type,
            page: page || 1, // reset page if not provided
        }, () => this.updateData());
    }
    
    updateData() {
        const { search, page, genre, type } = this.state;
        
        this.setState({
            isSearching: true
        });

        let order = this.state.order;
        if (type === 'movies') order = order || Order.movies[0].value;
        if (type === 'shows') order = order || Order.tv[0].value;
        if (type === 'animes') order = order || Order.anime[0].value;

        // const direction = order === 'title' ? '1' : '-1';
        // const params = (search.length > 0 ? '&query=' + search : ('&sort=' + order + '&order=' + direction +
        //     (genre.length > 0 ? '&genre=' + genre : '')));
        let ENDPOINT;
        
        if (type === 'animes') {
            const offset = (page - 1) * 20 + (page > 1 ? 1 : 0);
            const ordering = order === 'startDate' ? '-' : '';

            ENDPOINT = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${offset}`;
            if (genre) ENDPOINT += `&filter[genres]=${genre}`;
            if (search.length > 0) {
                ENDPOINT += `&filter[text]=${search}`;
            } else {
                ENDPOINT += `&sort=${ordering}${order || Order.anime[0].value}`;
            }
        } else {
            if (search.length > 0) {
                ENDPOINT = `${this.server}/search/${type}/${page}?query=${search}`;
            } else {
                ENDPOINT = `${this.server}/discover/${type}/${page}?sort=${order}`;
                if (genre) ENDPOINT += `&genre=${genre}`;
            }
        }

        if (searchCache[ENDPOINT]) {
            this.handleData(searchCache[ENDPOINT]);
        } else {
            axios.get(ENDPOINT).then(response => {
                searchCache[ENDPOINT] = response.data;
                this.handleData(response.data);
            }).catch(error => {
                console.error(error);
                this.setState({
                    error: error,
                    isLoaded: true,
                    isSearching: false,
                });
            });
        }
    }

    handleData(data) {
        const now = new Date().getFullYear();
        const { search, type } = this.state;
        
        if (data.data) data.results = data.data;

        if (data.results && data.results.map) {
            data = data.results.map(media => {
                // used for anime
                const attributes = media.attributes;
                if (attributes) {
                    media.title = attributes.canonicalTitle;
                    media.year = attributes.startDate;
                    if (attributes.posterImage) media.poster_path = attributes.posterImage.small;
                }

                // fix weird years (since it seems the year can vary based on region released first)
                media.year = media.year || media.release_date || media.first_air_date || 9999;
                media.year = Math.min(now, new Date(media.year).getFullYear());

                media.title = media.title || media.name || '?';
                media.title = media.title.replace(/&amp;/g, '&');
                
                // TMDB does not add an absolute url to returned poster paths
                if (media.poster_path && media.poster_path.indexOf('http') === -1) {
                    media.poster_path = 'https://image.tmdb.org/t/p/w300_and_h450_bestv2/' + media.poster_path;
                }

                // Fake tv data
                if (type !== 'movies') media.num_seasons = 1;

                return media;
            });
            
            // The search filtering is not great for kitsu :(
                if (type === 'animes' && search.length > 0) {
                    data = data.filter(media => {
                    const lev = levenshtein(search.toLowerCase(), media.title.toLowerCase());
                    const match = (1 - (lev / Math.max(search.length, media.title.length)));
                    return match > 0.75 || media.title.toLowerCase().startsWith(search.toLowerCase());
                });
            }
    
            this.setState({
                movies: data,
                isLoaded: true,
                isSearching: false
            });
        } else {
            this.setState({
                isLoaded: true,
                isSearching: false
            });
        }
    }

    cancelTorrent = (hashString) => {
        axios.delete(this.server + '/torrents/' + hashString).catch(error => {
            console.error(error);
        });
    }

    downloadTorrent = (version) => {
        this.setState({
            started: [ ...this.state.started, version.hashString ]
        });

        hashMapping[version.hashString] = version.title;

        // fix dead links
        let url = version.url;
        if (url.indexOf('nyaa.se') !== -1) url = url.replace('nyaa.se', 'nyaa.si').replace('?page=download', 'download/').replace('&tid=', '') + '.torrent';

        axios.post(this.server + '/torrents', { url: url, tv: version.tv }).catch(error => {
            console.error(error);

            // Reset started state if download failed
            this.setState({
                started: this.state.started.filter(item => item !== version.hashString)
            });
        });

        // this.torrentList.expand();
    }

    addMagnet = () => {
        var url = window.prompt("Url or magnet?", "");

        if (url && url.length > 0) {
            var tv = window.confirm("Is this a tv show?");
    
            axios.post(this.server + '/torrents', { url: url, tv: tv }).catch(error => {
                console.error(error);
            });
        }
    }

    searchPB = () => {
        var search = window.prompt("Search Term?", "");
        var win = window.open('', '_blank');
        if (search && search.length > 0) {
            // mobile has a different address than the desktop version :(
            // if (isMobile) {
            //     win.location.href = 'm.' + this.state.pb + '/search/' + search;
            // } else {
            // win.location.href = this.state.pb + '/search/' + search;
            // }

            // Skip the mobile specific code for now
            win.location.href = this.state.pb + '/search/' + search;
            win.focus();
        } else {
            win.close();
        }
    }

    upgrade = () => {
        var password = window.prompt("Password?", "");
        axios.post(this.server + '/upgrade?upgradeKey=' + password).then(response => {
            console.log(response.data);
            alert('Starting upgrade');
        }).catch(err => {
            console.error(err);
            alert('Something went wrong...')
        });
    }

    getVersions = (movie) => {
        var versions = {};
        var hashes = {};

        // TV Episode
        if (movie.episode && movie.torrents) {
            for (let [quality, torrent] of Object.entries(movie.torrents)) { // eslint-disable-line no-unused-vars
                if (quality === "0") quality = "480p";
                let sort = 0;
                switch (quality) {
                    case "1080p": sort = 3; break;
                    case "720p": sort = 2; break;
                    case "480p": sort = 1; break;
                    default: sort = 0; break;
                }

                if (torrent.url) {
                    var mag = magnet.decode(torrent.url).infoHash ? magnet.decode(torrent.url).infoHash.toLowerCase() : torrent.url;
                }

                let version = {
                    quality: quality,
                    sort: sort,
                    url: torrent.url,
                    hashString: torrent.hash || mag,
                    tv: true
                };

                // Prevent the same torrent from being added
                if (!version.hashString || hashes[version.hashString]) continue;
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
            for (let [quality, torrent] of Object.entries(movie.torrents.en)) { // eslint-disable-line no-unused-vars
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

    changePage = (direction) => {
        const page= this.state.page;
        var newPage = direction + page;
        if (page === newPage) return;
        if (newPage < 1) newPage = 1;

        this.setState({ page: newPage }, () => this.updateData());
    }

    render() {
        const {
            error, isLoaded, movies, modal, movie, page, torrents, location,
            started, width, storage, scroll, pb, build
        } = this.state;

        const pagerVisibility = page !== 1 || movies.length >= 20;
        const floatingPagerVisibility = (scroll < 0.97 && pagerVisibility);

        if (error) {
            return (
                <div className="message">
                    {(error.message !== "Cannot access transmission") ? (
                        <Fragment>
                            <br/>
                            <button onClick={() => document.location.reload()}>Reload Page</button>
                        </Fragment>
                    ) : <span>Error: {error.message}</span>}
                </div>
            );
        } else if (!isLoaded) {
            return (
            <div className="message">
                <span>Loading...
                    <Spinner visible/>
                </span>
            </div>
            );
        } else {
            return (
                <Fragment>
                    <Plex server={this.server}/>
                    {(this.state.type === "shows" || this.state.type === "animes") ? <Beta/> : null}

                    <Modal open={modal} onClose={this.onCloseModal} center={width > 800} modalId='modal'>
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
            
                    {location && (location === "ERROR" || location === "Seattle, United States") ? (
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
                                // movie.torrents || this.state.type !== "movies" ? (
                                    <Cover
                                        key={movie.id}
                                        movie={movie}
                                        click={this.onOpenModal}
                                        downloadTorrent={this.downloadTorrent}
                                        cancelTorrent={this.cancelTorrent}
                                        torrents={this.torrents}
                                        started={started}
                                        getProgress={this.getProgress}
                                        getVersions={this.getVersions}
                                        server={this.server}
                                        files={this.state.type === "movies" ? this.state.files : []} // only show downloaded files for movies
                                    />
                                // ) : null
                            ))
                        ) :
                            <h1>No Results</h1>
                        }
                    </div>

                    <Pager changePage={this.changePage} page={page} movies={movies} type={"floating " + (floatingPagerVisibility ? "" : "hidden")}/>
                    <Pager changePage={this.changePage} page={page} movies={movies} type={pagerVisibility ? "" : "hidden"}/>

                    <FaMagnet className="pointer" onClick={this.addMagnet}/>
                    {pb ? (
                        <FaSearch className="pointer marginLeft" onClick={this.searchPB}/>
                    ) : null}
                    <FaPowerOff className="pointer marginLeft" onClick={this.upgrade}/>

                    <div className="footer">
                        <hr/>

                        <p>Server Location: {location ? location : "Unknown"}</p>
                        {(build && build.indexOf('Dev Build') === -1) ? <p><span>Build Time: {new Date(build).toLocaleString()}</span></p> : null}
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