import React, { Component, Fragment } from 'react';
import { FaFilm, FaTv, FaLaughBeam, FaExclamationCircle, FaDownload, FaPlayCircle, FaTrash, FaRssSquare } from 'react-icons/fa';
import axios from 'axios';
import ScrollAnimation from 'react-animate-on-scroll';
import "animate.css/animate.min.css";

import '../css/Cover.css';
import {getMovies, hasFile, hasSubscription} from '../../Util/Parse';
import Spinner from './Spinner';
import Cache from '../../Util/Cache';

const CancelToken = axios.CancelToken;

class Cover extends Component {
    cancelToken = null;

    constructor(props) {
        super(props);
        this.state = { pb: null, subscribing: false };
    }

    componentWillUnmount() {
        this.cancelPB();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.type === 'movies' && prevProps.media !== this.props.media) {
            this.cancelPB();
            this.updatePB();
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        // Try to optimize when covers are re-rendered
        return (nextProps.media !== this.props.media) || (this.state !== nextState);
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

        this.cancelToken = CancelToken.source();
        const url = `${this.props.server}/pirate/${cleanedTitle} ${media.year}?movie=true`;

        if (Cache[url]) {
            this.setState({pb: Cache[url]});
        } else {
            axios.get(url, { cancelToken: CancelToken.token }).then(response => {
                Cache[url] = response.data;
                this.cancelToken = null;
    
                // Only update things if we are still actually showing the same cover
                if (media.title === this.props.media.title) {
                    this.setState({pb: response.data});
                }
            }).catch(err => {
                console.error(err);
            });
        }
    }

    toggleSubscription() {
        if (this.props.toggleSubscription) {
            this.props.toggleSubscription(this.props.media, () => setTimeout(() => this.setState({subscribing: false}), 2000));
            this.setState({subscribing: true});
        }
    }

    getIcon() {
        switch(this.props.type) {
            case 'shows': return <FaTv/>;
            case 'animes': return <FaLaughBeam/>;
            default: return <FaFilm/>;
        }
    }

    render() {
        const { click, files, media, started, downloadTorrent, cancelTorrent, type, getProgress, status } = this.props;
        const { pb, subscribing } = this.state;

        if (!media.poster_path) media.poster_path = "broken image";

        const fileExists = hasFile(media, files || []);
        const subscription = status ? hasSubscription(media.id, status.subscriptions) : null;
    
        let versions = [];
        if (pb) {
            versions = getMovies(media, pb.torrents, type);
            if (versions.length > 2) versions = versions.slice(0, 2);
            versions = versions.map(version => { return {...version, progress: getProgress(version.hashString)}; });
        }

        return (
            <ScrollAnimation animateIn='fadeIn'
                animateOnce={true}
                offset={100}
                className={"movie" + (type === 'subscriptions' ? ' disabled' : '')}
                afterAnimatedIn={() => { if (this.props.type === 'movies') this.updatePB(); }}
            >        
                <div
                    className="cover"
                    onClick={(e) => { if (click) click(media); }}
                >
                    <img className="movieCover" src={media.poster_path} alt="" />
                    <div className="movieIcon">
                        {this.getIcon()}
                    </div>
                    {fileExists ? (
                        <div className="fileExists hover">
                            <FaPlayCircle onClick={e => { e.stopPropagation(); window.open(fileExists.url, '_blank').focus(); }} />
                        </div>
                    ) : null}
                    {type === 'shows' || type === 'subscriptions' ? (
                        <div className={'fileExists' + (subscription ? '' : ' notSubscribed')} onClick={e => {e.stopPropagation(); this.toggleSubscription(); }}>
                            {subscribing ? <Spinner visible noMargin button/> : <FaRssSquare/>}
                        </div>
                    ) : null}
                    {type === 'movies' ? (
                        <div className="quality">
                            {versions.length > 0 ? (
                                versions.reverse().map(version => (
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
                                                if (!fileExists || window.confirm("This file already exists in plex. Are you sure you want to download it again?")) downloadTorrent(version);
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
                            ) : pb ? <span className="red medium"><FaExclamationCircle /></span> : <Spinner visible noMargin button />
                            }
                        </div>
                    ) : null}
                </div>
                <span onClick={(e) => click(media)}>{media.title} {media.year ? <span>({media.year})</span> : null}</span>
            </ScrollAnimation>
        );
    }
}

export default Cover;