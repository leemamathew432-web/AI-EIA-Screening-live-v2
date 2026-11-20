import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import {
  BRAHMAPURAM_SOURCE,
  KADAMBAYAR_RIVER_POLYLINE,
  RIVER_ENTRY_NODE_INDEX,
  SITE_BOUNDARY_POLYGON,
  STUDY_RADIUS_METERS,
  destinationPoint,
} from '../data/receptors';
import type { PlumeSimulationResult } from '../physics/plume';

interface PlumeMapProps {
  plume: PlumeSimulationResult;
  heightClass?: string;
}

export function PlumeMap({ plume, heightClass = 'h-[430px]' }: PlumeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayersRef = useRef<{
    satellite: L.TileLayer;
    labels: L.TileLayer;
    osm: L.TileLayer;
  } | null>(null);
  const dynamicGroupRef = useRef<L.LayerGroup | null>(null);
  const particleGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapMode, setMapMode] = useState<'satellite-labels' | 'osm'>('satellite-labels');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [9.992, 76.362],
      zoom: 12.5,
      zoomControl: true,
    });

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri World Imagery', maxZoom: 18 }
    );
    const labels = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap / CARTO labels', maxZoom: 18 }
    );
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    });

    satellite.addTo(map);
    labels.addTo(map);
    baseLayersRef.current = { satellite, labels, osm };

    dynamicGroupRef.current = L.layerGroup().addTo(map);
    particleGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = baseLayersRef.current;
    if (!map || !layers) return;

    if (mapMode === 'satellite-labels') {
      if (map.hasLayer(layers.osm)) map.removeLayer(layers.osm);
      if (!map.hasLayer(layers.satellite)) layers.satellite.addTo(map);
      if (!map.hasLayer(layers.labels)) layers.labels.addTo(map);
      layers.satellite.bringToBack();
    } else {
      if (map.hasLayer(layers.satellite)) map.removeLayer(layers.satellite);
      if (map.hasLayer(layers.labels)) map.removeLayer(layers.labels);
      if (!map.hasLayer(layers.osm)) layers.osm.addTo(map);
      layers.osm.bringToBack();
    }
  }, [mapMode]);

  // Draw static/dynamic GIS layers
  useEffect(() => {
    const group = dynamicGroupRef.current;
    if (!group) return;
    group.clearLayers();

    // 5 km study radius geofence
    L.circle([BRAHMAPURAM_SOURCE.lat, BRAHMAPURAM_SOURCE.lon], {
      radius: STUDY_RADIUS_METERS,
      color: '#2dd4bf',
      weight: 1.2,
      dashArray: '6 6',
      fillOpacity: 0.02,
    }).addTo(group);

    // Brahmapuram dumpsite polygon
    L.polygon(SITE_BOUNDARY_POLYGON, {
      color: '#f59e0b',
      weight: 2,
      fillColor: '#f59e0b',
      fillOpacity: 0.3,
    })
      .bindPopup(
        `<div class="text-xs"><strong>Brahmapuram Solid Waste Dumpsite</strong><br/>9.9880° N, 76.3680° E (~110 acres)<br/>Stability Class ${plume.stabilityClass} (${plume.stabilityDescription})</div>`
      )
      .addTo(group);

    // Kadambrayar River polyline
    L.polyline(KADAMBAYAR_RIVER_POLYLINE, {
      color: '#38bdf8',
      weight: 3.5,
      opacity: 0.85,
    })
      .bindPopup(
        `<div class="text-xs"><strong>Kadambrayar River</strong><br/>Upstream Manakkakadavu → Brahmapuram Leachate Entry → Ambalamugal</div>`
      )
      .addTo(group);

    // Leachate entry node marker
    const entry = KADAMBAYAR_RIVER_POLYLINE[RIVER_ENTRY_NODE_INDEX];
    L.circleMarker(entry, {
      radius: 5,
      color: '#38bdf8',
      fillColor: '#0284c7',
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindPopup(`<div class="text-xs"><strong>Brahmapuram Leachate Entry Node</strong></div>`)
      .addTo(group);

    // Translucent outer cone (±35° scaled)
    L.polygon(plume.outerConePolygon, {
      color: '#f59e0b',
      weight: 1,
      dashArray: '4 4',
      fillColor: '#f59e0b',
      fillOpacity: 0.14,
    }).addTo(group);

    // Translucent core cone (±15° default)
    L.polygon(plume.coreConePolygon, {
      color: '#f43f5e',
      weight: 1.6,
      fillColor: '#f43f5e',
      fillOpacity: 0.24,
    }).addTo(group);

    // Colour-coded receptor markers (red = Direct Downwind, amber = Crosswind Edge, green = Upwind/Clear)
    plume.receptors.forEach((item) => {
      const color =
        item.status === 'DIRECT DOWNWIND'
          ? '#f43f5e'
          : item.status === 'CROSSWIND EDGE'
          ? '#f59e0b'
          : '#10b981';

      L.circleMarker([item.receptor.lat, item.receptor.lon], {
        radius: 7.5,
        color,
        fillColor: color,
        fillOpacity: 0.88,
        weight: 2,
      })
        .bindPopup(
          `<div class="text-xs leading-relaxed">
            <strong>${item.receptor.name}</strong><br/>
            Type: ${item.receptor.category}<br/>
            Status: <strong>${item.status}</strong><br/>
            Distance: ${item.distanceKm} km (${item.distanceMeters} m)<br/>
            Bearing: ${item.bearingDeg}° · Offset: ${item.angularOffsetDeg}°<br/>
            Advection ETA: ${item.advectionEtaMin !== null ? `${item.advectionEtaMin} min` : 'N/A'}<br/>
            Rel. Conc (% of 500m): ${item.relativeConcPctOf500m}%
          </div>`
        )
        .addTo(group);
    });
  }, [plume]);

  // Animated downwind plume particles
  useEffect(() => {
    const pGroup = particleGroupRef.current;
    if (!pGroup) return;

    const particles = Array.from({ length: 18 }, (_, idx) => ({
      progress: (idx % 6) / 6,
      lateralRatio: ((idx % 5) - 2) * 0.38,
      speed: 0.015 + (idx % 3) * 0.005,
    }));

    const interval = window.setInterval(() => {
      pGroup.clearLayers();
      for (const p of particles) {
        p.progress = (p.progress + p.speed * Math.max(0.6, plume.windSpeedMs / 3)) % 1;
        const distKm = 0.25 + p.progress * 4.7;
        const angle = plume.downwindBearingDeg + p.lateralRatio * plume.halfConeDeg;
        const pt = destinationPoint(
          BRAHMAPURAM_SOURCE.lat,
          BRAHMAPURAM_SOURCE.lon,
          (angle + 360) % 360,
          distKm
        );
        L.circleMarker(pt, {
          radius: 2.5,
          color: '#fb7185',
          fillColor: '#fda4af',
          fillOpacity: Math.max(0.15, 0.85 - p.progress * 0.7),
          weight: 0,
        }).addTo(pGroup);
      }
    }, 180);

    return () => window.clearInterval(interval);
  }, [plume.downwindBearingDeg, plume.halfConeDeg, plume.windSpeedMs]);

  return (
    <div className="overflow-hidden rounded-xl border border-teal-800/70 bg-[#063836]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-800/70 bg-[#032423] px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3 font-mono text-teal-200">
          <span>
            Downwind: {plume.downwindBearingDeg}° ({plume.downwindCompass})
          </span>
          <span aria-hidden="true" className="text-teal-700">·</span>
          <span>
            Core ±{plume.halfConeDeg}° / Outer ±{Math.min(45, Math.round(plume.halfConeDeg * (35 / 15)))}°
          </span>
          <span aria-hidden="true" className="text-teal-700">·</span>
          <span>Stability Class {plume.stabilityClass}</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-teal-800 bg-[#042f2e] p-0.5">
          <button
            type="button"
            onClick={() => setMapMode('satellite-labels')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
              mapMode === 'satellite-labels'
                ? 'bg-teal-400/20 text-teal-200'
                : 'text-teal-100/70 hover:text-white'
            }`}
          >
            Satellite + Labels
          </button>
          <button
            type="button"
            onClick={() => setMapMode('osm')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
              mapMode === 'osm'
                ? 'bg-teal-400/20 text-teal-200'
                : 'text-teal-100/70 hover:text-white'
            }`}
          >
            Road Map
          </button>
        </div>
      </div>

      <div ref={containerRef} className={`w-full ${heightClass} z-10`} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-800/70 bg-[#032423] px-4 py-2 text-xs text-teal-100/80">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Direct Downwind
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Crosswind Edge
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Upwind / Clear
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
            Kadambrayar River
          </span>
        </div>
        <span className="font-mono text-teal-300">5 km Study Geofence</span>
      </div>
    </div>
  );
}
