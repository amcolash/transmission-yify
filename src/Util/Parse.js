import magnet from 'magnet-uri';
import * as  ptn  from 'parse-torrent-name';
import levenshtein from 'js-levenshtein';

export function getMovies(media, pb, type) {
    // console.log(media, pb, type)
    if (type !== 'movies' || !pb || !pb) return [];

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
            
            if (sort === 0 || (versions[parsed.resolution] && versions[parsed.resolution].seeds > t.seeds)) return;
            
            versions[parsed.resolution] = {
                quality: `${parsed.resolution} ${isCam ? '(CAM)' : ''}`,
                sort: sort,
                peers: t.leeches,
                seeds: t.seeds,
                ratio: t.leeches > 0 ? (t.seeds / t.leeches).toFixed(3) : 0,
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

export function getSeasons(type, maxSeason, moreData) {
    const seasons = [];

    if (type === 'shows' || type === 'animes') {
        if (type === 'shows') {
            for (let i = 1; i < maxSeason + 1; i++) {
                if (moreData && i <= moreData.seasons.length) seasons.push(i);
            }
        } else {
            seasons.push(1);
        }
    }

    return seasons;
}

export function getEpisodes(torrents, moreData, type) {
    let episodes = [];

    if (type === 'movies') return episodes;
    
    if (torrents && torrents.torrents) {
        torrents.torrents.forEach(torrent => {
            const parsed = ptn(torrent.filename || torrent.name);
            parsed.resolution = parsed.resolution || '480p';
            if (type === 'animes') parsed.season = 1; // keep anime in 1 season
            
            // Bail if we weren't able to parse season/episode
            if ((type === 'shows' && parsed.season === 0) || parsed.episode === 0 || (moreData && parsed.episode > moreData.EpisodeCount) ||
                ((moreData && moreData.seasons) ? parsed.season > moreData.seasons.length : false)) return;
            
            let title = `Episode ${parsed.episode}`;
            if (moreData && moreData.seasons && moreData.seasons[parsed.season - 1] && moreData.seasons[parsed.season - 1].episodes &&
                moreData.seasons[parsed.season - 1].episodes[parsed.episode - 1]) {
                title = parsed.episode + ' - ' + moreData.seasons[parsed.season - 1].episodes[parsed.episode - 1].name;
            }

            episodes[parsed.season] = episodes[parsed.season] || [];
            episodes[parsed.season][parsed.episode] = episodes[parsed.season][parsed.episode] || {
                title: title,
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


export function convertTime(min) {
    if (!min) return '';
    min = Number.parseInt(min.replace(' min', ''));

    const hours = Math.floor(min / 60);
    const minutes = Math.floor(((min / 60) - hours) * 60);
    
    return (hours > 0 ? hours + "h " : "") + (minutes > 0 ? minutes + "m" : "");
}

export function getDetails(media, moreData, tmdbData, type, maxSeason) {
    let genres;
    if (tmdbData && tmdbData.genres) {
        genres = tmdbData.genres.map(g => g.name);
        genres = (genres.length > 1 ? 'Genres: ' : 'Genre: ') + genres.join(', ');
    } else if (moreData) {
        if (moreData) genres = moreData.genres || moreData.Genres;
        genres = genres || [];
        
        genres = (genres.length === 1 ? "Genre: " : "Genres: ") +
        JSON.stringify(genres).replace(/[[\]"]/g, '').replace(/,/g, ', ');
    }

    let mpaa = media.certification;
    if (!mpaa || mpaa === "N/A") {
        if (moreData && moreData.Rated && moreData.Rated !== "N/A") {
            mpaa = moreData.Rated;
        } else {
            mpaa = "NR";
        }
    }
    
    let header;
    if (type === 'movies') header = `${media.year}${moreData ? ', ' + convertTime(moreData.Runtime) : ''}`;
    else header = `${(moreData && moreData.Year) ? moreData.Year : media.year} ${maxSeason + (maxSeason > 1 ? ' Seasons' : ' Season')}`;
    
    const plot = (moreData && moreData.Plot) ? moreData.Plot : ((moreData && moreData.overview) ?
    moreData.overview : (media.synopsis ? media.synopsis : ""));
    
    let director;
    if (moreData && moreData.Director && moreData.Director.indexOf("N/A") === -1) {
        director = (moreData.Director.indexOf(",") !== -1 ? "Directors: " : "Director: ") + moreData.Director;
    }

    let writers;
    if (moreData && moreData.Writer){
        writers = (moreData.Writer.indexOf(",") !== -1 ? "Writers: " : "Writer: ") + moreData.Writer.replace(/\s*\(.*?\)/g, '');
    }

    let trailer;
    if (tmdbData && tmdbData.videos) {
        tmdbData.videos.results.some(video => {
            // If this is the first trailer, choose it and ignore others
            if (video.type === 'Trailer' && video.site === 'YouTube') {
                trailer = video;
                return true;
            }

            return false;
        });
    }

    return {
        mpaa,
        genres,
        header,
        plot,
        director,
        writers,
        trailer
    };
}

export function hasFile(media, files) {
    for (let i = 0; i < files.length; i++) {
        if (media && media.title && media.year) {
            const file = files[i];
            const lev = levenshtein(file.title.toLowerCase(), media.title.toLowerCase());
            const match = (1 - (lev / Math.max(file.title.length, media.title.length)));

            if (match > 0.95 && file.year === media.year) {
                return true;
            }
        }
    }
    return false;
}

export function parseMedia(media, type) {
    // used for anime
    const attributes = media.attributes;
    if (attributes) {
        media.title = attributes.canonicalTitle;
        media.year = attributes.startDate;
        if (attributes.posterImage) media.poster_path = attributes.posterImage.small;
    }

    // fix weird years (since it seems the year can vary based on region released first)
    media.year = media.year || media.release_date || media.first_air_date;

    // only try to do fancy stuff if not a standard year
    if (media.year && !media.year.toString().match(/^\d{4}$/)) media.year = new Date(media.year).getFullYear();

    media.title = media.title || media.name || '?';
    media.title = media.title.replace(/&amp;/g, '&');
    
    // TMDB does not add an absolute url to returned poster paths
    if (media.poster_path && media.poster_path.indexOf('http') === -1) {
        media.poster_path = 'https://image.tmdb.org/t/p/w300_and_h450_bestv2/' + media.poster_path;
    }

    // Fake tv data
    if (type !== 'movies') media.num_seasons = 1;

    return media;
}