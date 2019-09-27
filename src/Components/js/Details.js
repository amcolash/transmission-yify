import React, { Component, Fragment } from 'react';
import { FaDownload, FaPlayCircle } from 'react-icons/fa';
import axios from 'axios';

import '../css/Details.css';
import Version from './Version';
import Spinner from './Spinner';
import Genre from '../../Data/Genre';
import { getMovies, getEpisodes } from '../../Util/Parse';

class Details extends Component {

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

    componentDidMount() {
        const media = this.props.media;
        const type = this.props.type;

        if (type === 'animes') {
            axios.get(`${this.props.server}/kitsu/${media.id}`).then(response => {
                const data = response.data.data;
                this.setState({moreData: {
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
    }

    convertTime(min) {
        if (!min) return '';
        min = Number.parseInt(min.replace(' min', ''));

        const hours = Math.floor(min / 60);
        const minutes = Math.floor(((min / 60) - hours) * 60);
        
        return (hours > 0 ? hours + "h " : "") + (minutes > 0 ? minutes + "m" : "");
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
        const { media, downloadTorrent, cancelTorrent, getLink, getTorrent, getProgress, started, type } = this.props;
        const { tmdbData, moreData, showCover, eztv, nyaa, pb, season, maxSeason } = this.state;

        let versions = [];
        let seasons = [];
        let episodes = [];

        if (type === 'shows' || type === 'animes') {
            if (type === 'shows') {
                for (let i = 1; i < maxSeason + 1; i++) {
                    if (moreData && i <= moreData.seasons.length) seasons.push(i);
                }
            } else {
                seasons.push(1);
            }

            episodes = getEpisodes(eztv || nyaa, moreData, type);
        }

        if (type === 'movies' && pb) {
            versions = getMovies(media, pb);
        }

        var mpaa = media.certification;
        if (!mpaa || mpaa === "N/A") {
            if (moreData && moreData.Rated && moreData.Rated !== "N/A") {
                mpaa = moreData.Rated;
            } else {
                mpaa = "NR";
            }
        }

        let genres;

        if (tmdbData) {
            genres = tmdbData.genres.map(g => g.name);
            genres = (genres.length > 1 ? 'Genres: ' : 'Genre: ') + genres.join(', ');
        } else if (moreData) {
            if (moreData) genres = moreData.genres || moreData.Genres;
            else genres = [];

            genres = (genres.length === 1 ? "Genre: " : "Genres: ") +
                JSON.stringify(genres).replace(/[[\]"]/g, '').replace(/,/g, ', ');
        }

        return (
            <div className="container">
                {showCover ? (
                    <div className="left">
                        <img
                            src={media.poster_path}
                            alt={media.title}
                            onError={this.imageError.bind(this)}
                        />
                        {media.trailer ? (
                            <Fragment>
                                <hr/>
                                <a href={media.trailer} target="_blank" rel="noopener noreferrer"><FaPlayCircle />Trailer</a>
                            </Fragment>
                        ) : null}
                    </div>
                ) : null }
                <div className="right">
                    <h3>
                        {media.title}
                    </h3>
                    <h4>
                        <Fragment>
                            {type === 'movies' ? (
                                <span>{media.year}{moreData ? ', ' + this.convertTime(moreData.Runtime) : null}</span>
                            ) : (
                                <span>{(moreData && moreData.Year) ? moreData.Year : media.year} ({maxSeason + (maxSeason > 1 ? ' Seasons' : ' Season')})</span>
                            )}
                            <div className="mpaa-rating">{mpaa}</div>
                        </Fragment>
                    </h4>
                    <p className="plot">{(moreData && moreData.Plot) ? moreData.Plot : ((moreData && moreData.overview) ?
                        moreData.overview : (media.synopsis ? media.synopsis : ""))}</p>
                    {genres ? (
                        <Fragment>
                            <span className="capitalize">
                                {genres}
                            </span>
                            <br/>
                        </Fragment>
                    ) : null}
                    
                    {type === 'movies' ? moreData !== "ERROR" && moreData !== null ? (
                        <Fragment>
                            {moreData.Ratings.map(rating => (
                                <Fragment key={rating.Source}>
                                    {rating.Source === "Internet Movie Database" ? (
                                        <Fragment>
                                            <a href={"https://www.imdb.com/title/" + media.imdb_id} target="_blank" rel="noopener noreferrer">IMDB Rating</a>
                                            <span>: {rating.Value}</span>
                                        </Fragment>
                                    ) : (
                                        <span>{rating.Source}: {rating.Value}</span>
                                    )}
                                    <br/>
                                </Fragment>
                            ))}
                            <hr/>
                            {(moreData.Director.indexOf("N/A") === -1) ? (
                                <Fragment>
                                    <span>{moreData.Director.indexOf(",") !== -1 ? "Directors" : "Director"}: {moreData.Director}</span>
                                    <br/>
                                </Fragment>
                            ) : null}
                            <span>{moreData.Writer.indexOf(",") !== -1 ? "Writers" : "Writer"}: {moreData.Writer}</span>
                            <br/>
                            <span>Actors: {moreData.Actors}</span>
                        </Fragment>
                    ) : (
                        <Fragment>
                            {moreData === "ERROR" || moreData !== null ? (
                                null
                            ) : (
                                <Fragment>
                                    <hr/>
                                    <span>
                                        Loading additional data...
                                        <Spinner visible/>
                                    </span>
                                </Fragment>
                            )}
                        </Fragment>
                    ) : null}

                    <hr/>

                    {type === 'movies' ? (
                        pb ? (
                            versions.length > 0 ? (
                                versions.map(version => (
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
                                ))
                            ) : <h4>No Torrents Found</h4>
                        ) : (
                            <span>
                                Loading torrent data...
                                <Spinner visible/>
                            </span>
                        )
                    ) : (
                        (!eztv && !nyaa) ? (
                            <Fragment>
                                Loading torrent data...
                                <Spinner visible/>
                            </Fragment>
                        ) : (
                            episodes.length > 0 ? (
                                <Fragment>
                                    <h3 className="season">Season
                                        {seasons.length > 1 ? (
                                            <select
                                                onChange={(event) => this.updateSeason(event.target.value)}
                                                value={season}
                                            >
                                                {seasons.map(season => (
                                                    <option key={season} value={season}>{season}</option>
                                                ))}
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
                                                    {episode.title === "Episode " + episode.episode ? (
                                                        <h4 className="episode">{episode.title}</h4>
                                                    ) : (
                                                        <h4 className="episode">{episode.episode} - {episode.title}</h4>
                                                    )}

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
                                                        />
                                                        )) : null}
                                                </Fragment>
                                                ) : null
                                            ))
                                        ) : null}
                                    </div>
                                </Fragment>
                            ) : (
                                <h4>No Torrents Found</h4>
                            )
                        )
                    )}
                </div>
            </div>
        );
    }
}

export default Details;