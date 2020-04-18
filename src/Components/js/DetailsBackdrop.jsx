import '../css/DetailsBackdrop.css';

import axios from 'axios';
import React, { Component, Fragment } from 'react';
import { FaChevronDown, FaChevronUp, FaDownload, FaPlayCircle, FaRssSquare, FaStar, FaTimes, FaYoutube } from 'react-icons/fa';
import Modal from 'react-responsive-modal';
import YouTube from 'react-youtube';

import Genre from '../../Data/Genre';
import Cache from '../../Util/Cache';
import { confirm } from '../../Util/cordova-plugins';
import {
  getDetails,
  getEpisodes,
  getMovies,
  getSeasons,
  getYear,
  hasFile,
  hasSubscription,
  parseHorribleSubs,
  parseMedia,
} from '../../Util/Parse';
import { getPirateSearchUrl } from '../../Util/Util';
import MultiImage from './MultiImage';
import Ratings from './Ratings';
import Spinner from './Spinner';
import Version from './Version';

class DetailsBackdrop extends Component {
  cancelTokens = [];
  nyaaTimeout = undefined;
  horribleSubsTimeout = undefined;
  eztvTimeout = undefined;
  pirateTimeout = undefined;

  constructor(props) {
    super(props);
    this.state = { ...this.getDefaultState(), onLoad: props.media ? true : false };

    this.containerRef = React.createRef();
  }

  getDefaultState() {
    return {
      tmdbData: null,
      moreData: null,
      pb: null,
      eztv: null,
      nyaa: null,
      horribleSubs: null,
      season: 1,
      maxSeason: 1,
      showCover: true,
      loadingEpisodes: false,
      subscribing: false,
      youtubeId: null,
      otherVideos: false,
      onLoad: false,
    };
  }

  axiosGetHelper(url) {
    const cancelToken = axios.CancelToken.source();
    this.cancelTokens.push(cancelToken);

    return axios.get(url, { cancelToken: cancelToken.token });
  }

  cancelRequests() {
    this.cancelTokens.forEach((t) => t.cancel());
    this.cancelTokens = [];

    // Also remove torrent data just in case
    this.setState({ pb: null, eztv: null, nyaa: null, horribleSubs: null });
  }

  getEztv(media) {
    if (this.eztvTimeout) clearTimeout(this.eztvTimeout);
    this.eztvTimeout = setTimeout(
      () => {
        const url = `${this.props.server}/eztv/${media.title}`;

        if (Cache[url]) {
          this.handleEztv(Cache[url]);
        } else {
          this.axiosGetHelper(url)
            .then((response) => {
              const data = response.data;
              Cache[url] = data;

              this.handleEztv(data);
            })
            .catch((err) => {
              if (axios.isCancel(err)) return;
              console.error(err);
              this.setState({ loadingEpisodes: false });
            });
        }
      },
      this.props.viewMode === 'carousel' ? 2000 : 0
    );
  }

  handleEztv(data) {
    // If we loaded data for another show, don't handle it now
    if (data.title.toLowerCase() !== this.props.media.title.toLowerCase()) return;

    if (data.torrents) {
      const moreData = this.state.moreData;

      let maxSeason = 1;
      data.torrents.forEach((t) => {
        const s = parseInt(t.season);
        if (s > maxSeason && moreData && moreData.seasons && s <= moreData.seasons.length) {
          maxSeason = s;
        }
      });

      this.setState({ eztv: data, season: maxSeason, maxSeason, loadingEpisodes: false });
    } else {
      this.setState({ loadingEpisodes: false });
    }
  }

  getNyaa(title, page) {
    if (this.nyaaTimeout) clearTimeout(this.nyaaTimeout);
    this.nyaaTimeout = setTimeout(
      () => {
        const limit = 50;
        const url = `${this.props.server}/nyaa/?q=${title}&limit=${limit}&page=${page}`;

        if (Cache[url]) {
          this.handleNyaa(Cache[url], title, page, limit);
        } else {
          this.axiosGetHelper(url)
            .then((response) => {
              const data = response.data;
              Cache[url] = data;
              this.handleNyaa(data, title, page, limit);
            })
            .catch((err) => {
              if (axios.isCancel(err)) return;
              console.error(err);
              this.setState({ loadingEpisodes: false });
            });
        }
      },
      this.props.viewMode === 'carousel' ? 2000 : 0
    );
  }

