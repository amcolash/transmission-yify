import React, { Component, Fragment } from 'react';
import { FaDownload } from 'react-icons/fa';
import Modal from 'react-responsive-modal';
import axios from 'axios';

import '../css/DetailsBackdrop.css';
import Version from './Version';
import Spinner from './Spinner';
import Ratings from './Ratings';
import Genre from '../../Data/Genre';
import { getDetails, getMovies, getSeasons, getEpisodes } from '../../Util/Parse';

class DetailsBackdrop extends Component {

    constructor(props) {
        super(props);
        this.state = { tmdbData: null, moreData: null, pb: null, eztv: null, nyaa: null, season: 1, maxSeason: 1, showCover: true };
    }

    getEztv(imdb, page) {
        const moreData = this.state.moreData;

        const limit = 50;
        const url = `${this.props.server}/eztv/?limit=${limit}&page=${page}&imdb_id=${imdb}`;
        
        axios.get(url).then(response => {
            // Make sure that the show was found and we are not just getting
            // the newest shows on the site. This is a bad api design for them :(
            const data = response.data;
            if (data.torrents_count < 2000 && data.torrents) {

                let maxSeason = this.state.maxSeason;
                let newMax = false;
                data.torrents.forEach(t => {
                    const s = parseInt(t.season);
                    if (s > maxSeason && moreData && s <= moreData.seasons.length) { maxSeason = s; newMax = true; }
                });
                
                let eztv = this.state.eztv || response.data;
                if (eztv !== response.data) response.data.torrents.forEach(t => eztv.torrents.push(t));

                this.setState({ eztv: eztv, season: (page === 1 || newMax) ? maxSeason : this.state.season, maxSeason: maxSeason }, () => {
                    // If there are more pages, get them
                    if (page * limit < data.torrents_count) {
                        this.getEztv(imdb, page + 1);
                    }
                });
            } else {
                this.setState({ eztv: { torrents: [] }});
            }
        }).catch(err => {
            console.error(err);
        });
    }

    getNyaa(title, page) {
        const limit = 50;
        const url = `${this.props.server}/nyaa/?q=${title}&limit=${limit}&page=${page}`;

        axios.get(url).then(response => {
            const data = response.data;
            
            let nyaa = this.state.nyaa || response.data;
            if (nyaa !== response.data) response.data.torrents.forEach(t => nyaa.torrents.push(t));

            this.setState({nyaa: nyaa}, () => {
                // If there are more pages, get them
                if (page * limit < data.totalRecordCount) {
                    this.getNyaa(title, page + 1);
                }
            });
        }).catch(err => {
            console.error(err);
        });
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        const { media, type } = this.props;

        if (media && media !== prevProps.media && this.state === prevState) {
            if (type === 'animes') {
                axios.get(`${this.props.server}/kitsu/${media.id}`).then(response => {
                    const data = response.data.data;
                    this.setState({moreData: {
                        CoverImage: data.attributes.coverImage.large,
                        Plot: data.attributes.synopsis,
                        Rated: data.attributes.rating,
                        Genres: data.relationships.genres.data.map(g => Genre.anime.find(i => g.id === i.id).label),
                        EpisodeCount: data.attributes.episodeCount
                    }});

                    this.getNyaa(media.title, 1);
                }).catch(err => {
                    console.error(err);
                    this.setState({ moreData: "ERROR" });
                });
            } else {
                axios.get(this.props.server + '/tmdbid/' + (type === 'shows' ? 'tv/' : 'movie/') + media.id).then(response => {
                    this.setState({ tmdbData: response.data });
        
                    if (type === 'shows') {
                        this.setState({moreData: response.data}, () => {
                            const moreData = this.state.moreData;
                            moreData.seasons.forEach(season => {
                                axios.get(`${this.props.server}/tmdb/seasons/${media.id}/${season.season_number}`).then(response => {
                                    if (moreData.seasons[season.season_number - 1]) {
                                        moreData.seasons[season.season_number - 1].episodes = response.data.episodes;
                                        this.setState({moreData: moreData});
                                    }
                                }).catch(err => {
                                    console.error(err);
                                })
                            });
                        });
                        
                        const imdb = response.data.external_ids.imdb_id.replace('tt', '');
                        this.getEztv(imdb, 1);
                    } else {
                        axios.get(this.props.server + '/omdb/' + response.data.imdb_id).then(response => {
                            this.setState({ moreData: response.data });
                        }).catch(error => {
                            console.error(error);
                            this.setState({ moreData: "ERROR" });
                        });
        
                        const cleanedTitle = media.title.replace(/[^\w\s]/gi, ' ');
                        axios.get(`${this.props.server}/pirate/${cleanedTitle} ${media.year}`).then(response => {
                            this.setState({pb: response.data});
                        }).catch(err => {
                            console.error(err);
                        });
                    }
                }).catch(error => {
                    console.error(error);
                    this.setState({ moreData: "ERROR" });
                });
            }
        // } else if (this.state !== prevState) {
        //     this.setState({tmdbData: null, moreData: null, pb: null, eztv: null, nyaa: null, season: 1, maxSeason: 1, showCover: true});
        }
    }

    imageError() {
        this.setState({ showCover: false });
    }

    updateSeason(season) {
        this.setState({ season: season });
    }

    downloadSeason(episodes) {
        episodes.forEach(episode => {
            if (episode.torrents.length > 0) this.props.downloadTorrent(episode.torrents[0]);
        });
    }

