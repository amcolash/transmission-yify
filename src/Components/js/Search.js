import React, { Component } from 'react';
import { DebounceInput } from 'react-debounce-input';
import { FaTimes } from 'react-icons/fa';
import '../css/Search.css';
import Spinner from './Spinner';

import Genre from '../../Data/Genre';
import Order from '../../Data/Order';

class Search extends Component {

    clearSearch() {
        this.props.updateSearch('', '', '', this.props.type, 1);
    }

    render() {
        const { search, genre, order, type, isSearching, updateSearch } = this.props;
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

        return (
            <div className="search">
                <div className="form">
                    <div className="searchItem">
                        <span>Search</span>
                        <DebounceInput
                            value={search}
                            debounceTimeout={500}
                            onChange={(event) => updateSearch(event.target.value, genre, order, type)}
                        />
                    </div>

                    <div className="searchItem">
                        <span>Genre</span>
                        <select
                            onChange={(event) => updateSearch(search, event.target.value, order, type)}
                            value={genre}
                            disabled={type === 'pirate'}
                        >
                            {genres.map(genre => (
                                <option
                                    key={genre.label}
                                    value={genre.value}
                                >
                                    {genre.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="searchItem">
                        <span>Order</span>
                        <select
                            onChange={(event) => updateSearch(search, genre, event.target.value, type)}
                            value={order}
                            disabled={type === 'pirate'}
                        >
                            {ordering.map(order => (
                                <option
                                    key={order.label}
                                    value={order.value}
                                >
                                    {order.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button className="red" style={{display: clearVisible ? "inline" : "none"}} onClick={() => this.clearSearch()}><FaTimes /></button>
                    <Spinner visible={isSearching} />
                </div>
            </div >
        );
    }

}

export default Search;