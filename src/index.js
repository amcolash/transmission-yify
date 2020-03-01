import React from 'react';
import ReactDOM from 'react-dom';

import App from './Components/js/App';

const startApp = () => ReactDOM.render(<App />, document.getElementById('root'));

document.body.onload = () => {
  console.log('cordova? ', window.cordova);
  const root = document.getElementById('root');
  // Prevent scrolling the root element
  root.onscroll = e => {
    e.preventDefault();
    root.scrollTop = 0;
  };

  if (!window.cordova) {
    startApp();
  } else {
    root.classList.add('cordova');
    document.addEventListener('deviceready', startApp, false);
  }

  let viewMode = window.localStorage.getItem('viewMode');
  if (!viewMode) viewMode = window.cordova ? 'carousel' : 'standard';

  root.classList.add(viewMode);
};
