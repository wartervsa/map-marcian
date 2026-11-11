"use client";

import { useEffect, useMemo, useState } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapMouseEvent } from "react-map-gl/mapbox";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import "mapbox-gl/dist/mapbox-gl.css";

type Coordinates = [number, number];
type NodeProperties = {
  nodeId: string;
  elevation: number;
  radiationLevel: number;
  hazardType: "None" | "Cráter" | "Radiación";
};
type GridNode = Feature<Point, NodeProperties>;
type Grid = FeatureCollection<Point, NodeProperties>;
const SIZE = 20;
const STEP = 0.002;
const CENTER: Coordinates = [-68.15, -16.5];
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export function generateGrid(): Grid {
  return {
    type: "FeatureCollection",
    features: Array.from({ length: SIZE * SIZE }, (_, index) => {
      const x = index % SIZE;
      const y = Math.floor(index / SIZE);
      const crater = x >= 8 && x <= 11 && y >= 6 && y <= 13;
      const radiationLevel = Math.random() * 10;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [CENTER[0] + (x - 9.5) * STEP, CENTER[1] + (y - 9.5) * STEP] },
        properties: {
          nodeId: `${x}-${y}`,
          // Correlated terrain keeps the random grid traversable. The central
          // crater always differs by >100 m from every surrounding point.
          elevation: crater ? 401 + Math.random() * 99 : 140 + x * 3 + y * 2 + Math.random() * 35,
          radiationLevel,
          hazardType: crater ? "Cráter" : radiationLevel >= 7 ? "Radiación" : "None",
        },
      };
    }),
  };
}

