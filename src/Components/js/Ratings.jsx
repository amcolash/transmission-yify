import '../css/Ratings.css';

import React, { Component, Fragment } from 'react';

class Ratings extends Component {
  render() {
    const moreData = this.props.moreData;

    if (!moreData || moreData === 'ERROR' || !moreData.Ratings) return null;

    // console.log(moreData.Ratings);

    return (
      <div className="ratings">
        {moreData.Ratings.map((rating) => (
          <div key={rating.Source}>
            {rating.Source === 'Internet Movie Database' && !window.cordova && this.props.imdb ? (
              <a
                href={`https://imdb.com/title/${this.props.imdb}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
                onClick={(e) => e.stopPropagation()}
              >
                {this.getIcon(rating)} {rating.Value}
              </a>
            ) : (
              <Fragment>
                {this.getIcon(rating)} {rating.Value}
              </Fragment>
            )}
          </div>
        ))}
      </div>
    );
  }

  getIcon(rating) {
    switch (rating.Source) {
      case 'Internet Movie Database':
        return <img src="imdb.png" alt="IMDB Icon"></img>;
      case 'Rotten Tomatoes':
        return <img src={Number.parseInt(rating.Value) > 60 ? 'fresh-tomato.png' : 'rotten-tomato.png'} alt="Rotten Tomatoes Icon"></img>;
      case 'Metacritic':
        return <img src="metacritic.svg" alt="Metacritic Icon"></img>;
      default:
        return null;
    }
  }
}

export default Ratings;
