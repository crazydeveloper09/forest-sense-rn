import { Fragment } from 'react';
import MapView, { Circle, Marker, Polygon } from 'react-native-maps';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { MapViewport, SuitabilityCell } from '../../suitability';

export type HistoryPin = {
  latitude: number;
  longitude: number;
  name: string;
  probability: number;
};

export type Props = {
  mapRef: React.RefObject<MapView | null>;
  cells: SuitabilityCell[];
  location: { latitude: number; longitude: number } | null;
  historyPins?: HistoryPin[];
  isPremium?: boolean;
  onRegionChange: (viewport: MapViewport) => void;
  onRegionChangeComplete: (viewport: MapViewport) => void;
  onMapLayout?: (size: { width: number; height: number }) => void;
  onMapReady?: () => void;
};

export function heatColor(score: number) {
  if (score >= 70) return 'rgba(92, 205, 123, 0.42)';
  if (score >= 45) return 'rgba(193, 218, 94, 0.38)';
  return 'rgba(239, 120, 82, 0.38)';
}

function cellBoundary(cell: SuitabilityCell) {
  if (Platform.OS !== 'ios') return cell.boundary;
  const center = getCellCenter(cell);
  const bleed = 1.04;
  return cell.boundary.map((point) => ({
    latitude: center.latitude + (point.latitude - center.latitude) * bleed,
    longitude: center.longitude + (point.longitude - center.longitude) * bleed,
  }));
}

function getCellCenter(cell: SuitabilityCell) {
  const points = cell.boundary;
  const total = points.reduce(
    (accumulator, point) => ({
      latitude: accumulator.latitude + point.latitude,
      longitude: accumulator.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / points.length,
    longitude: total.longitude / points.length,
  };
}

export default function SuitabilityMap({ mapRef, cells, location, historyPins = [], isPremium = false, onRegionChange, onRegionChangeComplete, onMapLayout, onMapReady }: Props) {
  const premiumHotspots = isPremium ? [...cells].sort((left, right) => right.score - left.score).slice(0, 3) : [];

  return (
    <View
      style={styles.container}
      collapsable={false}
      onLayout={(event) => onMapLayout?.({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        loadingBackgroundColor="#143028"
        initialRegion={{ latitude: 52.2297, longitude: 21.0122, latitudeDelta: 0.09, longitudeDelta: 0.09 }}
        onMapReady={onMapReady}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {cells.map((cell) => (
          <Polygon
            key={cell.id}
            coordinates={cellBoundary(cell)}
            fillColor={heatColor(cell.score)}
            strokeColor={Platform.OS === 'ios' ? 'transparent' : 'rgba(225, 244, 202, 0.4)'}
            strokeWidth={Platform.OS === 'ios' ? 0 : 1}
          />
        ))}
        {premiumHotspots.map((cell, index) => {
          const center = getCellCenter(cell);
          return (
            <Fragment key={`premium-${cell.id}`}>
              <Circle
                center={center}
                radius={220}
                strokeColor="rgba(174, 240, 160, 0.95)"
                strokeWidth={2}
                fillColor={cell.score >= 70 ? 'rgba(92, 205, 123, 0.12)' : 'rgba(193, 218, 94, 0.10)'}
              />
              <Marker coordinate={center} title={`Najlepsza strefa ${index + 1}`} description={`Ocena warunków: ${Math.round(cell.score)}%`}>
                <View style={styles.hotspotMarker}>
                  <Text style={styles.hotspotMarkerText}>{index + 1}</Text>
                </View>
              </Marker>
            </Fragment>
          );
        })}
        {historyPins.map((pin, index) => (
          <Marker
            key={`${pin.name}-${pin.latitude}-${pin.longitude}-${index}`}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.name}
            description={`${pin.probability}%`}
          >
            <View style={styles.historyMarker}>
              <Text style={styles.historyMarkerText}>{pin.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          </Marker>
        ))}
        {location && (
          <Marker coordinate={location} title="Twoja lokalizacja">
            <View style={styles.marker}><Text style={styles.markerText}>Ty</Text></View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#143028' },
  map: StyleSheet.absoluteFill,
  marker: { width: 40, height: 40, borderRadius: 999, backgroundColor: '#f1f8ee', borderWidth: 2, borderColor: '#1e4c3d', alignItems: 'center', justifyContent: 'center' },
  markerText: { color: '#173b2d', fontWeight: '800', fontSize: 12 },
  historyMarker: { width: 28, height: 28, borderRadius: 999, backgroundColor: '#2d8d62', borderWidth: 2, borderColor: '#dffced', alignItems: 'center', justifyContent: 'center' },
  historyMarkerText: { color: '#f6fff9', fontWeight: '800', fontSize: 12 },
  hotspotMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f2cf58', borderWidth: 2, borderColor: '#173b2d', alignItems: 'center', justifyContent: 'center' },
  hotspotMarkerText: { color: '#173b2d', fontSize: 14, fontWeight: '900' },
});
