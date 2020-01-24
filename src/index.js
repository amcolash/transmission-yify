import React from 'react';
import ReactDOM from 'react-dom';

import App from './Components/js/App';

const startApp = () => ReactDOM.render(<App />, document.getElementById('root'));

document.body.onload = () => {
  console.log('cordova? ', window.cordova);
  if (!window.cordova) {
    startApp();
  } else {
    document.querySelector('#root').classList.add('cordova');
    document.addEventListener('deviceready', startApp, false);
  }
};