  handleNyaa(data, title, page, limit) {
    // Try to handle case where we were loading different data and now are trying to update incorrectly
    if (!this.props.media || title !== this.props.media.title) return;

    let nyaa = this.state.nyaa || data;
    if (nyaa !== data) nyaa.torrents.push(...data.torrents);

    this.setState({ nyaa: nyaa }, () => {
      // If there are more pages, get them
      if (page * limit < data.totalRecordCount) {
        this.getNyaa(title, page + 1);
      } else {
        this.setState({ loadingEpisodes: false });
      }
    });
  }

  getHorribleSubs() {
    if (this.horribleSubsTimeout) clearTimeout(this.horribleSubsTimeout);
    this.horribleSubsTimeout = setTimeout(
      () => {
        const url = `${this.props.server}/horribleSubs/${this.props.media.title}`;

        if (Cache[url]) {
          this.handleHorribleSubs(Cache[url]);
        } else {
          this.axiosGetHelper(url)
            .then((response) => {
              const data = response.data;
              Cache[url] = data;

              this.handleHorribleSubs(data);
            })
            .catch((err) => {
              if (axios.isCancel(err)) return;
              console.error(err);
            });
        }
      },
      this.props.viewMode === 'carousel' ? 2000 : 0
    );
  }

  handleHorribleSubs(data) {
    const parsed = parseHorribleSubs(data);
    let nyaa = this.state.nyaa || parsed;
    if (nyaa !== parsed) nyaa.torrents.push(...parsed.torrents);

    this.setState({ horribleSubs: parsed.batches, nyaa });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    const { media, type } = this.props;

    if (!media && this.state === prevState) {
      this.setState(this.getDefaultState());
      return;
    }

    if (media && (this.state.onLoad || media.id !== (prevProps.media ? prevProps.media.id : ''))) {
      this.cancelRequests();

      if (type === 'animes') {
        this.axiosGetHelper(`${this.props.server}/kitsu/${media.id}`)
          .then((response) => {
            const data = response.data.data;
            media.title = media.title || data.attributes.canonicalTitle;
            media.year = media.year || getYear(data);

            this.setState({
              moreData: {
                CoverImage: data.attributes.coverImage ? data.attributes.coverImage.large : '',
                Plot: data.attributes.synopsis,
                Rated: data.attributes.ageRating,
                Genres: data.relationships.genres.data.map((g) => Genre.anime.find((i) => g.id === i.id).label),
                EpisodeCount: data.attributes.episodeCount,
                PosterPath: data.attributes.posterImage.small,
              },
              loadingEpisodes: true,
            });

            this.getNyaa(media.title, 1);
            this.getHorribleSubs();
          })
          .catch((err) => {
            if (axios.isCancel(err)) return;
            console.error(err);
            this.setState({ moreData: 'ERROR' });
          });
      } else {
        this.axiosGetHelper(this.props.server + '/tmdbid/' + (type === 'movies' ? 'movie/' : 'tv/') + media.id)
          .then((response) => {
            const data = response.data;
            const updated = { tmdbData: data, loadingEpisodes: type === 'shows' || type === 'subscriptions', showCover: true };
            media.title = media.title || data.title || data.original_name;
            media.year = media.year || getYear(data);
            if (type === 'shows' || type === 'subscriptions') updated.moreData = data;

            this.setState(updated);

            if (type === 'shows' || type === 'subscriptions') {
              const moreData = data;
              if (moreData.seasons) {
                moreData.seasons.forEach((season) => {
                  this.axiosGetHelper(`${this.props.server}/tmdb/seasons/${media.id}/${season.season_number}`)
                    .then((response) => {
                      if (moreData.seasons[season.season_number - 1]) {
                        moreData.seasons[season.season_number - 1].episodes = response.data.episodes;
                        this.setState({ moreData: moreData });
                      }
                    })
                    .catch((err) => {
                      if (axios.isCancel(err)) return;
                      console.error(err);
                    });
                });
              }
              this.getEztv(media);
            } else {
              const omdbUrl = this.props.server + '/omdb/' + data.imdb_id;

              if (Cache[omdbUrl]) {
                this.setState({ moreData: Cache[omdbUrl] });
              } else {
                this.axiosGetHelper(omdbUrl)
                  .then((response) => {
                    this.setState({ moreData: response.data });
                  })
                  .catch((err) => {
                    if (axios.isCancel(err)) return;
                    console.error(err);
                    this.setState({ moreData: 'ERROR' });
                  });
              }

              if (this.pirateTimeout) clearTimeout(this.pirateTimeout);
              this.pirateTimeout = setTimeout(
                () => {
                  const pirateUrl = getPirateSearchUrl(this.props.server, media.title, media.year);

                  if (Cache[pirateUrl]) {
                    this.setState({ pb: Cache[pirateUrl] });
                  } else {
                    this.axiosGetHelper(pirateUrl)
                      .then((response) => {
                        this.setState({ pb: response.data });
                      })
                      .catch((err) => {
                        if (axios.isCancel(err)) return;
                        console.error(err);
                      });
                  }
                },
                this.props.viewMode === 'carousel' ? 2000 : 0
              );
            }
          })
          .catch((err) => {
            if (axios.isCancel(err)) return;
            console.error(err);
            this.setState({ moreData: 'ERROR' });
          });
      }
      if (this.state.onLoad) this.setState({ onLoad: false });
      // } else if (this.state !== prevState) {
      //     this.setState({tmdbData: null, moreData: null, pb: null, eztv: null, nyaa: null, season: 1, maxSeason: 1, showCover: true});
      // }
    }
  }

