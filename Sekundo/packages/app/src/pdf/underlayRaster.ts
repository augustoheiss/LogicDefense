import { Platform } from 'react-native';
import {
  rasterizeUnderlayPage as rasterWeb,
  clearUnderlayRasterCache as clearWeb,
} from './underlayRaster.web';
import {
  rasterizeUnderlayPage as rasterNative,
  clearUnderlayRasterCache as clearNative,
} from './underlayRaster.native';

export const rasterizeUnderlayPage =
  Platform.OS === 'web' ? rasterWeb : rasterNative;

export const clearUnderlayRasterCache =
  Platform.OS === 'web' ? clearWeb : clearNative;
