import '../css/MovieList.css';

import axios from 'axios';
import levenshtein from 'js-levenshtein';
import React, { Component, Fragment } from 'react';
import openSocket from 'socket.io-client';

import Order from '../../Data/Order';
import Cache from '../../Util/Cache';
import { hasSubscription, parseMedia } from '../../Util/Parse';
import { shouldUpdate } from '../../Util/Util';
import Analytics from './Analytics';
import CoverList from './CoverList';
import DetailsBackdrop from './DetailsBackdrop';
import Logo from './Logo';
import Menu from './Menu';
import Pirate from './Pirate';
import Search from './Search';
import Spinner from './Spinner';
import TorrentList from './TorrentList';

const hashMapping = {};
const showMedia = false;

class MovieList extends Component {
  constructor(props) {
    super(props);

    let port;
    let devOverrides = {};
    if (process.env.NODE_ENV === 'development') {
      port = 9000;
      devOverrides = {
        // type: 'animes',
        // search: 'One punch man'
      };
    } else {
      // After the initial logo, hide it and go back to loading
      setTimeout(() => this.setState({ showLogo: false }), 3550);
    }

    let type, media;
    if (window.location.search.length > 0) type = window.location.search.substring(1);
    if (window.location.hash.length > 0) media = { id: window.location.hash.substring(1) };

    let isLoaded = type !== 'movies' && type !== 'shows' && type !== 'animes';

    this.state = {
      error: null,
      showLogo: true,
      isLoaded,
      results: [],
      page: 1,
      media: media || null,
      torrents: [],
      started: [],
      search: '',
      genre: '',
      order: '',
      type: type || 'movies',
      isSearching: false,
      status: null,
      width: 0,
      height: 0,
      lastPage: false,
      files: [],
      viewMode: window.localStorage.getItem('viewMode') || 'standard',
      ...devOverrides,
    };

    // window.localStorage.setItem('viewMode', this.state.viewMode);

    this.updateSearch = this.updateSearch.bind(this);
    this.getProgress = this.getProgress.bind(this);
    this.getTorrent = this.getTorrent.bind(this);
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
    this.upgrade = this.upgrade.bind(this);
    this.addMagnet = this.addMagnet.bind(this);
    this.toggleSubscription = this.toggleSubscription.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.updateHash = this.updateHash.bind(this);
    this.updateHistory = this.updateHistory.bind(this);
    this.updateScroll = this.updateScroll.bind(this);
    this.toggleViewMode = this.toggleViewMode.bind(this);

    this.listRef = React.createRef();
    this.backdropRef = React.createRef();

    this.server = 'https://' + window.location.hostname;
    if (port) this.server += `:${port}`;
    else this.server += window.location.port.length > 0 ? `:${window.location.port}` : '';
  }

  componentDidMount() {
    // Get movie list
    this.updateData();

    // Update window size
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);

    // Update on hash change
    window.addEventListener('hashchange', this.updateHash);
    window.addEventListener('popstate', this.updateHistory);

    // Open a socket and try to force using a websocket
    const socket = openSocket(this.server, { transports: ['websocket'] });
    socket.on('connect', data => {
      socket.emit('subscribe', 'torrents');
      socket.emit('subscribe', 'status');

      // Weird performance hack, this helps since it seems the server blocks while sending info and cannot get cover info
      setTimeout(() => socket.emit('subscribe', 'files'), 3000);
    });

    // If something fails with connecting, reset to defaults
    socket.on('reconnect_attempt', () => {
      socket.io.opts.transports = ['polling', 'websocket'];
    });

    socket.on('torrents', data => {
      if (data) this.updateTorrents(data);
    });

    socket.on('status', data => {
      if (data) {
        if (this.state.type === 'subscriptions') {
          this.setState({ status: data, results: data.subscriptions.sort((a, b) => a.title.localeCompare(b.title)) });
        } else {
          this.setState({ status: data });
        }
      }
    });

