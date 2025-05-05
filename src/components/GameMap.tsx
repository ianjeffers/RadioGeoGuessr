// components/GameMap.tsx
'use client';

import React from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import type { LatLngLiteral } from 'leaflet';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

type Props = {
  guess: LatLngLiteral | null;
  actual: LatLngLiteral | null;
  onGuess: (latlng: LatLngLiteral) => void;
};

function ClickHandler({ onGuess }: { onGuess: (latlng: LatLngLiteral) => void }) {
  useMapEvents({
    click(e) {
      onGuess(e.latlng);
    },
  });
  return null;
}

export default function GameMap({ guess, actual, onGuess }: Props) {
  return (
    <MapContainer center={[37.5, -95]} zoom={3} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <ClickHandler onGuess={onGuess} />
      {guess && <Marker position={guess} />}
      {guess && actual && (
        <>
          <Marker position={actual} />
          <Polyline positions={[guess, actual]} />
        </>
      )}
    </MapContainer>
  );
}
