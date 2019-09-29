import React, { Component, Fragment } from 'react';
import { FaFilm, FaCheck, FaExclamationCircle, FaDownload, FaTrash } from 'react-icons/fa';
import levenshtein from 'js-levenshtein';
import axios from 'axios';
import '../css/Cover.css';
import {getMovies} from '../../Util/Parse';
import Spinner from './Spinner';
import ScrollReveal from '../../Util/ScrollReveal';

const CancelToken = axios.CancelToken;

class Cover extends Component {
    cancelToken = null;

    constructor(props) {
        super(props);
        this.state = { pb: null };
    }

    componentDidMount() {
        const config = {
            duration: 300,
            scale: 1.05,
            distance: '50px',
            easing: 'ease'
        }

        if (this.props.type === 'movies') {
            this.updatePB();
        }

        ScrollReveal.reveal(this.refs.mediaCover, config);
    }

    componentWillUnmount() {
        // Need to do this to fix some random bugs when unmount/mount happens
        ScrollReveal.sync();

        this.cancelPB();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.type === 'movies' && prevProps.media !== this.props.media) {
            this.cancelPB();
            this.updatePB();
        }
    }

    cancelPB() {
        if (this.cancelToken) {
            console.log('canceling pb');
            this.cancelToken.cancel();
            this.cancelToken = null;
        }
    }

    updatePB() {
        const media = this.props.media;
        const cleanedTitle = media.title.replace(/[^\w\s]/gi, ' ');
        
        this.cancelPB();

        this.cancelToken = CancelToken.source();
        const url = `${this.props.server}/pirate/${cleanedTitle} ${media.year}`;
        axios.get(url, { cancelToken: CancelToken.token }).then(response => {
            this.cancelToken = null;

            // Only update things if we are still actually showing the same cover
            if (media.title === this.props.media.title) {
                this.setState({pb: response.data});
            }
        }).catch(err => {
            console.error(err);
        });
    }

    render() {
        const { click, files, media, started, downloadTorrent, cancelTorrent, type, getProgress } = this.props;
        const pb = this.state.pb;

        if (!media.poster_path) media.poster_path = "broken image";

        var hasFile = false;
        for (let i = 0; i < files.length; i++) {
            if (media && media.title && media.year) {
                const file = files[i];
                const lev = levenshtein(file.title.toLowerCase(), media.title.toLowerCase());
                const match = (1 - (lev / Math.max(file.title.length, media.title.length)));
    
                if (match > 0.95 && file.year === media.year) {
                    hasFile = true;
                    break;
                }
            }
        }

        let versions = [];
        if (pb) {
            versions = getMovies(media, pb.torrents);
            if (versions.length > 2) versions = versions.slice(1);
            versions = versions.map(version => { return {...version, progress: getProgress(version.hashString)}; });
        }

        return (
            <div className="movie" ref='mediaCover'>
                <div
                    className="cover"
                    onClick={(e) => click(media)}
                >
                    <img className="movieCover" src={media.poster_path} alt="" />
                    <div className="movieIcon">
                        <FaFilm />
                    </div>
                    {hasFile ? (
                        <div className="fileExists">
                            <FaCheck />
                        </div>
                    ) : null}
                    <div className="quality">
                        {versions.length > 0 ? (
                            versions.map(version => (
                                <Fragment
                                    key={version.hashString}
                                >
                                    <span>{version.quality}</span>
                                    {version.progress != null ? (
                                        <button className="red" onClick={(e) => {
                                            e.stopPropagation();
                                            e.nativeEvent.stopImmediatePropagation();
                                            cancelTorrent(version.hashString, true);
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
                            ))
                        ) : (
                            type === 'movies' ? (
                                pb ? <span className="red medium"><FaExclamationCircle /></span> : <Spinner visible noMargin button />
                            ) : null
                        )}
                    </div>
                </div>
                <span onClick={(e) => click(media)}>{media.title} {media.year ? <span>({media.year})</span> : null}</span>
            </div>
        );
    }
}

export default Cover;