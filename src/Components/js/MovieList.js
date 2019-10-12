import React, { Component, Fragment } from 'react';
import axios from 'axios';
import openSocket from 'socket.io-client';
import levenshtein from 'js-levenshtein';

import '../css/MovieList.css';
import Cover from './Cover';
import Spinner from './Spinner';
import Logo from './Logo';
import DetailsBackdrop from './DetailsBackdrop';
import TorrentList from './TorrentList';
import Search from './Search';
// import Pager from './Pager';
import Order from '../../Data/Order';
import Pirate from './Pirate';
import Menu from './Menu';
import Cache from '../../Util/Cache';
import { parseMedia, hasSubscription } from '../../Util/Parse';

const hashMapping = {};

class MovieList extends Component {

    constructor(props) {
        super(props);

        let devOverrides = {};
        if (process.env.NODE_ENV === 'development') {
            devOverrides = {
                type: 'pirate',
                search: 'saturday night live'
            };
        }

        this.state = {
            error: null,
            showLogo: true,
            isLoaded: false,
            results: [],
            page: 1,
            media: null,
            torrents: [],
            started: [],
            search: '',
            genre: '',
            order: '',
            type: 'movies',
            isSearching: false,
            status: null,
            width: 0,
            height: 0,
            lastPage: false,
            files: [],
            ...devOverrides
        }

        // Clean up old faq flag
        window.localStorage.removeItem('popcornfaq');
        window.localStorage.removeItem('popcornfaq1');
        window.localStorage.removeItem('popcornfaq2');

        this.updateSearch = this.updateSearch.bind(this);
        this.getProgress = this.getProgress.bind(this);
        this.getTorrent = this.getTorrent.bind(this);
        this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
        this.upgrade = this.upgrade.bind(this);
        this.addMagnet = this.addMagnet.bind(this);
        this.toggleSubscription = this.toggleSubscription.bind(this);
        this.clearCache = this.clearCache.bind(this);

        this.server = "https://" + window.location.hostname + ":9000";

        // After the initial logo, hide it and go back to loading
        setTimeout(() => this.setState({showLogo: false}), 3550);
    }
    
    componentDidMount() {
        // Get movie list
        this.updateData();

        // Update window size
        this.updateWindowDimensions();
        window.addEventListener('resize', this.updateWindowDimensions);

        // Update window scroll
        this.updateScroll();
        window.addEventListener('scroll', this.updateScroll);

        var socket = openSocket(this.server);
        socket.on('connect', data => {
            socket.emit('subscribe', 'torrents');
            socket.emit('subscribe', 'status');
            socket.emit('subscribe', 'files');
        });

        socket.on('torrents', data => {
            if (data) this.updateTorrents(data);
        });

        socket.on('status', data => {
            if (data) {
                if (this.state.type === 'subscriptions') {
                    this.setState({status: data, results: data.subscriptions});
                } else {
                    this.setState({status: data});
                }
            }
        });

        socket.on('files', data => {
            if (data) this.setState({files: data});
        });
    }
    
    componentWillUnmount() {
        window.removeEventListener('scroll', this.updateScroll);
        window.removeEventListener('resize', this.updateWindowDimensions);
    }

    updateWindowDimensions() {
        this.setState({ width: window.innerWidth, height: window.innerHeight });
    }