  imageError() {
    this.setState({ showCover: false });
  }

  updateSeason(season) {
    this.setState({ season: season });
  }

  downloadSeason(episodes) {
    episodes.forEach((episode) => {
      if (episode.torrents.length > 0) this.props.downloadTorrent(episode.torrents[0]);
    });
  }

  toggleSubscription() {
    this.setState({ subscribing: true });
    const media = this.props.media;
    this.props.toggleSubscription(media, () => setTimeout(() => this.setState({ subscribing: false }), 2000));
  }

  playYoutubeVideo(youtubeId) {
    if (window.cordova) {
      window.open(`http://www.youtube.com/watch?v=${youtubeId}`, '_blank');
    } else {
      this.setState({ youtubeId });
    }
  }

  render() {
    const {
      downloadTorrent,
      cancelTorrent,
      getTorrent,
      getProgress,
      started,
      type,
      onOpenModal,
      onCloseModal,
      files,
      status,
      loading,
      viewMode,
    } = this.props;

    const {
      tmdbData,
      moreData,
      eztv,
      nyaa,
      pb,
      horribleSubs,
      season,
      maxSeason,
      youtubeId,
      loadingEpisodes,
      subscribing,
      otherVideos,
    } = this.state;

    let media = this.props.media || {};

    const showCover = this.state.showCover && viewMode === 'standard';

    let backdrop = media.backdrop_path;
    let posterPath = media.poster_path;
    if (tmdbData) {
      backdrop = tmdbData.backdrop_path;
      posterPath = 'https://image.tmdb.org/t/p/w300_and_h450_bestv2' + tmdbData.poster_path;
    }
    if (moreData && moreData.PosterPath) posterPath = moreData.PosterPath;

    const versions = getMovies(media, pb ? pb.torrents : [], type);

    const seasons = getSeasons(type, maxSeason, moreData);
    const episodes = getEpisodes(eztv || nyaa, moreData, type);

    const details = getDetails(media, moreData, tmdbData, type, maxSeason);
    const fileExists = hasFile(media, files);

    const trailerOpts = {
      // https://developers.google.com/youtube/player_parameters
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
      },
    };

