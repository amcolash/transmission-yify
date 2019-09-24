import React, { Component } from 'react';
import { DebounceInput } from 'react-debounce-input';
import { FaTimes } from 'react-icons/fa';
import './Search.css';
import Spinner from './Spinner';

import Genre from '../Data/Genre';
import Order from '../Data/Order';

class Search extends Component {

    clearSearch() {
        this.props.updateSearch("", "", "trending", "All", this.props.type, 1);
    }

    toggle3D() {
        let { search, genre, order, quality, type, page, updateSearch } = this.props;
        updateSearch(search, genre, order, quality === "All" ? "3D" : "All", type, page);
    }

    render() {
        const { search, genre, order, quality, type, page, isSearching, updateSearch } = this.props;
        const clearVisible = search.length > 0 || genre.length > 0 || quality !== "All" || order !== "trending" || page !== 1;

        return (
            <div className="search">
                <div className="form">
                    <div className="searchItem">
                        <span>Search</span>
                        <DebounceInput
                            value={search}
                            debounceTimeout={500}
                            onChange={(event) => updateSearch(event.target.value, genre, order, quality, type)}
                        />
                    </div>

                    <div className="searchItem">
                        <span>Genre</span>
                        <select
                            onChange={(event) => updateSearch(search, event.target.value, order, quality, type)}
                            value={genre}
                        >
                            {Genre.map(genre => (
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
                            onChange={(event) => updateSearch(search, genre, event.target.value, quality, type)}
                            value={order}
                        >
                            {Order.map(order => (
                                <option
                                    key={order.label}
                                    value={order.value}
                                >
                                    {order.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="searchItem">
                        <span>Type</span>
                        <select onChange={(event) => updateSearch(search, genre, order, quality, event.target.value)} value={type} >
                            <option key="movies" value="movies">Movies</option>
                            <option key="shows" value="shows">TV</option>
                            <option key="animes" value="animes">Anime</option>
                        </select>
                    </div>

                    {type === 'movies' ? (
                        <button className={quality === "All" ? "gray" : "green"} onClick={() => this.toggle3D()}>3D</button>) : null }

                    <button className="red" style={{display: clearVisible ? "inline" : "none"}} onClick={() => this.clearSearch()}><FaTimes /></button>
                </div>

                <Spinner visible={isSearching} />
            </div >
        );
    }

}

export default Search;