    updateScroll = () => {
        let scroll = (document.documentElement.scrollTop + document.body.scrollTop) / (document.documentElement.scrollHeight - document.documentElement.clientHeight);
        if (!isNaN(scroll)) {
            if (scroll > 0.90 && !this.state.isSearching && !this.state.lastPage) {
                this.changePage(1);
            }
        }
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

    updateSearch(search, genre, order, type, page) {
        let page1 = (page || 1) === 1;
        if (page1) window.scrollTo({ top: 0, behavior: 'smooth' });

        this.setState({
            search: search,
            genre: genre,
            order: order,
            type: type,
            page: page || 1, // reset page if not provided
            results: this.state.type === type ? this.state.results : [],
            lastPage: !page1 // reset last page if we are on page 1
        }, () => this.updateData());
    }
    
    updateData() {
        const { page, genre, type } = this.state;

        if (page === 1) window.scrollTo({ top: 0, behavior: 'smooth' });

        // sanitize the search so that there are no special characters, replace with spaces for most characters except quotes
        let search = this.state.search.replace(/('|")/g, '').replace(/[^\w\s]/gi, ' ');
        
        this.setState({isSearching: true});

        let order = this.state.order;
        if (type === 'movies') order = order || Order.movies[0].value;
        if (type === 'shows') order = order || Order.tv[0].value;
        if (type === 'animes') order = order || Order.anime[0].value;

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
        } else if (type === 'pirate') {
            if (search.length === 0) {
                this.setState({results: [], isSearching: false});
                return;
            }
            // use all so that we do not filter here
            ENDPOINT = `${this.server}/pirate/${search}?all=true&page=${page}`;
        } else if (type === 'subscriptions' || type === 'downloads') {
            this.setState({
                isLoaded: true,
                isSearching: false,
                results: this.state.status ? this.state.status.subscriptions : []
            });
            return;
        } else {
            if (search.length > 0) {
                ENDPOINT = `${this.server}/search/${type}/${page}?query=${search}`;
            } else {
                ENDPOINT = `${this.server}/discover/${type}/${page}?sort=${order}`;
                if (genre) ENDPOINT += `&genre=${genre}`;
            }
        }

        if (Cache[ENDPOINT]) {
            this.handleData(Cache[ENDPOINT]);
        } else {
            axios.get(ENDPOINT).then(response => {
                Cache[ENDPOINT] = response.data;
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
        const { search, type, page, results } = this.state;
        
        if (type === 'pirate') {
            if (page > 1 && results && results.torrents) data.torrents = results.torrents.concat(data.torrents);
            let lastPage = page >= Math.ceil(results.total / results.limit);

            this.setState({
                results: data,
                isLoaded: true,
                isSearching: false,
                lastPage
            });

            return;
        }

        let lastPage = data.page !== undefined && data.total_pages !== undefined && data.page === data.total_pages;

        if (data.data) data.results = data.data;

        const now = new Date();
        
        if (data.results && data.results.map) {
            data = data.results.filter(media => {
                if (media.release_date && new Date(media.release_date) > now) return false;
                return true;
            });

            data = data.map(media => {
                return parseMedia(media, type);
            });
            
            // The search filtering is not great for kitsu :(
                if (type === 'animes' && search.length > 0) {
                    data = data.filter(media => {
                    const lev = levenshtein(search.toLowerCase(), media.title.toLowerCase());
                    const match = (1 - (lev / Math.max(search.length, media.title.length)));
                    return match > 0.75 || media.title.toLowerCase().startsWith(search.toLowerCase());
                });
            }

            if (page > 1) data = results.concat(data);
    
            this.setState({
                results: data,
                isLoaded: true,
                isSearching: false,
                lastPage
            });
        } else {
            this.setState({
                isLoaded: true,
                isSearching: false,
                lastPage
            });
        }
    }

    cancelTorrent = (hashString, deleteFiles) => {
        axios.delete(this.server + '/torrents/' + hashString + '?deleteFiles=' + deleteFiles).catch(error => {
            console.error(error);
        });
    }

    downloadTorrent = (version, asktv) => {
        let tv = version.tv;
        if (asktv) tv = window.confirm("Is this a tv show?");

        this.setState({
            started: [ ...this.state.started, version.hashString ]
        });

        hashMapping[version.hashString] = version.title;

        // fix dead links
        let url = version.url;
        if (url.indexOf('nyaa.se') !== -1) url = url.replace('nyaa.se', 'nyaa.si').replace('?page=download', 'download/').replace('&tid=', '') + '.torrent';

        axios.post(this.server + '/torrents', { url, tv }).catch(error => {
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

    upgrade = () => {
        var password = window.prompt("Password?", "");
        axios.post(this.server + '/upgrade?upgradeKey=' + password).then(response => {
            console.log(response.data);
            alert('Starting upgrade');
        }).catch(err => {
            console.error(err);
            alert('Something went wrong...');
        });
    }

    clearCache = () => {
        var password = window.prompt("Password?", "");
        axios.delete(this.server + '/cache?key=' + password).then(response => {
            console.log(response.data);
            alert('Clearing Cache');
        }).catch(err => {
            console.error(err);
            alert('Something went wrong...');
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

    toggleSubscription(media, finallyCb) {
        if (hasSubscription(media.id, this.state.status.subscriptions)) {
            axios.delete(`${this.server}/subscriptions?id=${media.id}`).catch(err => {
                console.error(err)
            }).finally(() => {
                if (finallyCb) finallyCb();
            });
        } else {
            axios.post(`${this.server}/subscriptions?id=${media.id}`).catch(err => {
                console.error(err)
            }).finally(() => {
                if (finallyCb) finallyCb();
            });
        }
    }

    onOpenModal = (media) => {
        this.setState({ media: media });
    };

    onCloseModal = () => {
        this.setState({ media: null });
    };

    changePage = (direction) => {
        const page= this.state.page;
        var newPage = direction + page;
        if (page === newPage) return;
        if (newPage < 1) newPage = 1;

        this.setState({ page: newPage }, () => this.updateData());
    }

    render() {
        const { error, isLoaded, showLogo, results, media, torrents, started, status, type, search, isSearching } = this.state;

        // Make it a tiny bit quicker on local dev
        const logo = process.env.NODE_ENV === 'development' ? false : showLogo;

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
        } else if (logo || !isLoaded) {
            if (logo) {
                return <Logo/>;
            } else {
                return (
                    <div className="message">
                        <span>Loading...
                            <Spinner visible/>
                        </span>
                    </div>
                );
            }
        } else {
            return (
                <Fragment>
                    <Menu
                        type={type}
                        upgrade={this.upgrade}
                        addMagnet={this.addMagnet}
                        clearCache={this.clearCache}
                        updateSearch={this.updateSearch}
                        status={status}
                        torrents={torrents}
                    />

                    <DetailsBackdrop
                        media={media}
                        type={type}
                        server={this.server}
                        torrents={torrents}
                        started={started}
                        updateTorrents={this.updateTorrents}
                        cancelTorrent={this.cancelTorrent}
                        downloadTorrent={this.downloadTorrent}
                        getProgress={this.getProgress}
                        getTorrent={this.getTorrent}
                        onOpenModal={this.onOpenModal}
                        onCloseModal={this.onCloseModal}
                        files={type === "movies" ? this.state.files : []} // only show downloaded files for movies
                        status={status}
                        toggleSubscription={this.toggleSubscription}
                    />

                    {type === 'downloads' ? (
                        <TorrentList
                            torrents={torrents}
                            cancelTorrent={this.cancelTorrent}
                            getLink={this.getLink}
                            getProgress={this.getProgress}
                            ref={instance => { this.torrentList = instance; }}
                        />
                    ) : type === 'subscriptions' ? (
                        <div className="movie-list">
                            {results.length === 0 ? <h2>No Subscriptions</h2> : <h2>Subscriptions ({results.length})</h2>}
                            <div>
                                {results.map(media => (
                                    <Cover
                                        key={media.id}
                                        media={media}
                                        type={type}
                                        server={this.server}
                                        status={status}
                                        toggleSubscription={this.toggleSubscription}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <Fragment>
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
                                {type === 'pirate' ? (
                                    results && results.torrents && results.torrents.length > 0 ? (
                                        <div className="pirateList">
                                            {results.torrents.map(media => (
                                                <Pirate
                                                    key={media.link}
                                                    media={media}
                                                    started={started}
                                                    downloadTorrent={this.downloadTorrent}
                                                    cancelTorrent={this.cancelTorrent}
                                                    getLink={this.getLink}
                                                    getProgress={this.getProgress}
                                                    getTorrent={this.getTorrent}
                                                />
                                            ))}
                                        </div>
                                    ) : search.length === 0 ? <h2>Please enter a search term</h2> : <h1>No Results</h1>
                                ) : (
                                    results.length === 0 ? <h1>No Results</h1> : (
                                        <div>
                                            {results.map(media => (
                                                <Cover
                                                    key={media.id}
                                                    media={media}
                                                    type={type}
                                                    click={this.onOpenModal}
                                                    downloadTorrent={this.downloadTorrent}
                                                    cancelTorrent={this.cancelTorrent}
                                                    torrents={this.torrents}
                                                    started={started}
                                                    getProgress={this.getProgress}
                                                    server={this.server}
                                                    files={type === "movies" ? this.state.files : []} // only show downloaded files for movies
                                                    status={status}
                                                    toggleSubscription={this.toggleSubscription}
                                                />
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
        
                            {isSearching ? <Spinner visible big/> : null}
                        </Fragment>
                    )}
                </Fragment>
            );
        }
    }
}

export default MovieList;