/**
 * Component: TerritoryLeafletMap (Native Mobile — Android & iOS)
 *
 * Re-exports TerritoryNativeMap so Metro resolves it automatically on Android/iOS
 * while also allowing Web builds (`TerritoryLeafletMap.web.tsx`) to render the exact
 * native mobile cartographic engine when `?nativeMap=1` is requested.
 */

export { TerritoryNativeMap as TerritoryLeafletMap } from './TerritoryNativeMap';
