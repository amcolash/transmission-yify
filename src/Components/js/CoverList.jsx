import React, { Component } from 'react';

import Cover from './Cover';
import Spinner from './Spinner';

export default class CoverList extends Component {
  render() {
    const {
      results,
      selected,
      type,
      click,
      downloadTorrent,
      cancelTorrent,
      torrents,
      started,
      getProgress,
      server,
      files,
      status,
      toggleSubscription,
      isSearching,
      viewMode,
      showLatest,
    } = this.props;

    const style =
      viewMode === 'standard'
        ? {}
        : {
            display: 'flex',
            flexDirection: 'row',
          };

    return (
      <div style={style}>
        {results.map(media => (
          <Cover
            key={media.id}
            media={media}
            selected={selected}
            type={type}
            click={click}
            downloadTorrent={downloadTorrent}
            cancelTorrent={cancelTorrent}
            torrents={torrents} // only passed in so that versions are properly updated when needed
            started={started}
            getProgress={getProgress}
            server={server}
            files={files} // only show downloaded files for movies
            status={status}
            toggleSubscription={toggleSubscription}
            viewMode={viewMode}
            showLatest={showLatest}
          />
        ))}
        <br />
        {isSearching ? <Spinner visible big /> : null}
      </div>
    );
  }
}
