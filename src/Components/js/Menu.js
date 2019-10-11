import React, { Component, Fragment } from 'react';
import { FaBars, FaFilm, FaTv, FaLaughBeam, FaSkullCrossbones, FaMagnet, FaPowerOff, FaExclamationTriangle } from 'react-icons/fa';

import '../css/Menu.css';

const plexIcon = <svg width="1em" height="1em" fill="currentColor" version="1.1" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><path d="m128 0c-70.63 0-128 57.37-128 128 0 70.63 57.37 128 128 128 70.63 0 128-57.37 128-128 0-70.63-57.37-128-128-128zm0 10.548c64.929 0 117.45 52.522 117.45 117.45 0 64.929-52.522 117.45-117.45 117.45-64.929 0-117.45-52.522-117.45-117.45 0-64.929 52.522-117.45 117.45-117.45zm-53.481 29.688 56.112 87.764-56.112 87.764h50.851l56.112-87.764-56.112-87.764z"></path></svg>;

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
    if (e.targetTouches.length > 0 && Date.now() > this.touch + 500) {
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
            <div className="toggle">
              <FaBars className="toggleButton" onClick={e => {e.stopPropagation(); this.setState({visible: !this.state.visible}); }}/>
              {status && status.ip && status.ip.city === 'Seattle' ? <FaExclamationTriangle className="red warn"/> : null}
            </div>
          </div>
          <div className={type === 'movies' ? 'selected item' : 'item'} onClick={() => this.selectItem('movies')}><FaFilm/><span>Movies</span></div>
          <div className={type === 'shows' ? 'selected item' : 'item'} onClick={() => this.selectItem('shows')}><FaTv/><span>TV Shows</span></div>
          <div className={type === 'animes' ? 'selected item' : 'item'} onClick={() => this.selectItem('animes')}><FaLaughBeam/><span>Anime</span></div>
          <div className={type === 'pirate' ? 'selected item' : 'item'} onClick={() => this.selectItem('pirate')}><FaSkullCrossbones/><span>Pirate Bay</span></div>
          <div className="item disabled"></div>
          {status ? <div className="item" onClick={() => { window.open(status.plex, '_blank'); this.setState({visible: false}); }}>{plexIcon}<span>Plex</span></div> : null}
          {/* <div className={type === '' ? 'selected' : 'item'}><FaDownload/><span>Downloads</span></div> */}
          {/* <div className={type === '' ? 'selected' : 'item'}><FaRssSquare/><span>Subscriptions</span></div> */}
          <div className="spacer"></div>
          <div className="item" onClick={this.props.addMagnet}><FaMagnet/><span>Add Magnet</span></div>
          <div className="item" onClick={this.props.upgrade}><FaPowerOff/><span>Upgrade</span></div>

          {status ? (
            <div className="status">
              {status && status.ip ? <p className={status.ip.city === 'Seattle' ? 'red bold' : ''}>Server Location: {`${status.ip.city}, ${status.ip.country_name}`}</p> : null}
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