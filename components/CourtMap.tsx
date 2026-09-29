"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Court } from "@/lib/courts";
import { gcj02ToWgs84, wgs84ToGcj02 } from "@/lib/coordinates";

type Props = {
  center: [number, number];
  courts: Court[];
  selectedCourtId: number | null;
  draftPosition: [number, number] | null;
  markingMode: boolean;
  onMapClick: (position: { lat: number; lng: number }) => void;
  onSelectCourt: (courtId: number) => void;
};

function MapClickHandler({ onClick }: { onClick: Props["onMapClick"] }) {
  useMapEvents({
    click: (event) => {
      const [latitude, longitude] = gcj02ToWgs84(event.latlng.lat, event.latlng.lng);
      onClick({ lat: latitude, lng: longitude });
    },
  });
  return null;
}

function MapCenterController({ center }: { center: Props["center"] }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(wgs84ToGcj02(center[0], center[1]), 15);
  }, [center, map]);

  return null;
}

export default function CourtMap({
  center,
  courts,
  selectedCourtId,
  draftPosition,
  markingMode,
  onMapClick,
  onSelectCourt,
}: Props) {
  const courtMarkers = useMemo(
    () =>
      courts.map((court) => ({
        court,
        icon: L.divIcon({
          className: `court-marker ${selectedCourtId === court.id ? "selected" : ""}`,
          html: `<span>🏀</span>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      })),
    [courts, selectedCourtId],
  );

  return (
    <MapContainer
      center={wgs84ToGcj02(center[0], center[1])}
      zoom={15}
      scrollWheelZoom
      className={`map-canvas ${markingMode ? "marking" : ""}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.amap.com/">高德地图</a>'
        url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
        subdomains={["1", "2", "3", "4"]}
      />
      <MapClickHandler onClick={onMapClick} />
      <MapCenterController center={center} />
      <Circle center={wgs84ToGcj02(center[0], center[1])} radius={3000} pathOptions={{ color: "#16a34a", weight: 1, fillOpacity: 0.04 }} />

      {courtMarkers.map(({ court, icon }) => (
        <Marker
          key={court.id}
          position={wgs84ToGcj02(court.latitude, court.longitude)}
          icon={icon}
          eventHandlers={{ click: () => onSelectCourt(court.id) }}
        >
          <Popup>{court.name}</Popup>
        </Marker>
      ))}

      {draftPosition && (
        <CircleMarker
          center={wgs84ToGcj02(draftPosition[0], draftPosition[1])}
          radius={10}
          pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.9 }}
        />
      )}
    </MapContainer>
  );
}
