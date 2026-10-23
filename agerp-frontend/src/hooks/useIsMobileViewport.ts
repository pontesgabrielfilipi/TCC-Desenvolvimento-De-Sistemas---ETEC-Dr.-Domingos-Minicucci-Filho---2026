import { useSyncExternalStore } from 'react';

const mediaQuery = '(max-width: 639px)';

function subscribe(onChange: () => void) {
    const media = window.matchMedia(mediaQuery);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
}

function getSnapshot() {
    return window.matchMedia(mediaQuery).matches;
}

export function useIsMobileViewport() {
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
