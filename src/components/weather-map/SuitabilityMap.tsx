import { Fragment, useMemo, useRef, useState } from 'react';
import MapView, { Callout, Circle, Marker, Polygon, Polyline } from 'react-native-maps';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { MapViewport, SuitabilityCell } from '../../suitability';

export type HistoryPin = {
  latitude: number;
  longitude: number;
  name: string;
  probability: number;
  notes?: string;
};

export type Props = {
  mapRef: React.RefObject<MapView | null>;
  cells: SuitabilityCell[];
  location: { latitude: number; longitude: number } | null;
  historyPins?: HistoryPin[];
  isPremium?: boolean;
  tripPoints?: Array<{ latitude: number; longitude: number }>;
  livePeers?: Array<{ userId: string; label: string; points: Array<{ latitude: number; longitude: number }> }>;
  onRegionChange: (viewport: MapViewport) => void;
  onRegionChangeComplete: (viewport: MapViewport) => void;
  onMapLayout?: (size: { width: number; height: number }) => void;
  onMapReady?: () => void;
  canPlaceObservation?: boolean;
  onPlaceObservation?: (coordinate: { latitude: number; longitude: number }) => void;
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

const INITIAL_REGION: MapViewport = { latitude: 52.2297, longitude: 21.0122, latitudeDelta: 0.09, longitudeDelta: 0.09 };
const CLUSTER_FROM_DELTA = 0.03;

function clusterPaint(count: number) {
  if (count >= 15) return { backgroundColor: '#c4513a', borderColor: '#ffd0c6' };
  if (count >= 8) return { backgroundColor: '#d8882d', borderColor: '#ffe3bf' };
  if (count >= 4) return { backgroundColor: '#c9a227', borderColor: '#fff1c2' };
  return { backgroundColor: '#2f8f63', borderColor: '#dffced' };
}

function observationGroups(pins: HistoryPin[], region: MapViewport) {
  if (region.latitudeDelta <= CLUSTER_FROM_DELTA) {
    return pins.map((pin) => ({ kind: 'pin' as const, pin }));
  }
  const latitudeCell = region.latitudeDelta / 5;
  const longitudeCell = Math.max(region.longitudeDelta, 0.0001) / 5;
  const groups = new Map<string, HistoryPin[]>();
  for (const pin of pins) {
    const key = `${Math.floor(pin.latitude / latitudeCell)}:${Math.floor(pin.longitude / longitudeCell)}`;
    const group = groups.get(key);
    if (group) group.push(pin);
    else groups.set(key, [pin]);
  }
  return [...groups.entries()].map(([key, group]) => {
    if (group.length === 1) return { kind: 'pin' as const, pin: group[0] };
    const latitude = group.reduce((sum, pin) => sum + pin.latitude, 0) / group.length;
    const longitude = group.reduce((sum, pin) => sum + pin.longitude, 0) / group.length;
    const latitudeSpan = Math.max(...group.map((pin) => pin.latitude)) - Math.min(...group.map((pin) => pin.latitude));
    const longitudeSpan = Math.max(...group.map((pin) => pin.longitude)) - Math.min(...group.map((pin) => pin.longitude));
    return { kind: 'cluster' as const, key, count: group.length, latitude, longitude, latitudeSpan, longitudeSpan };
  });
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

export default function SuitabilityMap({ mapRef, cells, location, historyPins = [], isPremium = false, tripPoints = [], livePeers = [], onRegionChange, onRegionChangeComplete, onMapLayout, onMapReady, canPlaceObservation = false, onPlaceObservation }: Props) {
  const premiumHotspots = isPremium ? [...cells].sort((left, right) => right.score - left.score).slice(0, 3) : [];
  const draggedRef = useRef(false);
  const markerPressRef = useRef(false);
  const [region, setRegion] = useState<MapViewport>(INITIAL_REGION);
  const groups = useMemo(() => observationGroups(historyPins, region), [historyPins, region]);

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
        initialRegion={INITIAL_REGION}
        onMapReady={onMapReady}
        onPanDrag={() => {
          draggedRef.current = true;
        }}
        onPress={(event) => {
          if (markerPressRef.current) {
            markerPressRef.current = false;
            return;
          }
          if (draggedRef.current || !canPlaceObservation) return;
          onPlaceObservation?.(event.nativeEvent.coordinate);
        }}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={(next) => {
          setRegion(next);
          onRegionChangeComplete(next);
          setTimeout(() => {
            draggedRef.current = false;
          }, 250);
        }}
      >
        {tripPoints.length > 1 && (
          <Polyline coordinates={tripPoints} strokeColor="#f2cf58" strokeWidth={4} />
        )}
        {livePeers.map((peer) => {
          const latest = peer.points[peer.points.length - 1];
          if (!latest) return null;
          return (
            <Fragment key={peer.userId}>
              {peer.points.length > 1 && (
                <Polyline coordinates={peer.points} strokeColor="#7ec8ff" strokeWidth={4} />
              )}
              <Marker coordinate={latest} title={peer.label} description="Na wyprawie">
                <View style={styles.peerMarker}>
                  <Text style={styles.peerMarkerText}>{peer.label.slice(0, 1).toUpperCase()}</Text>
                </View>
              </Marker>
            </Fragment>
          );
        })}
        {cells.map((cell) => (
          <Polygon
            key={cell.id}
            coordinates={cellBoundary(cell)}
            fillColor={heatColor(cell.score)}
            strokeColor={Platform.OS === 'ios' ? 'transparent' : 'rgba(225, 244, 202, 0.4)'}
            strokeWidth={Platform.OS === 'ios' ? 0 : 1}
            tappable={false}
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
        {groups.map((group, index) => {
          if (group.kind === 'cluster') {
            const paint = clusterPaint(group.count);
            const size = 36 + Math.min(group.count, 12) * 2;
            return (
              <Marker
                key={`cluster-${group.key}`}
                coordinate={{ latitude: group.latitude, longitude: group.longitude }}
                onPress={() => {
                  markerPressRef.current = true;
                  mapRef.current?.animateToRegion({
                    latitude: group.latitude,
                    longitude: group.longitude,
                    latitudeDelta: Math.max(group.latitudeSpan * 1.8, 0.012),
                    longitudeDelta: Math.max(group.longitudeSpan * 1.8, 0.012),
                  }, 350);
                }}
              >
                <View style={[styles.cluster, paint, { width: size, height: size, borderRadius: size / 2 }]}>
                  <Text style={styles.clusterText}>{group.count > 99 ? '99+' : group.count}</Text>
                </View>
              </Marker>
            );
          }
          const pin = group.pin;
          return (
            <Marker
              key={`${pin.name}-${pin.latitude}-${pin.longitude}-${index}`}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              onPress={() => {
                markerPressRef.current = true;
              }}
            >
              <View style={styles.historyMarker}>
                <Text style={styles.historyMarkerText}>{pin.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              {isPremium ? (
                <Callout
                  onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}`)}
                >
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{pin.name}</Text>
                    <Text style={styles.calloutMeta}>{pin.probability > 0 ? `${pin.probability}% pewności` : 'Dodane z mapy'}</Text>
                    {pin.notes ? <Text style={styles.calloutNotes} numberOfLines={3}>{pin.notes}</Text> : null}
                    <Text style={styles.calloutLink}>Otwórz w Mapach Google</Text>
                  </View>
                </Callout>
              ) : null}
            </Marker>
          );
        })}
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
  cluster: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  clusterText: { color: '#f6fff9', fontWeight: '800', fontSize: 14 },
  callout: { width: 220, padding: 4 },
  calloutTitle: { color: '#173b2d', fontWeight: '800', fontSize: 15 },
  calloutMeta: { color: '#3d5c4e', marginTop: 2 },
  calloutNotes: { color: '#3d5c4e', marginTop: 4 },
  calloutLink: { color: '#1d6b45', fontWeight: '800', marginTop: 8 },
  peerMarker: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 16, backgroundColor: '#1d4e89', borderWidth: 2, borderColor: '#d7ecff', alignItems: 'center', justifyContent: 'center' },
  peerMarkerText: { color: '#f4f9ff', fontWeight: '800', fontSize: 13 },
  hotspotMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f2cf58', borderWidth: 2, borderColor: '#173b2d', alignItems: 'center', justifyContent: 'center' },
  hotspotMarkerText: { color: '#173b2d', fontSize: 14, fontWeight: '900' },
});
