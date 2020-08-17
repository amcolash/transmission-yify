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
      Object.keys(propsDiff.torrents).forEach((t) => {
        const torrent = propsDiff.torrents[t];
        if (torrent && (torrent.percentDone || torrent.rateDownload)) propsChanged = true;
      });
    }
  }

  if (stateKeys.length === 1 && stateDiff.torrents) {
    stateChanged = false;

    if (checkTorrents) {
      Object.keys(stateDiff.torrents).forEach((t) => {
        const torrent = stateDiff.torrents[t];
        if (torrent && (torrent.percentDone || torrent.rateDownload)) stateChanged = true;
      });
    }
  }

  // If the number of torrents chages, always force change
  if (propsDiff.torrents && Object.keys(propsDiff.torrents).length) propsChanged = true;

  // If the number of torrents chages, always force change
  if (stateDiff.torrents && Object.keys(stateDiff.torrents).length) stateChanged = true;

  // if (propsChanged) console.log('props', propsDiff);
  // if (stateChanged) console.log('state', stateDiff);

  return propsChanged || stateChanged;
}

export function getPirateSearchUrl(server, title, year) {
  let cleanedTitle = title.replace(/('|")/g, '').replace(/[^\w\s]/gi, ' ');

  // console.log(cleanedTitle);

  // Exceptions for weird cases
  if (year === 2020 && cleanedTitle === 'Guns Akimbo') year = ''; // There was one released in 2019, just use that
  if (cleanedTitle.startsWith('Birds of Prey') && year === 2020) cleanedTitle = 'Birds of Prey'; // Shorten the title to match easier

  const url = `${server}/pirate/${cleanedTitle} ${year}?movie=true`;
  return url;
}

export function hasParent(el, parent) {
  if (el.parentElement === parent) return true;
  else if (el.parentElement) return hasParent(el.parentElement, parent);
  else return false;
}
