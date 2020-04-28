import '../css/Search.css';

import React, { Component } from 'react';
import { DebounceInput } from 'react-debounce-input';
import { FaFilm, FaLaughBeam, FaSkullCrossbones, FaTimes, FaTv } from 'react-icons/fa';

import Genre from '../../Data/Genre';
import Order from '../../Data/Order';
import { isKeyboardVisible } from '../../Util/cordova-plugins';
import { shouldUpdate } from '../../Util/Util';
import Spinner from './Spinner';

class Search extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    return shouldUpdate(this.props, this.state, nextProps, nextState, false);
  }

  clearSearch() {
    this.props.updateSearch('', '', '', this.props.type, 1);
  }

  render() {
    const { search, genre, order, type, isSearching, updateSearch, viewMode } = this.props;
    const clearVisible = search.length > 0 || genre.length > 0 || order !== '';

    let ordering = [];
    if (type === 'animes') ordering = Order.anime;
    else if (type === 'shows') ordering = Order.tv;
    else ordering = Order.movies;

    const genres = (type === 'animes' ? Genre.anime : Genre.standard).sort((a, b) => {
      if (a.label === 'All') return -1;
      if (b.label === 'All') return 1;
      return a.label.localeCompare(b.label);
    });

    let icon;
    switch (type) {
      case 'shows':
        icon = <FaTv />;
        break;
      case 'animes':
        icon = <FaLaughBeam />;
        break;
      case 'pirate':
        icon = <FaSkullCrossbones />;
        break;
      default:
      case 'movies':
        icon = <FaFilm />;
        break;
    }

    return (
      <div className={`search ${viewMode}`}>
        <div className="form">
          <div className="searchItem">
            <div className="iconHover">
              <span className="mainIcon">{icon}</span>
              <div className="icons">
                <FaFilm className={type === 'movies' ? 'active' : ''} onClick={() => updateSearch('', '', '', 'movies', 1)} />
                <FaTv className={type === 'shows' ? 'active' : ''} onClick={() => updateSearch('', '', '', 'shows', 1)} />
                <FaLaughBeam className={type === 'animes' ? 'active' : ''} onClick={() => updateSearch('', '', '', 'animes', 1)} />
                <FaSkullCrossbones className={type === 'pirate' ? 'active' : ''} onClick={() => updateSearch('', '', '', 'pirate', 1)} />
              </div>
            </div>
            <DebounceInput
              value={search}
              placeholder={'Search'}
              debounceTimeout={500}
              onChange={(event) => updateSearch(event.target.value, genre, order, type)}
              inputRef={(ref) => {
                // Only open soft keyboard when enter is pressed when running in cordova
                if (ref && window.cordova) {
                  // Only set readonly when the keyboard is hidden
                  if (!isKeyboardVisible()) ref.readOnly = true;

                  ref.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                      // Flip this so that the search icon on keyboard actually works
                      ref.readOnly = !ref.readOnly;
                    }
                  };
                  ref.onblur = () => (ref.readOnly = true);
                }
              }}
            />
          </div>

          <div className="searchItem">
            <span>Genre</span>
            <select onChange={(event) => updateSearch(search, event.target.value, order, type)} value={genre} disabled={type === 'pirate'}>
              {genres.map((genre) => (
                <option key={genre.label} value={genre.value}>
                  {genre.label}
                </option>
              ))}
            </select>
          </div>

          <div className="searchItem">
            <span>Order</span>
            <select onChange={(event) => updateSearch(search, genre, event.target.value, type)} value={order} disabled={type === 'pirate'}>
              {ordering.map((order) => (
                <option key={order.label} value={order.value}>
                  {order.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="red"
            style={{ display: clearVisible ? 'inline' : 'none' }}
            onClick={() => this.clearSearch()}
            disabled={!clearVisible}
          >
            <FaTimes />
          </button>
          <Spinner visible={isSearching} />
        </div>
      </div>
    );
  }
}

export default Search;
