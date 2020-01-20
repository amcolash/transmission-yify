import { diff } from 'deep-object-diff';

export function shouldUpdate(props, state, nextProps, nextState, checkTorrents) {
  const propsDiff = diff(props, nextProps);
  const propsKeys = Object.keys(propsDiff);
  let propsChanged = propsKeys.length > 0;

  const stateDiff = diff(state, nextState);
  const stateKeys = Object.keys(stateDiff);
  let stateChanged = stateKeys.length > 0;

  if (propsKeys.length === 1 && propsDiff.torrents) {
    propsChanged = false;

    if (checkTorrents) {
      Object.keys(propsDiff.torrents).forEach(t => {
        const torrent = propsDiff.torrents[t];
        if (torrent && (torrent.percentDone || torrent.rateDownload)) propsChanged = true;
      });
    }
  }

  if (stateKeys.length === 1 && stateDiff.torrents) {
    stateChanged = false;

    if (checkTorrents) {
      Object.keys(stateDiff.torrents).forEach(t => {
        const torrent = stateDiff.torrents[t];
        if (torrent && (torrent.percentDone || torrent.rateDownload)) stateChanged = true;
      });
    }
  }
  // if (propsChanged) console.log('props', propsDiff);
  // if (stateChanged) console.log('state', stateDiff);

  return propsChanged || stateChanged;
}
