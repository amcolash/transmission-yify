import React, { Component } from 'react';
import '../css/Plex.css';

class Plex extends Component {
    render() {
        const plex = this.props.plexServer;

        return plex ? (
            <a href={plex} id="plex" target="_parent">
                <img src="plex.svg" alt="Plex Logo"/>
            </a>
        ) : null;
    }
}

export default Plex;