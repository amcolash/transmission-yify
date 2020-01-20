import React, { Component } from 'react';
import MovieList from './MovieList';
import { IconContext } from 'react-icons';
import '../css/App.css';

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
