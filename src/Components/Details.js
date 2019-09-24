import React, { Component, Fragment } from 'react';
import { FaDownload, FaPlayCircle } from 'react-icons/fa';
import axios from 'axios';
import magnet from 'magnet-uri';
import * as  ptn  from 'parse-torrent-name';

import './Details.css';
import Version from './Version';
import Spinner from './Spinner';

class Details extends Component {

    constructor(props) {
        super(props);
        this.state = { tmdbData: null, moreData: null, tvData: null, pb: null, eztv: null, season: 1, maxSeason: 1, showCover: true };
    }

    componentDidMount() {
        const movie = this.props.movie;

        if (movie.num_seasons) {
            var endpoint = 'https://tv-v2.api-fetch.website/show/'  + movie.imdb_id;
            if (movie.mal_id) {
                endpoint = 'https://tv-v2.api-fetch.website/anime/' + movie._id;
            } else {
                // Not anime, get additional data
                const imdb = movie.imdb_id.replace('tt', '');
                axios.get(`https://eztv.io/api/get-torrents?limit=100&imdb_id=${imdb}`, { timeout: 20000 }).then(response => {
                    // Make sure that the show was found and we are not just getting
                    // the newest shows on the site. This is a bad api design for them :(
                    if (response.data.torrents_count < 2000) {
                        const data = response.data;
                        let maxSeason = this.state.maxSeason;
                        data.torrents.forEach(t => {
                            const s = parseInt(t.season);
                            if (s > maxSeason) maxSeason = s;
                        });

                        this.setState({ eztv: response.data, season: maxSeason, maxSeason: maxSeason });
                    } else {
                        this.setState({ eztv: { torrents: [] }});
                    }
                }, error => {
                    console.error(error);
                });    
            }

            axios.get(endpoint, { timeout: 10000 }).then(response => {
                this.setState({ tvData: response.data, season: response.data.num_seasons, maxSeason: response.data.num_seasons });
            }, error => {
                console.error(error);
            });
        }

        // If anime, no extra data
        if (movie.mal_id) {
            this.setState({ moreData: "ERROR" });
        } else {
            axios.get(this.props.server + '/tmdbid/' + movie.id, { timeout: 10000 }).then(response => {
                this.setState({ tmdbData: response.data });

                axios.get(this.props.server + '/omdb/' + response.data.imdb_id, { timeout: 10000 }).then(response => {
                    this.setState({ moreData: response.data });
                }).catch(error => {
                    console.error(error);
                    this.setState({ moreData: "ERROR" });
                });
            }).catch(error => {
                console.error(error);
                this.setState({ moreData: "ERROR" });
            });

            // Try to find torrents from the pirate bay
            axios.get(this.props.server + '/pirate/' + movie.title + ' ' + movie.year).then(response => {
                this.setState({pb: response.data});
            }).catch(err => {
                console.error(err);
            })
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
            var versions = this.props.getVersions(episode);
            if (versions.length > 0) this.props.downloadTorrent(versions[0]);
        });
    }

    render() {
        const { movie, downloadTorrent, cancelTorrent, getLink, getVersions, getTorrent, getProgress, started } = this.props;
        const { tmdbData, moreData, showCover, tvData, eztv, pb, season, maxSeason } = this.state;

        var versions = getVersions(movie);

        var seasons = [];
        var episodes = [];
        if (movie.num_seasons) {
            for (let i = 1; i < maxSeason + 1; i++) {
                seasons.push(i);
            }
            if (tvData) {
                tvData.episodes.forEach(episode => {
                    episodes[episode.season] = episodes[episode.season] || [];
                    episodes[episode.season][episode.episode] = episode;
                });
            }
            if (eztv) {
                eztv.torrents.forEach(torrent => {
                    const parsed = ptn(torrent.filename);
                    parsed.resolution = parsed.resolution || '480p';

                    // Bail if we weren't able to parse season/episode
                    if (parsed.season === 0 || parsed.episode === 0) return;

                    episodes[parsed.season] = episodes[parsed.season] || [];
                    episodes[parsed.season][parsed.episode] = episodes[parsed.season][parsed.episode] || {
                        title: `Episode ${parsed.episode}`,
                        episode: parsed.episode,
                        season: parsed.season,
                        torrents: {}
                    };
                    
                    const existing = episodes[parsed.season][parsed.episode].torrents[parsed.resolution];
                    if (!existing || torrent.seeds > existing.seeds) {
                        episodes[parsed.season][parsed.episode].torrents[parsed.resolution] = {
                            seeds: torrent.seeds,
                            peers: torrent.peers,
                            url: torrent.magnet_url || torrent.torrent_url
                        };
                    }
                });
            }
        }

        if (pb) {
            let extras = {};

            pb.forEach(t => {
                const parsed = ptn(t.name);
                if (!parsed.quality || !parsed.resolution) return;

                let shouldAdd = true;
                if (parsed.resolution === '2160p' || parsed.quality.toLowerCase().indexOf('cam') !== -1) {
                    shouldAdd = false;
                }

                if (shouldAdd) {
                    let sort = 0;

                    // Not going to show 2160p since they are UUUUGE
                    switch (parsed.resolution) {
                        case "1080p": sort = 3; break;
                        case "720p": sort = 2; break;
                        case "480p": sort = 1; break;
                        default: sort = 0; break;
                    }

                    if (sort === 0 || (extras[parsed.resolution] && extras[parsed.resolution].seeds > t.seeders)) return;

                    extras[parsed.resolution] = {
                        quality: parsed.resolution,
                        sort: sort,
                        peers: t.leechers,
                        seeds: t.seeders,
                        ratio: t.leechers > 0 ? (t.seeders / t.leechers).toFixed(3) : 0,
                        url: t.magnetLink,
                        hashString: magnet.decode(t.magnetLink).infoHash.toLowerCase(),
                        size: t.size,
                        title: movie.title + " (" + movie.year + ") [" + parsed.resolution + "]"
                    };
                }
            });

            // Add new torrents to the version array
            versions = versions.concat(Object.values(extras));

            // Sort it again
            versions = Object.values(versions).sort(function(a, b) {
                return b.sort - a.sort;
            });
        }

        var mpaa = movie.certification;
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
        } else if (tvData) {
            genres = tvData.genres;
            genres = (genres.length === 1 ? "Genre: " : "Genres: ") +
                JSON.stringify(genres).replace(/[[\]"]/g, '').replace(/,/g, ', ');
        }

        return (
            <div className="container">
                {showCover ? (
                    <div className="left">
                        <img
                            src={movie.poster_path}
                            alt={movie.title}
                            onError={this.imageError.bind(this)}
                        />
                        {movie.trailer ? (
                            <Fragment>
                                <hr/>
                                <a href={movie.trailer} target="_blank" rel="noopener noreferrer"><FaPlayCircle />Trailer</a>
                            </Fragment>
                        ) : null}
                    </div>
                ) : null }
                <div className="right">
                    <h3>
                        {movie.title}
                    </h3>
                    <h4>
                        <Fragment>
                            {!movie.num_seasons ? (
                                <span>{movie.year}{moreData ? ', ' + this.convertTime(moreData.Runtime) : null}</span>
                            ) : (
                                <span>{(moreData && moreData.year) ? moreData.Year : movie.year} ({maxSeason + (maxSeason > 1 ? ' Seasons' : ' Season')})</span>
                            )}
                            <div className="mpaa-rating">{mpaa}</div>
                        </Fragment>
                    </h4>
                    <p className="plot">{(moreData && moreData.Plot) ? moreData.Plot : ((tvData && tvData.synopsis) ? tvData.synopsis : (movie.synopsis ? movie.synopsis : ""))}</p>
                    {genres ? (
                        <Fragment>
                            <span className="capitalize">
                                {genres}
                            </span>
                            <br/>
                        </Fragment>
                    ) : null}
                    
                    {moreData !== "ERROR" && moreData !== null && !moreData.Error ? (
                        <Fragment>
                            {moreData.Ratings.map(rating => (
                                <Fragment key={rating.Source}>
                                    {rating.Source === "Internet Movie Database" ? (
                                        <Fragment>
                                            <a href={"https://www.imdb.com/title/" + movie.imdb_id} target="_blank" rel="noopener noreferrer">IMDB Rating</a>
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
                            {moreData === "ERROR" || (moreData !== null && moreData.Error) ? (
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
                    )}

                    <hr/>

                    {!movie.num_seasons ? (
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
                        !tvData || (!eztv && !movie.mal_id) ? (
                            <Fragment>
                                Loading additional data...
                                <Spinner visible/>
                            </Fragment>
                        ) : (
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
                                    {(episodes.length > 0 && episodes[season]) ? (
                                        <button className="orange download" onClick={() => this.downloadSeason(episodes[season])}>
                                            <FaDownload/>
                                        </button>
                                    ) : null}
                                </h3>
                                <div className="episodeList">
                                    {(episodes.length > 0 && episodes[season]) ? (
                                        episodes[season].map(episode => (
                                            <Fragment key={episode.episode}>
                                                {episode.title === "Episode " + episode.episode ? (
                                                    <h4 className="episode">{episode.title}</h4>
                                                ) : (
                                                    <h4 className="episode">{episode.episode} - {episode.title}</h4>
                                                )}

                                                {getVersions(episode).map(version => (
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
                                            </Fragment>
                                        ))
                                    ) : null}
                                </div>
                            </Fragment>
                        )
                    )}
                </div>
            </div>
        );
    }
}

export default Details;