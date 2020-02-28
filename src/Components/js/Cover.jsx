import 'animate.css/animate.min.css';

import '../css/Cover.css';

import axios from 'axios';
import React, { Component, Fragment } from 'react';
import { FaDownload, FaExclamationCircle, FaFilm, FaLaughBeam, FaPlayCircle, FaRssSquare, FaTrash, FaTv } from 'react-icons/fa';

import Cache from '../../Util/Cache';
import { getMovies, hasFile, hasSubscription } from '../../Util/Parse';
import { shouldUpdate } from '../../Util/Util';
import ScrollAnimation from './ScrollAnimation';
import Spinner from './Spinner';

class Cover extends Component {
  cancelToken = null;

  constructor(props) {
    super(props);
    this.state = { pb: null, subscribing: false };
    this.ref = React.createRef();
  }

  componentWillUnmount() {
    this.cancelPB();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (
      this.props.type === 'movies' &&
      (prevProps.media !== this.props.media || (prevProps.viewMode === 'carousel' && this.props.viewMode === 'standard'))
    ) {
      this.updatePB();
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shouldUpdate(this.props, this.state, nextProps, nextState, false);
  }

  cancelPB() {
    if (this.cancelToken) {
      this.cancelToken.cancel();
      this.cancelToken = null;
    }
  }

  updatePB() {
    const media = this.props.media;
    const cleanedTitle = media.title.replace(/('|")/g, '').replace(/[^\w\s]/gi, ' ');

    this.cancelPB();

    this.cancelToken = axios.CancelToken.source();
    const url = `${this.props.server}/pirate/${cleanedTitle} ${media.year}?movie=true`;

    if (Cache[url]) {
      this.setState({ pb: Cache[url] });
    } else {
      axios
        .get(url, { cancelToken: this.cancelToken.token })
        .then(response => {
          Cache[url] = response.data;
          this.cancelToken = null;

          // Only update things if we are still actually showing the same cover
          if (media.title === this.props.media.title) {
            this.setState({ pb: response.data });
          } else {
            this.setState({ pb: null });
          }
        })
        .catch(err => {
          console.error(err);
          this.setState({ pb: null });
        });
    }
  }

  toggleSubscription() {
    if (this.props.toggleSubscription) {
      this.props.toggleSubscription(this.props.media, () => setTimeout(() => this.setState({ subscribing: false }), 2000));
      this.setState({ subscribing: true });
    }
  }

  getIcon() {
    switch (this.props.type) {
      case 'shows':
        return <FaTv />;
      case 'animes':
        return <FaLaughBeam />;
      default:
        return <FaFilm />;
    }
  }

  render() {
    const {
      click,
      files,
      media,
      started,
      downloadTorrent,
      cancelTorrent,
      type,
      getProgress,
      status,
      viewMode,
      selected,
      showLatest,
    } = this.props;
    const { pb, subscribing } = this.state;

    const id = media ? media.id : '';

    if (!media.poster_path) media.poster_path = 'broken image';

    const fileExists = hasFile(media, files || []);
    const subscription = status ? hasSubscription(id, status.subscriptions) : null;

    let versions = [];
    if (pb) {
      versions = getMovies(media, pb.torrents, type);
      if (versions.length > 2) versions = versions.slice(0, 2);
      versions = versions.map(version => {
        return { ...version, progress: getProgress(version.hashString) };
      });
    }

    return (
      <ScrollAnimation
        initiallyVisible={viewMode !== 'standard'}
        animateIn="fadeIn"
        animateOnce={true}
        offset={100}
        scrollableParentSelector=".movie-list"
        className={'movie ' + viewMode}
        afterAnimatedIn={() => {
          if (this.props.type === 'movies') {
            if (this.props.viewMode === 'standard') this.updatePB();
            else setTimeout(() => this.updatePB(), Math.random() * 2000);
          }
        }}
        ref={this.ref}
      >
        <div
          className={'cover' + (viewMode === 'carousel' && parseInt(selected ? selected.id : -1) === id ? ' selected' : '')}
          id={id}
          onClick={e => {
            if (click) click(media);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && click) click(media);
          }}
          onFocus={() => {
            if (viewMode === 'carousel' && click) click(media);
          }}
          tabIndex={type === 'subscriptions' ? undefined : '0'}
        >
          <img className="movieCover" src={media.poster_path} alt="" />
          <div className="movieIcon">{this.getIcon()}</div>
          {fileExists ? (
            <div className="fileExists hover" tabIndex={viewMode === 'carousel' ? undefined : '0'}>
              <FaPlayCircle
                onClick={e => {
                  e.stopPropagation();
                  window.open(fileExists.url, '_blank').focus();
                }}
              />
            </div>
          ) : null}
          {type === 'shows' || type === 'subscriptions' ? (
            <div
              className={'fileExists' + (subscription ? '' : ' notSubscribed')}
              onClick={e => {
                e.stopPropagation();
                this.toggleSubscription();
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  this.toggleSubscription();
                }
              }}
              tabIndex={type === 'subscriptions' ? '0' : undefined}
            >
              {subscribing ? <Spinner visible noMargin button /> : <FaRssSquare />}
            </div>
          ) : null}
          {type === 'movies' && viewMode === 'standard' ? (
            <div className="quality">
              {versions.length > 0 ? (
                versions.reverse().map(version => (
                  <Fragment key={version.hashString}>
                    <span>{version.quality}</span>
                    {version.progress != null ? (
                      <button
                        className="red"
                        onClick={e => {
                          e.stopPropagation();
                          e.nativeEvent.stopImmediatePropagation();
                          cancelTorrent(version.hashString, true);
                        }}
                      >
                        <FaTrash />
                      </button>
                    ) : (
                      <button
                        className="orange download"
                        onClick={e => {
                          e.stopPropagation();
                          e.nativeEvent.stopImmediatePropagation();
                          if (
                            !fileExists ||
                            window.confirm('This file already exists in plex. Are you sure you want to download it again?')
                          ) {
                            downloadTorrent(version);
                          }
                        }}
                      >
                        {started.indexOf(version.hashString) !== -1 ? <Spinner visible noMargin button /> : <FaDownload />}
                      </button>
                    )}
                    <br />
                  </Fragment>
                ))
              ) : pb ? (
                <span className="red medium">
                  <FaExclamationCircle />
                </span>
              ) : (
                <Spinner visible noMargin button />
              )}
            </div>
          ) : null}
        </div>
        {viewMode === 'standard' ? (
          <Fragment>
            <span onClick={e => click(media)}>
              {media.title} {media.year ? <span>({media.year})</span> : null}
            </span>
            <br />
          </Fragment>
        ) : null}
        {subscription && showLatest ? (
          <span>
            Latest: S{subscription.lastSeason}E{subscription.lastEpisode}
          </span>
        ) : null}
      </ScrollAnimation>
    );
  }
}

export default Cover;
