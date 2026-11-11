// Shared app state + 3D scene lifecycle
export const state = {
  meta: null,
  me: null,
  scenes: [],
  today: null,
};

export function track(scene) {
  state.scenes.push(scene);
  return scene;
}

export function disposeScenes() {
  for (const s of state.scenes) {
    try { s.dispose(); } catch { /* ignore */ }
  }
  state.scenes = [];
}

export function go(path) {
  if (location.hash === '#' + path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }).format(new Date()));
  if (h < 12) return 'Magandang umaga';
  if (h < 18) return 'Magandang hapon';
  return 'Magandang gabi';
}

