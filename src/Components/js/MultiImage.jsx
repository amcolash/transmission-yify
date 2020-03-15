import React, { Component } from 'react';

export default class MultiImage extends Component {
  constructor(props) {
    super(props);
    this.state = { finalImage: null };
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
    const src = this.props.src;
    if (src.indexOf('image.tmdb') !== -1) {
      const finalImage = src.replace('w300', 'original');
      const image = new Image();
      image.src = finalImage;

      image.onload = () => {
        this.setState({ finalImage });
      };
    }

    this.setState({ finalImage: null });
  }

  render() {
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
