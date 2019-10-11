import React, { Component, Fragment } from 'react';
import { FaBars, FaFilm, FaTv, FaLaughBeam, FaSkullCrossbones, FaMagnet, FaPowerOff } from 'react-icons/fa';

import '../css/Menu.css';

class Menu extends Component {
  constructor(props) {
    super(props);
    this.state = {visible: false};

    this.outsideClick = this.outsideClick.bind(this);
    this.touch = 0;
  }

  componentDidMount() {
    document.addEventListener('click', this.outsideClick, false);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.outsideClick, false);
  }

  outsideClick(e) {
    if (this.state.visible) {
      if (this.menu && this.menu.contains(e.target)) return;
      else this.setState({visible: false});
    }
  }

  selectItem(value) {
    this.setState({visible: false});

    // delay setting the search so the menu closes smoothly
    setTimeout(() => this.props.updateSearch('', '', '', value, 1), 500);
  }

  onTouchMove(e) {
    if (e.targetTouches.length > 0 && Date.now() > this.touch + 200) {
      this.touch = Date.now();
      this.setState({visible: !this.state.visible});
    }
  }

  render() {
    const visible = this.state.visible;
    const { type, status } = this.props;

    return <Fragment>
      <div className="slider" onTouchMove={e => this.onTouchMove(e)}></div>
      <div className={`menu ${visible ? '' : 'hidden'}`}
        ref={node => this.menu = node}
        onClick={() => this.setState({visible: false})}
        onTouchMove={e => this.onTouchMove(e)}
      >
        <div className="list">
          <div className="toggleWrap">
            <span>Pirate Flix</span>
            <div className="spacer"></div>
            <FaBars className="toggle" onClick={e => {e.stopPropagation(); this.setState({visible: !this.state.visible}); }}/>
          </div>
          <div className={type === 'movies' ? 'selected item' : 'item'} onClick={() => this.selectItem('movies')}><FaFilm/><span>Movies</span></div>
          <div className={type === 'shows' ? 'selected item' : 'item'} onClick={() => this.selectItem('shows')}><FaTv/><span>TV Shows</span></div>
          <div className={type === 'animes' ? 'selected item' : 'item'} onClick={() => this.selectItem('animes')}><FaLaughBeam/><span>Anime</span></div>
          <div className={type === 'pirate' ? 'selected item' : 'item'} onClick={() => this.selectItem('pirate')}><FaSkullCrossbones/><span>Pirate Bay</span></div>
          {/* <div className={type === '' ? 'selected' : 'item'}><FaDownload/><span>Downloads</span></div> */}
          {/* <div className={type === '' ? 'selected' : 'item'}><FaRssSquare/><span>Subscriptions</span></div> */}
          <div className="spacer"></div>
          <div className="item" onClick={this.props.addMagnet}><FaMagnet/><span>Add Magnet</span></div>
          <div className="item" onClick={this.props.upgrade}><FaPowerOff/><span>Upgrade</span></div>

          {status ? (
            <div className="status">
              {status && status.ip ? <p>Server Location: {`${status.ip.city}, ${status.ip.country_name}`}</p> : null}
              {(status.buildTime && status.buildTime.indexOf('Dev Build') === -1) ? (
                <p><span>Build Time: {new Date(status.buildTime).toLocaleString()}</span></p>
              ) : null}
              <p>
                <span>Disk Usage: {parseFloat(status.storageUsage).toFixed(1)}%</span>
                <progress value={status.storageUsage} max="100"/>
              </p>
              <p>
                <span>Cache Size: {status.cacheUsage}</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Fragment>;
  }
}

export default Menu;