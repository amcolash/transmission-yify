import React, { Component } from 'react';
import axios from 'axios';
import '../css/Plex.css';

class Plex extends Component {
    constructor(props) {
        super(props);
        this.state = {plexServer : null};
    }

    componentDidMount() {
        var self = this;

        axios.get(this.props.server + '/plex', {
            cancelToken: new axios.CancelToken(function executor(c) {
                self._cancel = c;
            })
        }).then(response => {
            this.setState({plexServer: response.data});
        }, error => {
            if (!axios.isCancel(error)) {
                console.error(error);
            }
        });
    }

    componentWillUnmount() {
        // Cancel request if unmounted so that we do not set state on an unmounted component
        this._cancel();
    }

    render() {
        const plex = this.state.plexServer;

        if (plex) {
            return (
                <a href={this.state.plexServer} id="plex" target="_parent">
                    <img src="plex.svg" alt="Plex Logo"/>
                </a>
            );
        } else {
            return null;
        }
    }
}

export default Plex;