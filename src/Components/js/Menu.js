import React, { Component } from 'react';
import { FaBars, FaFilm, FaTv, FaLaughBeam, FaSkullCrossbones, FaMagnet, FaPowerOff, FaExclamationTriangle, FaDownload, FaRssSquare, FaRecycle } from 'react-icons/fa';

import '../css/Menu.css';
import {swipedetect} from '../../Util/Swipe';

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

    swipedetect(document, (swipedir) => {
      if (swipedir === 'left') this.setVisible(false);
      else if (swipedir === 'right') this.setVisible(true);
    });
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.outsideClick, false);
    
    //  i'm a bad person and am not cleaning up event listeners, doesn't really matter since this is never re-created
  }

  outsideClick(e) {
    if (this.state.visible) {
      if (this.menu && this.menu.contains(e.target)) return;
      else this.setVisible(false);
    }
  }

  setVisible(visible) {
    if (Date.now() > this.touch + 300) {
      this.touch = Date.now();
      this.setState({visible: visible});
      document.body.classList.toggle('noscroll', visible);
    }
  }

  selectItem(value) {
    // scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // hide the menu
    this.setState({visible: false});

    // delay setting the search so the menu closes smoothly
    setTimeout(() => this.props.updateSearch('', '', '', value, 1), 500);
  }

  render() {
    const visible = this.state.visible;
    const { type, status, torrents } = this.props;

    return (
      <div className={`menu ${visible ? '' : 'hidden'}`}
        ref={node => this.menu = node}
        onClick={() => this.setVisible(false)}
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
          <div className={(type === 'downloads' ? 'selected' : '') + ' item downloads'} onClick={() => this.selectItem('downloads')}>
            <FaDownload/><span>Downloads {torrents.length > 0 ? `(${torrents.length})` : ''}</span>
          </div>
          <div className={(type === 'subscriptions' ? 'selected' : '') + ' item'} onClick={() => this.selectItem('subscriptions')}><FaRssSquare/><span>Subscriptions</span></div>
          <div className="item disabled"></div>
          {status ? <div className="item" onClick={() => { window.open(status.plex, '_blank'); this.setState({visible: false}); }}>{plexIcon}<span>Plex</span></div> : null}
          <div className="spacer"></div>
          <div className="item" onClick={this.props.addMagnet}><FaMagnet/><span>Add Magnet</span></div>
          <div className="item" onClick={this.props.clearCache}><FaRecycle/><span>Clear Cache</span></div>
          <div className="item" onClick={this.props.upgrade}><FaPowerOff/><span>Upgrade Server</span></div>

          {status ? (
            <div className="status">
              {status && status.ip ? <p className={status.ip.city === 'Seattle' ? 'red bold' : ''}>
                Server Location: {`${status.ip.city}, ${status.ip.country_code}`}
              </p> : null}
              {(status.buildTime && status.buildTime.indexOf('Dev Build') === -1) ? (
                <p><span>Build Time: {new Date(status.buildTime).toLocaleString()}</span></p>
              ) : null}
              <p>
                <span>Disk Usage: {parseFloat(status.storageUsage).toFixed(1)}%</span>
                {/* <progress value={status.storageUsage} max="100"/> */}
              </p>
              <p>
                <span>Cache Size: {status.cacheUsage}</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

export default Menu;