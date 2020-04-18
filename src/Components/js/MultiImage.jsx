import React, { Component } from 'react';

import Cache from '../../Util/Cache';

export default class MultiImage extends Component {
  smallTimeout = undefined;
  largeTimeout = undefined;

  constructor(props) {
    super(props);
    this.state = { waitForSmall: true, finalImage: null };
  }

  componentDidMount() {
    this.updateImage();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.src !== prevProps.src) {
      this.updateImage();
    }
  }

  updateImage() {
    this.setState({ waitForSmall: true, finalImage: null });

    if (this.smallTimeout) clearTimeout(this.smallTimeout);
    this.smallTimeout = setTimeout(
      () => {
        this.setState({ waitForSmall: false });
      },
      Cache[this.props.src] ? 0 : 250
    );

    if (this.Largetimeout) clearTimeout(this.Largetimeout);
    this.Largetimeout = setTimeout(
      () => {
        const src = this.props.src;
        if (src.indexOf('image.tmdb') !== -1) {
          const finalImage = src.replace('w300', 'original');
          const image = new Image();
          image.src = finalImage;

          image.onload = () => {
            this.setState({ finalImage });
            Cache[this.props.src] = true;
          };
        }
      },
      Cache[this.props.src] ? 0 : 2000
    );
  }

  render() {
    if (this.state.waitForSmall) return null;

    return (
      <img
        src={this.state.finalImage || this.props.src}
        alt=""
        style={{
          filter: this.state.finalImage ? 'unset' : 'blur(3px)',
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          objectFit: 'cover',
          objectPosition: 'top',
          transition: this.state.finalImage ? 'all 0.25s' : 'unset',
        }}
      />
    );
  }
}
