import React, { Component } from 'react';
import axios from 'axios';
import './Plex.css';

class Plex extends Component {
    constructor(props) {
        super(props);
        this.state = {plexServer : null};
    }

    componentDidMount() {
        axios.get(this.props.server + '/plex').then(response => {
            this.setState({plexServer: response.data});
        }, error => {
            console.error(error);
        });
    }

    render() {
        const plex = this.state.plexServer;

        if (plex) {
            return (
                <a href={this.props.plexServer} id="plex" target="_parent">
                    <img src="plex.svg" alt="Plex Logo"/>
                </a>
            );
        } else {
            return null;
        }
    }
}

export default Plex;