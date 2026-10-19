// Only normalize known application paths; retain queries and auth fragments.
export function cleanPageURL(href) {
    const url = new URL(href);
    if (url.pathname === '/dice.html' || url.pathname === '/pick-a-game') {
        url.pathname = '/pick-a-game/';
    } else if (url.pathname === '/index.html') {
        url.pathname = '/';
    } else if (url.pathname === '/pick-a-game/index.html') {
        url.pathname = '/pick-a-game/';
    }
    return url;
}
