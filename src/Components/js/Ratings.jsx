import React, { Component } from 'react';

import '../css/Ratings.css';

class Ratings extends Component {
  render() {
    const moreData = this.props.moreData;

    if (!moreData || moreData === 'ERROR' || ! moreData.Ratings) return null;

    return <div className="ratings">
      {moreData.Ratings.map(rating => (
        <div key={rating.Source}>{this.getIcon(rating)} {rating.Value}</div>
      ))}
    </div>
  }

  getIcon(rating) {
    switch(rating.Source) {
      case 'Internet Movie Database': return <img src="imdb.png" alt="IMDB Icon"></img>;
      case 'Rotten Tomatoes': return <img src={Number.parseInt(rating.Value) > 60 ? 'fresh-tomato.png' : 'rotten-tomato.png'}
        alt="Rotten Tomatoes Icon"></img>;
      case 'Metacritic': return <img src="metacritic.svg" alt="Metacritic Icon"></img>;
      default: return null;
    }
  }
}

export default Ratings;