function manhattan(a: string, b: string): number {
  const [ax, ay] = a.split("-").map(Number);
  const [bx, by] = b.split("-").map(Number);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function neighbors(node: GridNode, nodes: globalThis.Map<string, GridNode>): GridNode[] {
  const [x, y] = node.properties.nodeId.split("-").map(Number);
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .map(([nx, ny]) => nodes.get(`${nx}-${ny}`))
    .filter((candidate): candidate is GridNode => Boolean(candidate));
}

// Independent of React: returns [] when either endpoint is missing or unreachable.
export function aStar(grid: Grid, origin: string, destination: string): Coordinates[] {
  const nodes = new globalThis.Map(grid.features.map((node) => [node.properties.nodeId, node]));
  if (!nodes.has(origin) || !nodes.has(destination)) return [];
  const open = new Set([origin]);
  const previous = new globalThis.Map<string, string>();
  const costs = new globalThis.Map<string, number>([[origin, 0]]);
  const scores = new globalThis.Map<string, number>([[origin, manhattan(origin, destination)]]);

  while (open.size) {
    const current = [...open].reduce((best, id) => (scores.get(id) ?? Infinity) < (scores.get(best) ?? Infinity) ? id : best);
    if (current === destination) {
      const route: Coordinates[] = [];
      let cursor: string | undefined = current;
      while (cursor !== undefined) {
        route.push(nodes.get(cursor)!.geometry.coordinates as Coordinates);
        cursor = previous.get(cursor);
      }
      return route.reverse();
    }
    open.delete(current);
    const node = nodes.get(current)!;
    for (const neighbor of neighbors(node, nodes)) {
      const difference = Math.abs(node.properties.elevation - neighbor.properties.elevation);
      const edgeCost = difference > 100 ? Infinity : 1 + difference * 2 + neighbor.properties.radiationLevel * 5;
      const tentative = costs.get(current)! + edgeCost;
      const id = neighbor.properties.nodeId;
      if (tentative < (costs.get(id) ?? Infinity)) {
        previous.set(id, current);
        costs.set(id, tentative);
        scores.set(id, tentative + manhattan(id, destination));
        open.add(id);
      }
    }
  }
  return [];
}

function distanceKm(route: Coordinates[]): number {
  const rad = Math.PI / 180;
  return route.slice(1).reduce((total, point, index) => {
    const previous = route[index];
    const a = Math.sin((point[1] - previous[1]) * rad / 2) ** 2 +
      Math.cos(previous[1] * rad) * Math.cos(point[1] * rad) * Math.sin((point[0] - previous[0]) * rad / 2) ** 2;
    return total + 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  }, 0);
}

export default function Home() {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [origin, setOrigin] = useState<GridNode | null>(null);
  const [destination, setDestination] = useState<GridNode | null>(null);
  const [mapError, setMapError] = useState("");
  useEffect(() => {
    // Generate only in the browser, after mounting; avoid random SSR markup.
    const timer = window.setTimeout(() => setGrid(generateGrid()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const route = useMemo(() => grid && origin && destination ? aStar(grid, origin.properties.nodeId, destination.properties.nodeId) : [], [grid, origin, destination]);
  const line = useMemo<Feature<LineString>>(() => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }), [route]);
  const avoided = useMemo(() => {
    if (!grid || route.length < 2) return [];
    const visited = new Set(route.map((coordinate) => coordinate.join(",")));
    const nodes = new globalThis.Map(grid.features.map((node) => [node.properties.nodeId, node]));
    // Only report actual hazards bordering the final route, never all hazards
    // in the grid. Radiation is penalized, not an absolute obstacle.
    const nearby = new globalThis.Map<string, GridNode>();
    for (const node of grid.features.filter((node) => visited.has(node.geometry.coordinates.join(",")))) {
      for (const neighbor of neighbors(node, nodes)) {
        if (neighbor.properties.hazardType !== "None" && !visited.has(neighbor.geometry.coordinates.join(","))) nearby.set(neighbor.properties.nodeId, neighbor);
      }
    }
    return [...nearby.values()];
  }, [grid, route]);

  function selectNode(event: MapMouseEvent) {
    const id = event.features?.find((feature) => feature.layer?.id === "terrain-points")?.properties?.nodeId;
    const node = grid?.features.find((candidate) => candidate.properties.nodeId === id);
    if (!node) return;
    if (!origin || destination) {
      setOrigin(node);
      setDestination(null);
    } else setDestination(node);
  }

  return (
    <main className="dark relative h-dvh min-h-[640px] overflow-hidden bg-[#101419] text-slate-100">
      {TOKEN ? <Map
        mapboxAccessToken={TOKEN}
        initialViewState={{ longitude: CENTER[0], latitude: CENTER[1], zoom: 13.4 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={grid ? ["terrain-points"] : []}
        onClick={selectNode}
        onError={(event) => setMapError(event.error.message)}
        cursor="crosshair"
      >
        <NavigationControl position="bottom-right" />
        {grid && <Source id="terrain" type="geojson" data={grid}>
          <Layer id="terrain-points" type="circle" paint={{
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 7],
            "circle-color": ["interpolate", ["linear"], ["get", "elevation"], 0, "#fef3c7", 200, "#fbbf24", 350, "#f97316", 500, "#b91c1c"],
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#271d16",
          }} />
        </Source>}
        {route.length >= 2 && <Source id="route" type="geojson" data={line}>
          <Layer id="route-line" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": "#67e8f9", "line-width": 4 }} />
        </Source>}
        {[{ node: origin, color: "#3b82f6", label: "Origen" }, { node: destination, color: "#22c55e", label: "Destino" }].map(({ node, color, label }) => node && <Marker key={label} longitude={node.geometry.coordinates[0]} latitude={node.geometry.coordinates[1]} anchor="center">
          <span title={`${label}: ${node.properties.nodeId}`} aria-label={`${label}: ${node.properties.nodeId}`} style={{ backgroundColor: color }} className="block size-5 rounded-full border-2 border-white shadow-lg" />
        </Marker>)}
      </Map> : <div className="absolute inset-0 grid place-items-center px-6 text-center text-slate-400">Configura el token de Mapbox para visualizar el mapa.</div>}

      <Card className="absolute top-4 left-4 z-10 max-h-[calc(100dvh-8rem)] w-[calc(100%-2rem)] overflow-y-auto border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-md sm:w-96">
        <CardHeader>
          <p className="text-xs font-medium tracking-[0.25em] text-orange-400">EXPLORACIÓN · A*</p>
          <CardTitle className="text-2xl">Planificador de rutas</CardTitle>
          <p className="text-sm text-slate-400">Cuadrícula simulada de 20 × 20 nodos. Selecciona un punto de origen y después un destino.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white/5 p-3"><span className="text-blue-400">● Origen</span><p className="mt-1 font-mono">{origin?.properties.nodeId ?? "Por seleccionar"}</p></div>
            <div className="rounded-lg bg-white/5 p-3"><span className="text-green-400">● Destino</span><p className="mt-1 font-mono">{destination?.properties.nodeId ?? "Por seleccionar"}</p></div>
          </div>
          <div aria-live="polite">
            <p className="text-xs uppercase tracking-widest text-slate-400">Distancia estimada</p>
            <p className="mt-1 text-3xl font-semibold">{route.length ? `${distanceKm(route).toFixed(2)} km` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">{route.length ? `${route.length} nodos · distancia geográfica terrestre` : "Haz clic sobre los puntos del mapa."}</p>
          </div>
          {origin && destination && !route.length && <Alert className="border-orange-500/30 text-orange-200"><AlertTitle>Sin ruta disponible</AlertTitle><AlertDescription>El desnivel supera 100 m en los accesos. Selecciona otros puntos o reinicia.</AlertDescription></Alert>}
          {route.length > 0 && <Alert className="border-cyan-500/20 bg-cyan-500/5"><AlertTitle>Peligros evitados</AlertTitle><AlertDescription>
            <p className="mb-2 text-xs text-slate-400">Nodos peligrosos adyacentes a la ruta que no se recorrieron. La radiación aumenta el costo, pero puede atravesarse.</p>
            {avoided.length ? <ul className="max-h-28 space-y-1 overflow-y-auto">{avoided.map((node) => <li key={node.properties.nodeId}>{node.properties.hazardType} · nodo {node.properties.nodeId}</li>)}</ul> : <p>No hay peligros adyacentes evitados.</p>}
          </AlertDescription></Alert>}
          {(!TOKEN || mapError) && <Alert className="border-orange-500/30 text-orange-200"><AlertTitle>{TOKEN ? "No se pudo cargar el mapa" : "Falta el token de Mapbox"}</AlertTitle><AlertDescription>{TOKEN ? mapError : "Añade NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN en .env.local y reinicia el servidor."}</AlertDescription></Alert>}
          <Button variant="outline" className="w-full" disabled={!origin} onClick={() => { setOrigin(null); setDestination(null); }}>Reiniciar selección</Button>
        </CardContent>
      </Card>
      <div className="pointer-events-none absolute bottom-8 left-4 rounded-lg border border-white/10 bg-slate-950/90 p-3 text-xs shadow-lg">
        <p className="mb-2 text-slate-300">Elevación del terreno · 0–500 m</p>
        <div className="h-1.5 w-48 rounded-full bg-gradient-to-r from-amber-100 via-orange-400 to-red-800" />
        <p className="mt-2 text-slate-400">Bloque central: cráter infranqueable</p>
      </div>
    </main>
  );
}