    socket.on('files', data => {
      if (data) this.setState({ files: data });
    });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
    window.removeEventListener('hashchange', this.updateHash);
    window.removeEventListener('popstate', this.updateHistory);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shouldUpdate(this.props, this.state, nextProps, nextState, true);
  }

  updateWindowDimensions() {
    this.setState({ width: window.innerWidth, height: window.innerHeight });
  }

  updateHash() {
    const id = (window.location.hash || '').substring(1);

    // Double equals so that string and number can coexist and if they match in any form don't double things
    if (this.state.media && this.state.media.id == id) return; // eslint-disable-line eqeqeq

    // Only update if the id is defined
    if (id.length > 0) {
      this.setState({ media: { id } });
    } else {
      this.setState({ media: null });
    }
  }

  updateHistory() {
    let type = window.location.search.substring(1) || 'movies';
    if (type !== this.state.type) {
      this.updateSearch('', '', '', type, 1);
    }
  }

  updateScroll() {
    const element = this.listRef.current;
    if (!element) return;

    let scroll;
    // This isn't super precise, but good enough for me!
    if (this.state.viewMode === 'standard') {
      scroll = (element.scrollTop + element.offsetHeight) / (element.scrollHeight - element.offsetTop);
    } else {
      scroll = (element.scrollLeft + element.offsetLeft) / (element.scrollWidth - element.offsetWidth);
    }

    if (!isNaN(scroll)) {
      if (scroll > 0.9 && !this.state.isSearching && !this.state.lastPage && (!this.state.media || this.state.viewMode === 'carousel')) {
        if (this.state.viewMode === 'standard') element.scrollTop -= 10;
        else element.scrollLeft -= 10;

        this.changePage(1);
      }
    }
  }

  updateTorrents(data) {
    if (data.errno === 'ECONNREFUSED') {
      console.error(data);
      this.setState({ error: { message: 'Cannot access transmission' } });
    } else {
      var torrents = data.torrents || [];

      // Not sure if this is useful anymore?
      // if (this.state.docker) {
      //     torrents = torrents.filter(torrent => {
      //         return torrent.downloadDir.indexOf("/downloads") !== -1 || torrent.downloadDir.indexOf("/TV") !== -1;
      //     });
      // }

      torrents.forEach(torrent => {
        if (torrent.eta < 0 && hashMapping[torrent.hashString]) {
          torrent.name = hashMapping[torrent.hashString];
        }
      });

      const started = this.state.started.filter(hashString => {
        for (var i = 0; i < torrents.length; i++) {
          if (torrents[i].hashString === hashString) return false;
        }
        return true;
      });

      const resetError = this.state.error && this.state.error.message === 'Cannot access transmission';

      this.setState({
        torrents,
        started,
        error: resetError ? null : this.state.error,
      });
    }
  }

  updateSearch(search, genre, order, type, page) {
    let page1 = (page || 1) === 1;
    if (page1) window.scrollTo({ top: 0, behavior: 'smooth' });

    let newurl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${type}`;
    if (window.location.href !== newurl) {
      if (this.state.media) newurl += `#${this.state.media.id}`;
      window.history.pushState({ path: newurl }, '', newurl);
    }

    this.setState(
      {
        search: search,
        genre: genre,
        order: order,
        type: type,
        page: page || 1, // reset page if not provided
        results: this.state.type === type ? this.state.results : [],
        lastPage: !page1, // reset last page if we are on page 1
      },
      () => this.updateData()
    );
  }

  updateData() {
    const { page, genre, type } = this.state;

    if (page === 1) window.scrollTo({ top: 0, behavior: 'smooth' });

    // sanitize the search so that there are no special characters, replace with spaces for most characters except quotes
    let search = this.state.search.replace(/('|")/g, '').replace(/[^\w\s]/gi, ' ');

    this.setState({ isSearching: true });

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
        this.setState({ results: [], isSearching: false });
        return;
      }
      // use all so that we do not filter here
      ENDPOINT = `${this.server}/pirate/${search}?all=true&page=${page}`;
    } else if (type === 'subscriptions' || type === 'downloads' || type === 'analytics') {
      this.setState({
        isLoaded: true,
        isSearching: false,
        results: this.state.status ? this.state.status.subscriptions.sort((a, b) => a.title.localeCompare(b.title)) : [],
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
      axios
        .get(ENDPOINT)
        .then(response => {
          Cache[ENDPOINT] = response.data;
          // Handle errors which were not marked as such from the proxy server
          if (response.data.name === 'Error') {
            console.error(response.data);
            this.setState({
              isLoaded: true,
              isSearching: false,
              lastPage: true,
              results: [],
            });
          } else {
            this.handleData(response.data);
          }
        })
        .catch(error => {
          console.error(error);
          this.setState({
            isLoaded: true,
            isSearching: false,
            lastPage: true,
            results: [],
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
        lastPage,
      });

      return;
    }

    let lastPage =
      (data.page !== undefined && data.total_pages !== undefined && data.page === data.total_pages) || data.total_results === 0;

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

      if (type === 'animes') {
        // Filter out non-tv anime
        data = data.filter(media => media.attributes.subtype === 'TV');

        // The search filtering is not great for kitsu :(
        if (search.length > 0) {
          data = data.filter(media => {
            const lev = levenshtein(search.toLowerCase(), media.title.toLowerCase());
            const match = 1 - lev / Math.max(search.length, media.title.length);
            return match > 0.75 || media.title.toLowerCase().startsWith(search.toLowerCase());
          });
        }
        if (data.length === 0) lastPage = true;
      } else if (type === 'movies' || type === 'shows') {
        // Filter by popularity and vote count to remove obscure results
        data = data.filter(d => d.popularity > 1 && d.vote_count > 3);
      }

      // Concat and filter dupes if infiniscrolling
      if (page > 1) {
        let filtered = [];
        results.concat(data).forEach(d => {
          if (!filtered.find(f => f.title === d.title)) filtered.push(d);
        });
        data = filtered;
      }

      this.setState(
        {
          results: data,
          isLoaded: true,
          isSearching: false,
          lastPage,
        },
        () => {
          // Safety check if we need to load more data since things were filtered and may not fill client height
          if (!lastPage) setTimeout(() => this.updateScroll(), 1000);

          // Show media after loaded
          if ((process.env.NODE_ENV === 'development' && showMedia) || this.state.viewMode === 'carousel') {
            setTimeout(() => this.setState({ media: data[0] }), 500);
          }
        }
      );
    } else {
      this.setState({
        isLoaded: true,
        isSearching: false,
        lastPage,
      });
    }
  }

  cancelTorrent = (hashString, deleteFiles) => {
    axios.delete(this.server + '/torrents/' + hashString + '?deleteFiles=' + deleteFiles).catch(error => {
      console.error(error);
    });
  };

  downloadTorrent = (version, asktv) => {
    let tv = version.tv;
    if (asktv) tv = window.confirm('Is this a tv show?');

    this.setState({
      started: [...this.state.started, version.hashString],
    });

    hashMapping[version.hashString] = version.title;

    // fix dead links
    let url = version.url;
    if (url.indexOf('nyaa.se') !== -1)
      url =
        url
          .replace('nyaa.se', 'nyaa.si')
          .replace('?page=download', 'download/')
          .replace('&tid=', '') + '.torrent';

    axios.post(this.server + '/torrents', { url, tv }).catch(error => {
      console.error(error);

      // Reset started state if download failed
      this.setState({
        started: this.state.started.filter(item => item !== version.hashString),
      });
    });

    // this.torrentList.expand();
  };

  addMagnet = () => {
    var url = window.prompt('Url or magnet?', '');

    if (url && url.length > 0) {
      var tv = window.confirm('Is this a tv show?');

      axios.post(this.server + '/torrents', { url: url, tv: tv }).catch(error => {
        console.error(error);
      });
    }
  };

  upgrade = () => {
    const key = localStorage.getItem('key') || window.prompt('Password?', '');
    if (localStorage.getItem('key') && !window.confirm('Are you sure you would like to upgrade the server?')) return;
    axios
      .post(this.server + '/upgrade?upgradeKey=' + key)
      .then(response => {
        localStorage.setItem('key', key);
        console.log(response.data);
        alert('Starting upgrade');
      })
      .catch(err => {
        localStorage.removeItem('key');
        console.error(err);
        alert('Something went wrong...');
      });
  };

  clearCache = () => {
    const key = localStorage.getItem('key') || window.prompt('Password?', '');
    if (localStorage.getItem('key') && !window.confirm('Are you sure you would like to clear the cache?')) return;
    axios
      .delete(this.server + '/cache?key=' + key)
      .then(response => {
        localStorage.setItem('key', key);
        console.log(response.data);
        alert('Clearing Cache');
      })
      .catch(err => {
        localStorage.removeItem('key');
        console.error(err);
        alert('Something went wrong...');
      });
  };

  getTorrent(hashString) {
    for (var i = 0; i < this.state.torrents.length; i++) {
      const torrent = this.state.torrents[i];
      if (torrent.hashString === hashString) return torrent;
    }

    return null;
  }

  getProgress(hashString) {
    const torrent = this.getTorrent(hashString);
    return torrent !== null ? (torrent.percentDone * 100).toFixed(0) : null;
  }

  toggleSubscription(media, finallyCb) {
    if (hasSubscription(media.id, this.state.status.subscriptions)) {
      axios
        .delete(`${this.server}/subscriptions?id=${media.id}`)
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          if (finallyCb) finallyCb();
        });
    } else {
      axios
        .post(`${this.server}/subscriptions?id=${media.id}`)
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          if (finallyCb) finallyCb();
        });
    }
  }

  onOpenModal = media => {
    window.location.hash = media.id;
    this.setState({ media: media });
  };

  onCloseModal = () => {
    window.location.hash = '';
    this.setState({ media: null });
  };

  changePage = direction => {
    const page = this.state.page;
    var newPage = direction + page;
    if (page === newPage) return;
    if (newPage < 1) newPage = 1;

    this.setState({ page: newPage }, () => this.updateData());
  };

  toggleViewMode() {
    const viewMode = this.state.viewMode === 'standard' ? 'carousel' : 'standard';
    this.setState({ viewMode });
    window.localStorage.setItem('viewMode', viewMode);
  }

  render() {
    const { error, isLoaded, showLogo, results, media, started, status, type, search, isSearching, files, viewMode } = this.state;

    // Filter out completed torrents from all views
    const torrents = this.state.torrents.filter(t => t.percentDone < 1);

    // Make it a tiny bit quicker on local dev
    const logo = process.env.NODE_ENV === 'development' ? false : showLogo;

    if (error) {
      return (
        <div className="message">
          {error.message !== 'Cannot access transmission' ? (
            <Fragment>
              <span>Whoops something went wrong!</span>
              <br />
              <button onClick={() => document.location.reload()}>Reload Page</button>
            </Fragment>
          ) : (
            <span>Error: {error.message}</span>
          )}
        </div>
      );
    } else {
      return (
        <Fragment>
          {logo ? (
            <Logo />
          ) : !isLoaded ? (
            <div className="message">
              <span>
                Loading...
                <Spinner visible />
              </span>
            </div>
          ) : (
            <Menu
              type={type}
              upgrade={this.upgrade}
              addMagnet={this.addMagnet}
              clearCache={this.clearCache}
              updateSearch={this.updateSearch}
              status={status}
              torrents={torrents}
              listRef={this.listRef}
              viewMode={viewMode}
              toggleViewMode={this.toggleViewMode}
            />
          )}

          {type === 'downloads' ? (
            <TorrentList
              torrents={torrents}
              cancelTorrent={this.cancelTorrent}
              getProgress={this.getProgress}
              ref={instance => {
                this.torrentList = instance;
              }}
            />
          ) : type === 'subscriptions' ? (
            <div className={'movie-list ' + viewMode} ref={this.listRef} onScroll={this.updateScroll}>
              {results.length === 0 ? <h2>No Subscriptions</h2> : <h2>Subscriptions ({results.length})</h2>}
              <CoverList
                results={results}
                type={type}
                server={this.server}
                status={status}
                toggleSubscription={this.toggleSubscription}
                click={this.onOpenModal}
                isSearching={isSearching}
                viewMode="standard"
              />
            </div>
          ) : type === 'analytics' ? (
            <Analytics server={this.server} />
          ) : !logo && isLoaded ? (
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

              <div className={'movie-list ' + viewMode} ref={this.listRef} onScroll={this.updateScroll}>
                {isSearching && this.state.page === 1 ? null : type === 'pirate' ? (
                  results && results.torrents && results.torrents.length > 0 ? (
                    <div className="pirateList">
                      {results.torrents.map(media => (
                        <Pirate
                          key={media.link}
                          media={media}
                          started={started}
                          downloadTorrent={this.downloadTorrent}
                          cancelTorrent={this.cancelTorrent}
                          getProgress={this.getProgress}
                          getTorrent={this.getTorrent}
                        />
                      ))}
                      {isSearching ? <Spinner visible big /> : null}
                    </div>
                  ) : search.length === 0 ? (
                    <h2>Please enter a search term</h2>
                  ) : (
                    <h1>No Results</h1>
                  )
                ) : results.length === 0 ? (
                  <h1>No Results</h1>
                ) : (
                  <CoverList
                    selected={media}
                    results={results}
                    type={type}
                    click={this.onOpenModal}
                    downloadTorrent={this.downloadTorrent}
                    cancelTorrent={this.cancelTorrent}
                    torrents={torrents}
                    started={started}
                    getProgress={this.getProgress}
                    server={this.server}
                    files={type === 'movies' ? files : []} // only show downloaded files for movies
                    status={status}
                    toggleSubscription={this.toggleSubscription}
                    isSearching={isSearching}
                    viewMode={viewMode}
                  />
                )}
              </div>
              <DetailsBackdrop
                ref={this.backdropRef}
                loading={logo || !isLoaded}
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
                files={type === 'movies' ? this.state.files : []} // only show downloaded files for movies
                status={status}
                toggleSubscription={this.toggleSubscription}
                viewMode={viewMode}
              />
            </Fragment>
          ) : null}
        </Fragment>
      );
    }
  }
}

export default MovieList;
