// ============================================================
// VigApp — Lucide Icons Helper
// Provides a simple function to create SVG icons from Lucide
// ============================================================
import { icons } from 'lucide';

/**
 * Creates an SVG element for a Lucide icon.
 * @param {string} name — Icon name (e.g., 'home', 'search', 'users')
 * @param {object} [attrs] — Additional attributes (width, height, class, etc.)
 * @returns {string} SVG markup string
 */
export function icon(name, attrs = {}) {
  const iconData = icons[name];
  if (!iconData) {
    console.warn(`Icon "${name}" not found in Lucide.`);
    return '';
  }

  const size = attrs.size || 18;
  const className = attrs.class || 'icon';
  const strokeWidth = attrs.strokeWidth || 2;

  const svgAttrs = `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${className}"`;

  // iconData[1] is the array of SVG child elements
  const paths = iconData[1].map(([tag, attributes]) => {
    const attrStr = Object.entries(attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    return `<${tag} ${attrStr}/>`;
  }).join('');

  return `<svg ${svgAttrs}>${paths}</svg>`;
}

/**
 * Creates an icon element (DOM node).
 * @param {string} name
 * @param {object} [attrs]
 * @returns {HTMLElement}
 */
export function iconEl(name, attrs = {}) {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = icon(name, attrs);
  return wrapper.firstElementChild;
}

// Common icon names used throughout the app
export const ICONS = {
  // Navigation
  dashboard: 'LayoutDashboard',
  leads: 'Radar',
  companies: 'Building2',
  clients: 'Users',
  services: 'Briefcase',
  subscriptions: 'CreditCard',
  kanban: 'Columns3',
  calendar: 'Calendar',
  marketing: 'Megaphone',
  users: 'UserCog',
  settings: 'Settings',

  // Actions
  add: 'Plus',
  edit: 'Pencil',
  delete: 'Trash2',
  save: 'Check',
  cancel: 'X',
  search: 'Search',
  filter: 'SlidersHorizontal',
  more: 'MoreHorizontal',
  close: 'X',
  refresh: 'RefreshCw',
  download: 'Download',
  upload: 'Upload',
  expand: 'Maximize2',

  // Status
  success: 'CheckCircle',
  warning: 'AlertTriangle',
  error: 'XCircle',
  info: 'Info',

  // UI
  sun: 'Sun',
  moon: 'Moon',
  menu: 'Menu',
  chevronLeft: 'ChevronLeft',
  chevronRight: 'ChevronRight',
  chevronDown: 'ChevronDown',
  arrowUp: 'TrendingUp',
  arrowDown: 'TrendingDown',
  logout: 'LogOut',
  eye: 'Eye',
  eyeOff: 'EyeOff',
  star: 'Star',
  starFilled: 'Star',
  globe: 'Globe',
  phone: 'Phone',
  mail: 'Mail',
  mapPin: 'MapPin',
  clock: 'Clock',
  dollarSign: 'DollarSign',
  target: 'Target',
  barChart: 'BarChart3',
  pieChart: 'PieChart',
  trendingUp: 'TrendingUp',
  trendingDown: 'TrendingDown',
  grip: 'GripVertical',
  link: 'ExternalLink',
  copy: 'Copy',
  archive: 'Archive',
  flag: 'Flag',
  hash: 'Hash',
  tag: 'Tag',
  bookmark: 'Bookmark',
  send: 'Send',
  image: 'Image',
  file: 'FileText',
  folder: 'Folder',
  award: 'Award',
  zap: 'Zap',
  activity: 'Activity',
};
