import React, { Component, Fragment } from 'react';
import {
    FaDownload, FaCircle, FaPlayCircle
} from 'react-icons/lib/fa';
import axios from 'axios';

import './Details.css';
import Progress from './Progress';
import Spinner from './Spinner';

class Details extends Component {

    constructor(props) {
        super(props);
        this.state = { moreData: null, tvData: null, season: 1, showCover: true };
    }

    componentDidMount() {
        axios.get(this.props.server + '/omdb/' + this.props.movie.imdb_id, { timeout: 10000 }).then(response => {
            this.setState({ moreData: response.data });
        }, error => {
            console.error(error);
            this.setState({ moreData: "ERROR" });
        });

        if (this.props.movie.num_seasons) {
            axios.get('https://tv-v2.api-fetch.website/show/' + this.props.movie.imdb_id, { timeout: 10000 }).then(response => {
                this.setState({ tvData: response.data });
            }, error => {
                console.error(error);
            });
        }
    }

    convertTime(min) {
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

    render() {
        const { movie, downloadTorrent, cancelTorrent, getLink, getVersions, getTorrent, getProgress, started } = this.props;
        const { moreData, showCover, tvData, season } = this.state;

        var versions = getVersions(movie);

        var seasons = [];
        var episodes = [];
        if (movie.num_seasons) {
            for (var i = 1; i < movie.num_seasons + 1; i++) {
                seasons.push(i);
            }
            if (tvData) {
                tvData.episodes.map(episode => {
                    episodes[episode.season] = episodes[episode.season] || [];
                    episodes[episode.season][episode.episode] = episode;
                    return episode;
                });
            }
        }

        var hasPeers = false;
        for (i = 0; i < versions.length; i++) {
            if (versions[i].peers > 0) hasPeers = true;
        }

        var mpaa = movie.certification;
        if (!mpaa || mpaa === "N/A") {
            if (moreData && moreData.Rated !== "N/A") {
                mpaa = moreData.Rated;
            } else {
                mpaa = "NR";
            }
        }

        var genres = movie.genres;
        if (tvData) genres = tvData.genres;
        if (genres) {
            genres = (genres.length === 1 ? "Genre: " : "Genres: ") +
            JSON.stringify(genres).replace(/[[\]"]/g, '').replace(/,/g, ', ');
        }

        return (
            <div className="container">
                {showCover ? (
                    <div className="left">
                        <img
                            src={movie.images.poster}
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
                        {!movie.num_seasons ? (
                            <span className={hasPeers ? "status green" : "status red"}><FaCircle/></span>
                        ) : null}
                        {movie.title}
                    </h3>
                    <h4>
                        <Fragment>
                            {!movie.num_seasons ? (
                                <span>{movie.year}, {this.convertTime(movie.runtime)}</span>
                            ) : (
                                <span>{moreData ? moreData.Year : movie.year} ({movie.num_seasons} Seasons)</span>
                            )}
                            <div className="mpaa-rating">{mpaa}</div>
                        </Fragment>
                    </h4>
                    <p>{movie.synopsis ? movie.synopsis : (moreData ? moreData.Plot : "")}</p>
                    {movie.genres || tvData ? (
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
                    ) : (
                        <Fragment>
                            <h3 className="season">Season
                                <select
                                    onChange={(event) => this.updateSeason(event.target.value)}
                                    value={season}
                                >
                                    {seasons.map(season => (
                                        <option key={season} value={season}>{season}</option>
                                    ))}
                                </select>
                            </h3>
                            <div className="episodeList">
                                {episodes.length > 0 ? (
                                    episodes[season].map(episode => (
                                        <Fragment key={episode.episode}>
                                            <h4 className="episode">{episode.episode} - {episode.title}</h4>

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
                    )}
                </div>
            </div>
        );
    }
}

class Version extends Component {
    render() {
        const { version, started, getProgress, getLink, getTorrent, downloadTorrent, cancelTorrent } = this.props;

        return (
            <div className={"version" + (version.peers ? "" : " inline")} key={version.url}>
                <b>{version.quality}</b>
                {getProgress(version.hashString) ? null : (
                    <button className="orange download" onClick={() => downloadTorrent(version)} url={version.url}>
                        {started.indexOf(version.hashString) !== -1 ? (
                            <Spinner visible noMargin button />
                        ) : (
                            <FaDownload/>
                        )}
                    </button>
                )}
                <span>{version.size ? version.size + "," : ""}</span>
                {version.peers && version.seeds && version.ratio ? (
                    <Fragment>
                        <span>Peers: {version.peers}, Seeds: {version.seeds}, Ratio: {version.ratio})</span>
                        <br/>
                    </Fragment>
                ): null}
                {getProgress(version.hashString) ? (
                    <Progress
                        torrent={getTorrent(version.hashString)}
                        getLink={getLink}
                        cancelTorrent={cancelTorrent}
                        getProgress={getProgress}
                        fullName
                    />
                ) : null}
            </div>
        );
    }
}

export default Details;