    render() {
        const { media, downloadTorrent, cancelTorrent, getLink, getTorrent, getProgress, started, type, onCloseModal, width } = this.props;
        const { tmdbData, moreData, showCover, eztv, nyaa, pb, season, maxSeason } = this.state;
        
        if (!media) return null;

        let versions = getMovies(media, pb ? pb.torrents : [], type);

        let seasons = getSeasons(type, maxSeason, moreData);
        let episodes = getEpisodes(eztv || nyaa, moreData, type);


        const details = getDetails(media, moreData, tmdbData, type, maxSeason);

        return (
            <Modal
                open={media !== null}
                center={width > 800}
                modalId={'modalFullscreen'}
                overlayId='overlay'
                onClose={onCloseModal}
                styles={{
                    modal: {
                        backgroundImage: (type === 'animes' ? (moreData && moreData !== 'ERROR' ? `url(${moreData.CoverImage})` : ''):
                            `url(https://image.tmdb.org/t/p/w1280/${media.backdrop_path})`)
                    },
                    closeIcon: {
                        fill: '#bbb',
                        stroke: '#bbb',
                    }
                }}
            >
                <div className="container" onClick={e => {
                    this.setState({tmdbData: null, moreData: null, pb: null, eztv: null, nyaa: null, season: 1, maxSeason: 1, showCover: true});
                    onCloseModal();
                }}>
                    <div className="info">
                        <h3>{media.title}</h3>
                        <h4>
                            <Fragment>
                                <span>{details.header}</span>
                                <div className="mpaa-rating">{details.mpaa}</div>
                            </Fragment>
                        </h4>
                        <Ratings moreData={moreData}/>
                    </div>
                    {showCover ? (
                        <img
                            className="cover"
                            src={media.poster_path}
                            alt={media.title}
                            onError={this.imageError.bind(this)}
                        />
                    ) : null }
                    <div className="spacer"></div>
                    <div className="right" onClick={e => e.stopPropagation()}>
                        <div className="plot padding">{details.plot}</div>
                        {details.genres ? <div className="capitalize padding">{details.genres}</div> : null}
                        
                        {type === 'movies' ? moreData !== "ERROR" && moreData !== null ? (
                            <Fragment>
                                {details.director ? <div className="padding">{details.director}</div> : null}
                                {details.writers ? <div className="padding">{details.writers}</div> : null}
                                <div className="padding">Actors: {moreData.Actors}</div>
                            </Fragment>
                        ) : (
                            <Fragment>
                                {moreData === "ERROR" || moreData !== null ? null : (
                                    <Fragment>
                                        <span>Loading additional data...<Spinner visible/></span>
                                    </Fragment>
                                )}
                            </Fragment>
                        ) : null}

                        <br/>

                        {type === 'movies' ? (
                            pb ? (
                                versions.length > 0 ? (
                                    <div className="versions">
                                        {versions.map(version => (
                                            <Version
                                                key={version.hashString}
                                                version={version}
                                                started={started}
                                                getProgress={getProgress}
                                                getLink={getLink}
                                                getTorrent={getTorrent}
                                                downloadTorrent={downloadTorrent}
                                                cancelTorrent={cancelTorrent}
                                            />
                                        ))}
                                    </div>
                                ) : <h4>No Torrents Found</h4>
                            ) : <span>Loading torrent data...<Spinner visible/></span>
                        ) : (
                            (!eztv && !nyaa) ? <span>Loading torrent data...<Spinner visible/></span> : (
                                episodes.length === 0 ? <h4>No Torrents Found</h4> : (
                                    <Fragment>
                                        <h3 className="season">Season
                                            {seasons.length > 1 ? (
                                                <select onChange={(event) => this.updateSeason(event.target.value)} value={season}>
                                                    {seasons.map(season => ( <option key={season} value={season}>{season}</option> ))}
                                                </select>
                                            ) : " 1"}
                                            {(episodes[season]) ? (
                                                <button className="orange download" onClick={() => this.downloadSeason(episodes[season])}>
                                                    <FaDownload/>
                                                </button>
                                            ) : null}
                                        </h3>
                                        {type === 'shows' && moreData && moreData.seasons && moreData.seasons[season-1] ? (
                                            <span>{moreData.seasons[season-1].overview}</span>
                                        ) : null}
                                        <div className="episodeList">
                                            {(episodes[season] && episodes[season].length > 0) ? (
                                                episodes[season].map(episode => (
                                                    episode ? (
                                                    <Fragment key={episode.episode}>
                                                        <h4 className="episode">{episode.title}</h4>

                                                        <div className="versions">
                                                            {episode.torrents ? episode.torrents.map(version => (
                                                            <Version
                                                                key={version.hashString}
                                                                version={version}
                                                                started={started}
                                                                getProgress={getProgress}
                                                                getLink={getLink}
                                                                getTorrent={getTorrent}
                                                                downloadTorrent={downloadTorrent}
                                                                cancelTorrent={cancelTorrent}
                                                                hideInfo={true}
                                                                hideBar={true}
                                                            />
                                                            )) : null}
                                                        </div>
                                                    </Fragment>
                                                    ) : null
                                                ))
                                            ) : null}
                                        </div>
                                    </Fragment>
                                )
                            )
                        )}
                    </div>
                </div>
            </Modal>
        );
    }
}

export default DetailsBackdrop;