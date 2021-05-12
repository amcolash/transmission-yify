import { isKeyboardVisible } from './cordova-plugins';

export function onfocus(e) {
  const backdrop = document.querySelector('.backdropCarousel');
  if (backdrop) {
    const focused = backdrop.contains(e.target);
    backdrop.classList.toggle('expanded', focused);
    const top = document.querySelector('.carouselTop');
    if (top) top.classList.toggle('collapsed', focused);
    const menu = document.querySelector('.toggleButton');
    if (menu) menu.classList.toggle('collapsed', focused);
  }
}

export function focusCover(state) {
  if (!state.media) return;

  const covers = document.querySelectorAll('.cover');
  let foundIndex = 0;
  for (let i = 0; i < covers.length; i++) {
    if (parseInt(covers[i].id) === state.media.id || covers[i].id === state.media.id) foundIndex = i;
  }

  if (covers.length > foundIndex) covers[foundIndex].focus();
}

export function getFocusable(el) {
  return (el || document).querySelectorAll(
    'a[href]:not([disabled]), button:not([disabled]):not(.arrow), textarea:not([disabled]), input[type="text"]:not([disabled]), ' +
      'input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), ' +
      '[tabindex="0"]:not([disabled])'
  );
}

export function getFocusIndex(els, active) {
  const activeElement = active || document.activeElement;

  if (activeElement) {
    for (let i = 0; i < els.length; i++) {
      if (els[i] === activeElement) return i;
    }
  }

  return 0;
}

function getFocusableItem(el, dir, shouldWrap) {
  const focusableEls = getFocusable(el);
  let index = getFocusIndex(focusableEls) + dir;

  if (shouldWrap) {
    if (index >= focusableEls.length) index = 0;
    if (index < 0) index = focusableEls.length - 1;
  } else {
    if (index >= focusableEls.length) index = focusableEls.length - 1;
    index = Math.max(0, index);
  }

  return focusableEls[index];
}

export function focusToIndex(el, index) {
  const focusableEls = getFocusable(el);

  index = Math.max(0, Math.min(index, focusableEls.length - 1));
  if (focusableEls[index]) focusableEls[index].focus();
}

export function focusItem(el, dir, shouldWrap) {
  const item = getFocusableItem(el, dir, shouldWrap);
  if (item) item.focus();
}

let lastBack = 0;
export function handleBack(e, state) {
  const active = document.activeElement;

  const menuToggleEl = document.querySelector('.toggleButton');
  const backdropEl = document.querySelector('.backdropContainer');
  const videosContainerEl = document.querySelector('.otherVideos');
  const videosButtonEl = document.querySelector('.otherVideos .toggle span');
  const youtubeCloseButton = document.querySelector('.ytContainer button');

  let backdropFocus = false;
  if (backdropEl) backdropFocus = backdropEl.contains(active);
  let videosOpen = false;
  if (videosContainerEl && !videosContainerEl.classList.contains('hidden')) videosOpen = true;

  if (youtubeCloseButton) youtubeCloseButton.click();
  else if (videosOpen && videosButtonEl) {
    videosButtonEl.click();
    videosButtonEl.focus();
  } else if (backdropFocus) focusCover(state);
  else if (menuToggleEl) {
    if (active === menuToggleEl && navigator.app && new Date().getTime() - (lastBack || 0) < 1000) {
      navigator.app.exitApp();
      return;
    }

    menuToggleEl.focus();
    document.querySelector('#root').scrollTo(0, 0);
  }

  lastBack = new Date().getTime();

  return false;
}

