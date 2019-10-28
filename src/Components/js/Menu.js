import React, { Component } from 'react';
import { FaBars, FaFilm, FaTv, FaLaughBeam, FaSkullCrossbones, FaMagnet, FaPowerOff, FaExclamationTriangle, FaDownload, FaRssSquare, FaRecycle } from 'react-icons/fa';

import '../css/Menu.css';
import {swipedetect} from '../../Util/Swipe';

const plexIcon = <svg width="1em" height="1em" fill="currentColor" version="1.1" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><path d="m128 0c-70.63 0-128 57.37-128 128 0 70.63 57.37 128 128 128 70.63 0 128-57.37 128-128 0-70.63-57.37-128-128-128zm0 10.548c64.929 0 117.45 52.522 117.45 117.45 0 64.929-52.522 117.45-117.45 117.45-64.929 0-117.45-52.522-117.45-117.45 0-64.929 52.522-117.45 117.45-117.45zm-53.481 29.688 56.112 87.764-56.112 87.764h50.851l56.112-87.764-56.112-87.764z"></path></svg>;
const tabIndex = 1;

class Menu extends Component {
  constructor(props) {
    super(props);
    this.state = {visible: false};

    this.touch = 0;
    
    this.outsideClick = this.outsideClick.bind(this);
    this.onFocus = this.onFocus.bind(this);
  }

  componentDidMount() {
    document.addEventListener('click', this.outsideClick, false);
    document.addEventListener('focusin', this.onFocus, false);

    swipedetect(document, (swipedir) => {
      if (swipedir === 'left') this.setVisible(false);
      else if (swipedir === 'right') this.setVisible(true);
    });
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.outsideClick, false);
    document.removeEventListener('focusin', this.onFocus, false);
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

  onFocus(e) {
    if (this.state.visible && e.target.tabIndex !== tabIndex) this.setVisible(false);
  }

  selectItem(value) {
    // scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // hide the menu
    this.setVisible(false);

    // delay setting the search so the menu closes smoothly
    setTimeout(() => this.props.updateSearch('', '', '', value, 1), 500);
  }

  generateItem(icon, text, value) {
    const callback = (typeof value === 'string' ? () => this.selectItem(value) : e => value(e));
    return <div
      className={'item ' + (this.props.type === value ? 'selected' : '')}
      onClick={e => callback(e)}
      onKeyDown={e => { if (e.key === 'Enter') callback(e); }}
      tabIndex={this.state.visible ? tabIndex : '-1'}
    >
      {icon}
      <span>{text}</span>
    </div>
  }

  render() {
    const visible = this.state.visible;
    const { status, torrents } = this.props;

    return (
      <div className={`menu ${visible ? '' : 'hidden'}`}
        ref={node => this.menu = node}
        onClick={() => this.setVisible(false)}
        onKeyDown={e => { if (e.key === 'Escape') this.setVisible(false); }}
      >
        <div className="list">
          <div className="toggleWrap">
            <span>Pirate Flix</span>
            <div className="spacer"></div>
            <div className="toggle" tabIndex={tabIndex} onKeyPress={e => { if (e.key === 'Enter') this.setVisible(!this.state.visible) }}>
              <FaBars className="toggleButton" onClick={e => {e.stopPropagation(); this.setVisible(!this.state.visible); }}/>
              {status && status.ip && status.ip.city === 'Seattle' ? <FaExclamationTriangle className="red warn"/> : null}
            </div>
          </div>
          {this.generateItem(<FaFilm/>, 'Movies', 'movies')}
          {this.generateItem(<FaTv/>, 'TV Shows', 'shows')}
          {this.generateItem(<FaLaughBeam/>, 'Anime', 'animes')}
          {this.generateItem(<FaSkullCrossbones/>, 'Pirate Bay', 'pirate')}
          <div className="item disabled"></div>
          {this.generateItem(<FaDownload/>, `Downloads ${torrents.length > 0 ? `(${torrents.length})` : ''}`, 'downloads')}
          {this.generateItem(<FaRssSquare/>, 'Subscriptions', 'subscriptions')}
          <div className="item disabled"></div>
          {status ? this.generateItem(plexIcon, 'Plex', () => { window.open(status.plex, '_blank'); this.setVisible(false); }) : null}
          {this.generateItem(<FaMagnet/>, 'Add Magnet', e => { e.stopPropagation(); this.props.addMagnet(); })}
          <div className="spacer"></div>
          {this.generateItem(<FaRecycle/>, 'Clear Cache', this.props.clearCache)}
          {this.generateItem(<FaPowerOff/>, 'Upgrade Server', this.props.upgrade)}

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