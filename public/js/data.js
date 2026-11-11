// Catalog data
export const IPHONES = [
  'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
  'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
  'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16e', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
  'iPhone 17', 'iPhone Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max',
];

export const STORAGE = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];

export const COLORS = [
  ['Black', '#1f1f22'], ['White', '#f2f0eb'], ['(PRODUCT)RED', '#b3202a'], ['Blue', '#3d5a80'], ['Green', '#4f6f5a'],
  ['Purple', '#b8a9d9'], ['Yellow', '#f3dd7a'], ['Pink', '#f2c6cf'], ['Midnight', '#1e2430'], ['Starlight', '#ede4d3'],
  ['Graphite', '#4a4a4c'], ['Gold', '#e8d3b0'], ['Silver', '#e3e4e5'], ['Sierra Blue', '#a7c1d9'], ['Pacific Blue', '#2f4e66'],
  ['Alpine Green', '#3e5245'], ['Deep Purple', '#5b4e66'], ['Space Black', '#2e2c2e'], ['Natural Titanium', '#bab4a9'],
  ['Blue Titanium', '#3f4a59'], ['White Titanium', '#e9e7e2'], ['Black Titanium', '#3b3b3d'], ['Desert Titanium', '#c4a98a'],
  ['Teal', '#9ed1cc'], ['Ultramarine', '#5d6fd8'], ['Cosmic Orange', '#e8742f'], ['Deep Blue', '#2c3a55'], ['Sage', '#b5c2a5'],
  ['Lavender', '#c8bde3'], ['Mist Blue', '#b6c7da'], ['Sky Blue', '#c9dcea'], ['Light Gold', '#efe0c2'], ['Cloud White', '#f4f3ef'],
];

export const METHODS = ['Cash', 'GCash', 'Maya', 'Bank transfer', 'Other'];

export const isPro = (model) => /pro/i.test(model || '');

