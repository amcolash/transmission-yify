import '../css/App.css';

import React, { Component } from 'react';
import { IconContext } from 'react-icons';

import MovieList from './MovieList';

class App extends Component {
  render() {
    return (
      // Context allows for applying a class to all icons
      <IconContext.Provider value={{ className: 'react-icons' }}>
        <MovieList />
      </IconContext.Provider>
    );
  }
}

export default App;
