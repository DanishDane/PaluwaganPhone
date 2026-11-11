// Hand-drawn-ish line icons (24x24)
const p = (d, extra = '') => `<svg viewBox="0 0 24 24" class="ico" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const I = {
  home: p('<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.8 9.6V20h12.4V9.6"/><path d="M10 20v-5.5h4V20"/>'),
  groups: p('<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.6"/><path d="M10.5 5.3h3"/><circle cx="12" cy="14" r="3"/><path d="M12 12.6v2.8M11 13.4h2"/>'),
  users: p('<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.6 14.6c1.8.7 3 2.3 3.4 4.9"/>'),
  receipt: p('<path d="M5.5 3h13v18l-2.2-1.5L14.2 21 12 19.5 9.8 21l-2.1-1.5L5.5 21z"/><path d="M8.8 8h6.4M8.8 11.5h6.4M8.8 15h3.6"/>'),
  gear: p('<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4z"/>'),
  plus: p('<path d="M12 5v14M5 12h14"/>'),
  logout: p('<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.8 12H15"/>'),
  soundOn: p('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: p('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  back: p('<path d="M15 5 8 12l7 7"/>'),
  phone: p('<path d="M5 4.5c0-.8.7-1.5 1.5-1.5h2.2l1.6 4-2 1.3a10.5 10.5 0 0 0 5.4 5.4l1.3-2 4 1.6v2.2c0 .8-.7 1.5-1.5 1.5C10.6 17 5 11.4 5 4.5z" transform="translate(0 1.5)"/>'),
  sms: p('<path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z"/><path d="M8 10.7h.01M12 10.7h.01M16 10.7h.01" stroke-width="2.6"/>'),
  download: p('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
  trash: p('<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13"/>'),
  edit: p('<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="m13 7 4 4"/>'),
  check: p('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  search: p('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  cash: p('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>'),
  key: p('<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>'),
  gift: p('<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4.5-6-2s4 2 6 2c2 0 6 .5 6-2s-4.5-2-6 2"/>'),
  clock: p('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  alert: p('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17h.01"/>'),
  more: p('<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>'),
  spark: p('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  replay: p('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
};

export const coinMark = `<svg viewBox="0 0 40 40" class="coin-mark" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#E9B949" stroke="#16130F" stroke-width="2.5"/><circle cx="20" cy="20" r="12.5" fill="none" stroke="#B88A22" stroke-width="1.6" stroke-dasharray="1.5 2.6"/><text x="20" y="26.5" text-anchor="middle" font-family="Instrument Serif, serif" font-size="19" fill="#16130F">₱</text></svg>`;

