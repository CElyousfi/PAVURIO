import { Platform } from 'react-native';

export const colors = {
  canvas: '#FFFFFF',
  canvasWarm: '#FBFAF7',
  ink: '#23304A',
  inkSoft: '#3D4A63',
  muted: '#9AA1AE',
  faint: '#C5CAD3',
  line: '#EEF0F3',
  sketch: '#ECEDEF',
  brand: '#14B8C4',
  brandSoft: '#DDF6F7',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  white: '#FFFFFF',
};

export const font = {
  bold: 'Nunito_700Bold',
  xbold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const radius = { card: 28, pill: 999, chip: 16 };

export const shadow = Platform.select({
  web: { boxShadow: '0px 6px 18px rgba(35,48,74,0.10)' } as object,
  default: {
    shadowColor: '#23304A',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
});

export const softShadow = Platform.select({
  web: { boxShadow: '0px 2px 10px rgba(35,48,74,0.06)' } as object,
  default: {
    shadowColor: '#23304A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