export function handleKeys(e, state) {
  // For now, only have the arrow key navigation work for carousel
  if (state.viewMode !== 'carousel') return;

  const active = document.activeElement;

  const menuEl = document.querySelector('.menu');
  const menuToggleEl = document.querySelector('.toggleButton');
  const backdropEl = document.querySelector('.backdropContainer');
  const searchEl = document.querySelector('.search .form');
  const videosContainerEl = document.querySelector('.otherVideos');
  const videosButtonEl = document.querySelector('.otherVideos .toggle span');
  const videosEl = document.querySelector('.otherVideos .videoContainer');
  const movieListEl = document.querySelector('.movie-list');
  const infoEl = document.querySelector('.backdropContainer .right .details');
  const rightEl = document.querySelector('.backdropContainer .right');
  const recommendationsEl = document.querySelector('.recommendations');
  const backdropCarouselExpandedEl = document.querySelector('.backdropCarousel.expanded');

  const coverFocus = active.classList.contains('cover') && (state.type === 'movies' || state.type === 'shows' || state.type === 'animes');

  let menuToggleFocus = false;
  if (menuEl) menuToggleFocus = active === menuToggleEl;
  let menuOpen = false;
  if (menuEl) menuOpen = !menuEl.classList.contains('hidden');
  let searchFocus = false;
  if (searchEl) searchFocus = searchEl.contains(active);
  let backdropFocus = false;
  if (backdropEl) backdropFocus = backdropEl.contains(active);
  let loadingBackdrop = false;
  if (backdropEl) loadingBackdrop = backdropEl.querySelectorAll('.spinner').length > 0;
  let videosOpen = false;
  if (videosContainerEl && !videosContainerEl.classList.contains('hidden')) videosOpen = true;

  // If the backdrop is expanded, but focus is on body make a focus trap and keep things focused inside backdrop
  if (active === document.body && backdropCarouselExpandedEl) {
    focusItem(backdropEl, 0, true);
    return;
  }

  // Always focus onto menu button when body is active element
  if (
    active === document.body &&
    menuToggleEl &&
    (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
  ) {
    menuToggleEl.focus();
    return;
  }

  // If we are focused on the info on the right side, scroll if possible
  if (active === infoEl && rightEl && !loadingBackdrop) {
    if (e.key === 'ArrowUp' && rightEl.scrollTop !== 0) {
      rightEl.scrollTop -= 15;

      // Since android + cordova doesn't seem to scroll as the default, force the scroll
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      const next = getFocusableItem(backdropEl, 1, false);
      if (next && rightEl.scrollTop + rightEl.clientHeight < next.offsetTop) {
        rightEl.scrollTop += 15;

        // Since android + cordova doesn't seem to scroll as the default, force the scroll
        e.preventDefault();
        return;
      }
    }
  }

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (videosOpen && videosEl) focusItem(videosEl, -1, true);
      else if (backdropFocus) focusItem(backdropEl, -1, true);
      else if (coverFocus) {
        if (rightEl) rightEl.scrollTop = 0;
        if (recommendationsEl) recommendationsEl.scrollLeft = 0;
        focusItem(movieListEl, -1);
      } else if (menuOpen && menuToggleEl) {
        menuToggleEl.focus();
        menuToggleEl.click();
      } else focusItem(document, -1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (videosOpen && videosEl) focusItem(videosEl, 1, true);
      else if (backdropFocus) focusItem(backdropEl, 1, true);
      else if (coverFocus) {
        if (rightEl) rightEl.scrollTop = 0;
        if (recommendationsEl) recommendationsEl.scrollLeft = 0;
        focusItem(movieListEl, 1);
      } else if (menuOpen && menuToggleEl) {
        menuToggleEl.focus();
        menuToggleEl.click();
      } else focusItem(document, 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (videosOpen && videosButtonEl) {
        videosButtonEl.click();
        videosButtonEl.focus();
      } else if (backdropFocus) {
        // If on the 1st item and up press, go back to covers
        const focusableEls = getFocusable(backdropEl);
        const index = getFocusIndex(focusableEls);
        if (index === 0 && !loadingBackdrop) focusCover(state);
        else focusItem(backdropEl, -1, true);
      } else if (coverFocus && menuToggleEl) menuToggleEl.focus();
      else focusItem(document, -1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (videosOpen && videosButtonEl) {
        videosButtonEl.click();
        videosButtonEl.focus();
      } else if (backdropFocus) focusItem(backdropEl, 1, true);
      else if (coverFocus) focusItem(backdropEl, 0);
      else if (menuOpen) focusItem(menuEl, 1);
      else if ((searchFocus || menuToggleFocus) && backdropEl) focusCover(state);
      else focusItem(document, 1);
      break;
    case 'Escape':
      handleBack(null, state);
      break;
    case 'Enter':
      if (searchFocus && isKeyboardVisible()) {
        focusCover(state);
      } else if (videosEl && videosButtonEl && active === videosButtonEl) {
        e.preventDefault();
        videosEl.querySelector('img').focus();
      } else if (coverFocus) {
        e.preventDefault();
        focusItem(backdropEl, 0);
      }
      break;
    default:
      break;
  }

  // Scroll to bottom when recommendation is first selected
  if (
    document.activeElement &&
    rightEl &&
    document.activeElement.parentElement.classList.contains('recommendations') &&
    document.activeElement.classList.contains('item') &&
    rightEl.scrollTop < rightEl.scrollHeight - rightEl.clientHeight - 10
  ) {
    rightEl.scrollTop = rightEl.scrollHeight - rightEl.clientHeight;
  }
}
