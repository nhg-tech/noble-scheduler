export const NOBLE_PALETTE = [
  { hex: '#3E2A7E', name: 'Noble Purple',  textLight: true  },
  { hex: '#DABC8A', name: 'Noble Gold',    textLight: false },
  { hex: '#7B5EA7', name: 'Med Purple',    textLight: true  },
  { hex: '#C4B5F4', name: 'Soft Lavender', textLight: false },
  { hex: '#1565C0', name: 'Deep Blue',     textLight: true  },
  { hex: '#2196F3', name: 'Mid Blue',      textLight: true  },
  { hex: '#90CAF9', name: 'Soft Blue',     textLight: false },
  { hex: '#2E7D32', name: 'Deep Green',    textLight: true  },
  { hex: '#43A047', name: 'Mid Green',     textLight: true  },
  { hex: '#A5D6A7', name: 'Soft Green',    textLight: false },
  { hex: '#E65100', name: 'Warm Orange',   textLight: true  },
  { hex: '#F9A825', name: 'Amber',         textLight: false },
  { hex: '#B71C1C', name: 'Deep Red',      textLight: true  },
  { hex: '#E53935', name: 'Mid Red',       textLight: true  },
  { hex: '#FFCDD2', name: 'Soft Red',      textLight: false },
  { hex: '#37474F', name: 'Dark Gray',     textLight: true  },
  { hex: '#78909C', name: 'Mid Gray',      textLight: true  },
  { hex: '#B0BEC5', name: 'Light Gray',    textLight: false },
  { hex: '#880E4F', name: 'Wine',          textLight: true  },
  { hex: '#FFFFFF', name: 'White',         textLight: false },
];

const BLOCK_COLOR_TO_HEX = {
  'block-group': '#3E2A7E',
  'block-suite': '#1565C0',
  'block-meals': '#E65100',
  'block-fixed': '#2E7D32',
  'block-on':    '#37474F',
};

export function resolveBlockHex(colorClassOrHex) {
  if (!colorClassOrHex) return '#3E2A7E';
  if (colorClassOrHex.startsWith('#')) return colorClassOrHex;
  return BLOCK_COLOR_TO_HEX[colorClassOrHex] || '#3E2A7E';
}

export function resolveBlockText(colorClassOrHex) {
  const hex = resolveBlockHex(colorClassOrHex);
  const p = NOBLE_PALETTE.find(c => c.hex === hex);
  return p ? (p.textLight ? '#fff' : '#222') : '#fff';
}
