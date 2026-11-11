Rol: Eres un desarrollador Senior en Next.js, React, TypeScript y GIS (Sistemas de Información Geográfica).

Objetivo: Construir un prototipo en una sola página (page.tsx) que renderice un mapa con react-map-gl y trace una ruta interactiva usando el algoritmo 
A 
∗
 .

Stack Tecnológico:
Usa Next.js (App Router), react-map-gl, mapbox-gl y componentes de Shadcn UI (Card, Alert) para los paneles de interfaz.

Requisitos de Datos (Mock GeoJSON Estricto):
No uses APIs externas. Al montar el componente, genera programáticamente una cuadrícula de 20x20 puntos. Cada punto DEBE respetar exactamente esta estructura GeoJSON:

JSON
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [longitud, latitud]
  },
  "properties": {
    "nodeId": "x-y",
    "elevation": number, // Aleatorio 0-500
    "radiationLevel": number, // Aleatorio 0-10
    "hazardType": string // "None", "Cráter", "Radiación"
  }
}
Fuerza lógicamente a que un bloque central de puntos tenga elevation > 400 y hazardType: "Cráter" para crear un obstáculo sólido.

Requisitos Visuales:

Usa un mapa oscuro base de Mapbox.

Pinta los puntos generados en el mapa con colores cálidos basados en su propiedad elevation.

El usuario puede hacer clic para definir un punto de Origen (marcador azul) y luego un Destino (marcador verde).

Al calcular la ruta, dibújala como un LineString GeoJSON continuo sobre el mapa.

Panel Shadcn: Muestra un panel flotante superior (Card de Shadcn) que indique la distancia estimada de la ruta calculada. Lee las propiedades hazardType de los nodos peligrosos que el algoritmo esquivó y lístalos como "Peligros evitados".

Algoritmo 
A 
∗
  (Pathfinding):

Aisla la función 
A 
∗
  estrictamente fuera del componente visual de React para evitar re-renderizados.

Costo 
g(n): El costo entre dos nodos es 1 + (diferencia_de_elevación * 2) + (radiationLevel * 5). Si la diferencia de elevación entre nodos es > 100, el costo es Infinity (bloqueo total).

Heurística 
h(n): Usa la distancia Manhattan simple.

El algoritmo debe recibir la FeatureCollection de puntos, el origen y el destino, y retornar el array de coordenadas finales.

Entrégame el código completo del archivo page.tsx asumiendo que ya tengo configurado Tailwind y Shadcn UI. Indica brevemente dónde debe ir el token de Mapbox.

