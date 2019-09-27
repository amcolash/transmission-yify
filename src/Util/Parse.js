import magnet from 'magnet-uri';
import * as  ptn  from 'parse-torrent-name';

export function getMovies(media, pb) {
    // Only show cams if there are not other versions
    let hasNonCam = false;
    pb.forEach(t => {
        const parsed = ptn(t.name);
        if (parsed.quality && parsed.resolution) hasNonCam |= parsed.quality.toLowerCase().indexOf('cam') === -1;
    });
    
    let versions = [];
    
    pb.forEach(t => {
        const parsed = ptn(t.name);
        if (!parsed.quality || !parsed.resolution) return;
        
        let shouldAdd = true;
        let isCam = parsed.quality.toLowerCase().indexOf('cam') !== -1;
        if (parsed.resolution === '2160p' || (hasNonCam && isCam)) {
            shouldAdd = false;
        }
        
        if (shouldAdd) {
            let sort = 0;
            
            // Not going to show 2160p since they are UUUUGE
            switch (parsed.resolution) {
                case "1080p": sort = 3; break;
                case "720p": sort = 2; break;
                case "480p": sort = 1; break;
                default: sort = 0; break;
            }
            
            if (sort === 0 || (versions[parsed.resolution] && versions[parsed.resolution].seeds > t.seeders)) return;
            
            versions[parsed.resolution] = {
                quality: `${parsed.resolution} ${isCam ? '(CAM)' : ''}`,
                sort: sort,
                peers: t.leechers,
                seeds: t.seeders,
                ratio: t.leechers > 0 ? (t.seeders / t.leechers).toFixed(3) : 0,
                url: t.magnetLink,
                hashString: magnet.decode(t.magnetLink).infoHash.toLowerCase(),
                size: t.size,
                title: media.title + " (" + media.year + ") [" + parsed.resolution + "]"
            };
        }
    });
    
    // Sort the versions
    return Object.values(versions).sort(function(a, b) {
        return b.sort - a.sort;
    });
}

export function getEpisodes(torrents, moreData, tvData, type) {
    let episodes = [];
    
    if (torrents) {
        torrents.torrents.forEach(torrent => {
            const parsed = ptn(torrent.filename || torrent.name);
            parsed.resolution = parsed.resolution || '480p';
            if (type === 'animes') parsed.season = 1; // keep anime in 1 season
            
            // Bail if we weren't able to parse season/episode
            if ((type === 'shows' && parsed.season === 0) || parsed.episode === 0 || (moreData && parsed.episode > moreData.EpisodeCount) ||
                (tvData && parsed.season > tvData.seasons.length)) return;
            
            episodes[parsed.season] = episodes[parsed.season] || [];
            episodes[parsed.season][parsed.episode] = episodes[parsed.season][parsed.episode] || {
                title: `Episode ${parsed.episode}`,
                episode: parsed.episode,
                season: parsed.season,
                torrents: {}
            };
            
            const seeds = torrent.seeds || torrent.seeders;
            const peers = torrent.peers || torrent.leechers;
            
            const existing = episodes[parsed.season][parsed.episode].torrents[parsed.resolution];
            if (!existing || seeds > existing.seeds) {
                const url = torrent.magnet_url || torrent.torrent_url || torrent.magnet;
                const hash = magnet.decode(url).infoHash.toLowerCase();
                
                let sort = 0;
                switch (parsed.resolution) {
                    case "1080p": sort = 3; break;
                    case "720p": sort = 2; break;
                    case "480p": sort = 1; break;
                    default: sort = 0; break;
                }
                
                episodes[parsed.season][parsed.episode].torrents[parsed.resolution] = {
                    seeds: seeds,
                    peers: peers,
                    url: url,
                    hashString: hash,
                    sort: sort,
                    quality: parsed.resolution,
                    tv: true
                };
            }
        });
        
        episodes.forEach(season => {
            season.forEach(episode => {
                episode.torrents = Object.values(episode.torrents).sort((a, b) => b.sort - a.sort);
            });
        });
    }
    
    return episodes;
}