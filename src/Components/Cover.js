import React, { Component, Fragment } from 'react';
import { FaDownload, FaTrash, FaFilm, FaCheck } from 'react-icons/fa';
import axios from 'axios';
import levenshtein from 'js-levenshtein';
import './Cover.css';
import Spinner from './Spinner';
import ScrollReveal from '../ScrollReveal';

class Cover extends Component {
    constructor(props) {
        super(props);
        this.state = { movie: props.movie };
    }

    componentDidMount() {
        const config = {
            duration: 300,
            scale: 1.05,
            distance: '50px',
            easing: 'ease'
        }

        ScrollReveal.reveal(this.refs.movieCover, config);
    }

    componentWillUnmount() {
        // Need to do this to fix some random bugs when unmount/mount happens
        ScrollReveal.sync();
    }

    coverError() {
        axios.get(this.props.server + '/themoviedb/' + this.props.movie.imdb_id).then(response => {
            const data = response.data.movie_results;
            if (data.length > 0) {
                // if this breaks, consider doing things the right way as described here:
                // https://developers.themoviedb.org/3/configuration/get-api-configuration
                const image = 'https://image.tmdb.org/t/p/w342' + data[0].poster_path;
                
                var movie = this.state.movie;
                movie.images.poster = image;
                this.setState({ movie: movie });
            }
        }, error => {
            // no image if this happens
            console.error(error);
        });
    }

    render() {
        const { click, downloadTorrent, cancelTorrent, getVersions, getProgress, started, files } = this.props;
        const movie = this.state.movie;

        const versions = getVersions(movie);

        for (var i = 0; i < versions.length; i++) {
            versions[i].progress = getProgress(versions[i].hashString);
        }

        //if (!movie.poster_path) movie.poster_path = "broken image";
        if (!movie.poster_path) movie.poster_path = "broken image";

        var hasFile = false;
        for (i = 0; i < files.length; i++) {
            const file = files[i];
            const lev = levenshtein(file.title.toLowerCase(), movie.title.toLowerCase());
            const match = (1 - (lev / Math.max(file.title.length, movie.title.length)));

            if (match > 0.95 && file.year === movie.year) {
                hasFile = true;
                break;
            }
        }

        return (
            <div className="movie" ref='movieCover'>
                <div
                    className="cover"
                    onClick={(e) => click(movie)}
                >
                    <img className="movieCover" src={this.state.altCover || movie.poster_path} alt="" onError={this.coverError.bind(this)} />
                    <div className="movieIcon">
                        <FaFilm />
                    </div>
                    {hasFile ? (
                        <div className="fileExists">
                            <FaCheck />
                        </div>
                    ) : null}
                    <div className="quality">
                        {versions.map(version => (
                            <Fragment
                                key={version.hashString}
                            >
                                <span>{version.quality}</span>
                                {version.progress != null ? (
                                    <button className="red" onClick={(e) => {
                                        e.stopPropagation();
                                        e.nativeEvent.stopImmediatePropagation();
                                        cancelTorrent(version.hashString);
                                    }}><FaTrash/></button>
                                ) : (
                                    <button className="orange download" onClick={(e) => {
                                        e.stopPropagation();
                                        e.nativeEvent.stopImmediatePropagation();
                                        if (!hasFile || window.confirm("This file already exists in plex. Are you sure you want to download it again?")) downloadTorrent(version);
                                    }}>
                                        {started.indexOf(version.hashString) !== -1 ? (
                                            <Spinner visible noMargin button />
                                        ) : (
                                            <FaDownload />
                                        )}
                                    </button>
                                )}
                                <br/>
                            </Fragment>
                        ))}
                    </div>
                </div>
                <span onClick={(e) => click(movie)}>{movie.title} ({movie.year})</span>
            </div>
        );
    }
}

export default Cover;