    const backgroundUrl =
      type === 'animes'
        ? moreData && moreData !== 'ERROR'
          ? `${moreData.CoverImage}`
          : ''
        : backdrop
        ? `https://image.tmdb.org/t/p/w300${backdrop}`
        : 'unset';

    let recommendations =
      tmdbData && tmdbData.recommendations && tmdbData.recommendations.results ? tmdbData.recommendations.results : undefined;

    const innerContent = !media.id ? null : (
      <div
        ref={this.containerRef}
        className={'backdropContainer ' + viewMode}
        onClick={(e) => {
          if (viewMode === 'standard') {
            this.setState(this.getDefaultState());
            onCloseModal();
          }
        }}
        onScroll={(e) => {
          // Prevent scrolling vertically
          if (this.containerRef.current.scrollTop !== 0) this.containerRef.current.scrollTop = 0;
        }}
        style={{
          height: viewMode === 'standard' ? '100vh' : undefined,
          position: viewMode === 'carousel' && youtubeId ? 'unset' : undefined,
        }}
      >
        {youtubeId ? (
          <div className={'ytContainer ' + viewMode} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                this.setState({ youtubeId: null });
              }}
            >
              <FaTimes />
            </button>
            <YouTube videoId={youtubeId} opts={trailerOpts} id="youtube" onEnd={() => this.setState({ youtubeId: null })} />
          </div>
        ) : null}
        <div className="left">
          <div className="info">
            <h3>
              {media.title || media.original_name || ''}
              {(type === 'shows' || type === 'subscriptions') && status && status.subscriptions ? (
                subscribing ? (
                  <span className="subscription">
                    <Spinner visible />
                  </span>
                ) : (
                  <FaRssSquare
                    className={`subscription ${hasSubscription(media.id, status.subscriptions) ? 'orange' : 'gray'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      this.toggleSubscription();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') this.toggleSubscription();
                    }}
                    tabIndex="0"
                  />
                )
              ) : null}
            </h3>
            {details ? (
              <h4>
                <Fragment>
                  <span>{details.header || ''}</span>
                  {moreData ? <div className="mpaa-rating">{details.mpaa}</div> : null}
                  {/* {fileExists && viewMode !== 'carousel' ? (
                    <div className="fileExists">
                      <FaPlayCircle
                        onClick={e => {
                          e.stopPropagation();
                          window.open(fileExists.url, '_blank').focus();
                        }}
                        onKeyPress={e => {
                          if (e.key === 'Enter') window.open(fileExists.url, '_blank').focus();
                        }}
                        tabIndex="0"
                      />
                    </div>
                  ) : null} */}
                </Fragment>
              </h4>
            ) : null}
            <Ratings moreData={moreData} imdb={tmdbData ? tmdbData.imdb_id : null} />
            {details.trailer ? (
              <div
                className="trailer"
                onClick={(e) => {
                  e.stopPropagation();
                  this.playYoutubeVideo(details.trailer.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') this.playYoutubeVideo(details.trailer.key);
                }}
                tabIndex="0"
              >
                <FaYoutube className="red" />
                <div>Trailer</div>
              </div>
            ) : null}
          </div>
          <div className="spacer"></div>
          {showCover && posterPath ? (
            <div className="coverWrap">
              <img src={posterPath} alt={media.title} onError={this.imageError.bind(this)} />
              {fileExists ? (
                <div className="fileExists">
                  <FaPlayCircle
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(fileExists.url, '_blank').focus();
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') window.open(fileExists.url, '_blank').focus();
                    }}
                    tabIndex="0"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {tmdbData && tmdbData.videos && tmdbData.videos.results.length > 0 ? (
          <div className={'otherVideos' + (!otherVideos ? ' hidden' : '')} onClick={(e) => e.stopPropagation()}>
            <div className="toggle">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  this.setState({ otherVideos: !this.state.otherVideos });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') this.setState({ otherVideos: !this.state.otherVideos });
                }}
                tabIndex="0"
              >
                <FaYoutube className="red" /> YouTube Extras {otherVideos ? <FaChevronDown /> : <FaChevronUp />}
              </span>
            </div>
            <div className="videoContainer" tabIndex="-1">
              {tmdbData.videos.results.map((v) => {
                if (v.site === 'YouTube') {
                  return (
                    <div className="video" key={v.key}>
                      <img
                        src={`https://img.youtube.com/vi/${v.key}/0.jpg`}
                        loading="lazy"
                        alt={v.name}
                        onClick={() => this.playYoutubeVideo(v.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') this.playYoutubeVideo(v.key);
                        }}
                        tabIndex={this.state.otherVideos ? '0' : '-1'}
                      />
                      <div className="title">{v.name}</div>
                    </div>
                  );
                } else {
                  return null;
                }
              })}
            </div>
          </div>
        ) : null}
        {viewMode === 'carousel' && !window.cordova ? (
          <div
            className="closeButton"
            tabIndex="0"
            onClick={(e) => {
              e.preventDefault();
              const menu = document.querySelector('.toggleButton');
              if (menu) menu.focus();
            }}
          >
            <FaTimes />
          </div>
        ) : null}
        <div className="spacer"></div>
        <div
          className={'right' + (tmdbData && tmdbData.videos && tmdbData.videos.results.length > 0 ? ' videos' : '')}
          onClick={(e) => e.stopPropagation()}
          tabIndex="-1"
        >
          <div className="details" tabIndex="0">
            <div className="plot padding">{details.plot}</div>
            {details.genres ? <div className="capitalize padding">{details.genres}</div> : null}

            {type === 'movies' ? (
              moreData !== 'ERROR' && moreData !== null ? (
                <Fragment>
                  {details.director ? <div className="padding">{details.director}</div> : null}
                  {details.writers ? <div className="padding">{details.writers}</div> : null}
                  <div className="padding">Actors: {moreData.Actors}</div>
                </Fragment>
              ) : (
                <Fragment>
                  {moreData === 'ERROR' || moreData !== null ? null : (
                    <Fragment>
                      <span>
                        Loading additional data...
                        <Spinner visible />
                      </span>
                    </Fragment>
                  )}
                </Fragment>
              )
            ) : null}
          </div>

          <br />

          {type === 'movies' ? (
            pb ? (
              versions.length > 0 ? (
                <div className="versions">
                  {versions.map((version) => (
                    <Version
                      key={version.hashString}
                      version={version}
                      started={started}
                      getProgress={getProgress}
                      getTorrent={getTorrent}
                      downloadTorrent={(version) => {
                        if (
                          !fileExists ||
                          (!window.cordova &&
                            window.confirm('This file already exists in plex. Are you sure you want to download it again?'))
                        ) {
                          downloadTorrent(version);
                        } else if (window.cordova) {
                          confirm(
                            'This file already exists in plex. Are you sure you want to download it again?',
                            (button) => {
                              if (button === 2) downloadTorrent(version);
                            },
                            'Confirm',
                            ['No', 'Yes']
                          );
                        }
                      }}
                      cancelTorrent={cancelTorrent}
                      hideInfo={true}
                      hideBar={true}
                    />
                  ))}
                </div>
              ) : (
                <h4>No Torrents Found</h4>
              )
            ) : (
              <span>
                Loading torrent data...
                <Spinner visible />
              </span>
            )
          ) : (
            <Fragment>
              {loadingEpisodes ? (
                <span>
                  Loading torrent data - episodes...
                  <Spinner visible />
                </span>
              ) : null}
              {!eztv && !nyaa ? null : episodes.length === 0 ? (
                <h4>No Torrents Found</h4>
              ) : (
                <Fragment>
                  <h3 className="season">
                    Season
                    {seasons.length > 1 ? (
                      <select onChange={(event) => this.updateSeason(event.target.value)} value={season}>
                        {seasons.map((season) => (
                          <option key={season} value={season}>
                            {season}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ' 1'
                    )}
                    {episodes[season] && episodes[season].length > 0 ? (
                      <button className="orange download" onClick={() => this.downloadSeason(episodes[season])}>
                        <FaDownload />
                      </button>
                    ) : null}
                  </h3>
                  {horribleSubs && horribleSubs.length > 0 ? (
                    <div>
                      <h4 className="episode">
                        <FaStar className="purple" />
                        Horrible Subs Bundle (ep {horribleSubs[0].episode})
                        <FaStar className="purple" />
                      </h4>
                      <div className="versions">
                        {horribleSubs
                          .sort((a, b) => Number.parseInt(b.quality) - Number.parseInt(a.quality))
                          .map((t) => (
                            <Version
                              key={t.filename + t.quality}
                              version={t}
                              started={started}
                              getProgress={getProgress}
                              getTorrent={getTorrent}
                              downloadTorrent={downloadTorrent}
                              cancelTorrent={cancelTorrent}
                              hideInfo={true}
                              hideBar={true}
                            />
                          ))}
                      </div>
                      <hr />
                    </div>
                  ) : null}
                  {(type === 'shows' || type === 'subscriptions') && moreData && moreData.seasons && moreData.seasons[season - 1] ? (
                    <span>{moreData.seasons[season - 1].overview}</span>
                  ) : null}
                  <div className="episodeList">
                    {episodes[season] && episodes[season].length > 0
                      ? episodes[season].map((episode) =>
                          episode ? (
                            <Fragment key={episode.episode}>
                              <h4 className="episode">{episode.title}</h4>

                              <div className="versions">
                                {episode.torrents
                                  ? episode.torrents.map((version) => (
                                      <Version
                                        key={version.hashString}
                                        version={version}
                                        started={started}
                                        getProgress={getProgress}
                                        getTorrent={getTorrent}
                                        downloadTorrent={downloadTorrent}
                                        cancelTorrent={cancelTorrent}
                                        hideInfo={true}
                                        hideBar={true}
                                      />
                                    ))
                                  : null}
                              </div>
                            </Fragment>
                          ) : null
                        )
                      : null}
                  </div>
                </Fragment>
              )}
            </Fragment>
          )}

          {recommendations && recommendations.length > 0 ? (
            <Fragment>
              <h4>You Might Also Like...</h4>
              <div className="recommendationContainer">
                <div className="recommendations" tabIndex="-1">
                  {recommendations.map((r) => {
                    const recommendation = parseMedia(r, 'movies');

                    return (
                      <div
                        key={r.id}
                        className="item"
                        tabIndex="0"
                        onClick={() => {
                          this.setState(this.getDefaultState(), () => {
                            onOpenModal(recommendation);
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            this.setState(this.getDefaultState(), () => {
                              onOpenModal(recommendation);
                            });
                        }}
                      >
                        <img src={r.poster_path} alt={r.title} loading="lazy" />
                        <div className="title">{r.title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Fragment>
          ) : null}
        </div>
      </div>
    );

    return viewMode === 'standard' ? (
      <Modal
        open={this.props.media !== null && !loading}
        modalId={'modalFullscreen'}
        overlayId="overlay"
        onClose={() => {
          if (youtubeId) {
            this.setState({ youtubeId: null });
            return;
          }

          onCloseModal();
        }}
        styles={{
          closeIcon: { fill: '#bbb', stroke: '#bbb' },
        }}
        closeIconId="closeButton"
        focusTrapOptions={{
          initialFocus: '#modalFullscreen #closeButton',
        }}
      >
        <MultiImage src={backgroundUrl} />
        {innerContent}
      </Modal>
    ) : (
      <div className="backdropCarousel" style={{ position: 'relative' }}>
        <MultiImage src={backgroundUrl} />
        {innerContent}
      </div>
    );
  }
}

export default DetailsBackdrop;
