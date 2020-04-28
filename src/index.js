import React from 'react';
import ReactDOM from 'react-dom';

import App from './Components/js/App';
import { initKeyboard } from './Util/cordova-plugins';

const startApp = () => ReactDOM.render(<App />, document.getElementById('root'));

document.body.onload = () => {
  console.log('cordova? ', window.cordova);
  const root = document.getElementById('root');

  if (!window.cordova) {
    startApp();
  } else {
    root.classList.add('cordova');
    document.addEventListener(
      'deviceready',
      () => {
        initKeyboard();
        startApp();
      },
      false
    );
  }

  let viewMode = window.localStorage.getItem('viewMode');
  if (!viewMode) viewMode = window.cordova ? 'carousel' : 'standard';

  // Prevent scrolling the root element
  root.onscroll = (e) => {
    if (viewMode === 'standard') return;
    e.preventDefault();
    root.scrollTop = 0;
  };

  root.classList.add(viewMode);
};
