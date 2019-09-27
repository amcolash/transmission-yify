import React, { Component } from 'react';
import { FaFilm, FaCheck } from 'react-icons/fa';
import levenshtein from 'js-levenshtein';
import axios from 'axios';
import '../css/Cover.css';
// import Spinner from './Spinner';
import ScrollReveal from '../../Util/ScrollReveal';

class Cover extends Component {
    componentDidMount() {
        const config = {
            duration: 300,
            scale: 1.05,
            distance: '50px',
            easing: 'ease'
        }

        ScrollReveal.reveal(this.refs.mediaCover, config);

        if (this.props.type === 'movies') {
            const media = this.props.media;
            const cleanedTitle = media.title.replace(/(&|\+)/g, '');
            axios.get(`${this.props.server}/pirate/${cleanedTitle} ${media.year}/precache`).then(response => {
                this.setState({pb: response.data});
            }).catch(err => {
                console.error(err);
            });
        }
    }

    componentWillUnmount() {
        // Need to do this to fix some random bugs when unmount/mount happens
        ScrollReveal.sync();
    }

    render() {
        const { click, files, media } = this.props;

        if (!media.poster_path) media.poster_path = "broken image";

        var hasFile = false;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const lev = levenshtein(file.title.toLowerCase(), media.title.toLowerCase());
            const match = (1 - (lev / Math.max(file.title.length, media.title.length)));

            if (match > 0.95 && file.year === media.year) {
                hasFile = true;
                break;
            }
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
                        {/* {versions.map(version => (
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
                        ))} */}
                    </div>
                </div>
                <span onClick={(e) => click(media)}>{media.title} ({media.year})</span>
            </div>
        );
    }
}

export default Cover;