function computeBBox(coords) {
  const lats = coords.map((c) => c[1]);
  const lons = coords.map((c) => c[0]);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lons),
    west: Math.min(...lons),
  };
}

function computeCentroid(bbox) {
  return {
    lat: (bbox.north + bbox.south) / 2,
    lon: (bbox.east + bbox.west) / 2,
  };
}
async function reverseGeocode({ lat, lon }) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "geojson-locator" },
  });
  const data = await res.json();

  console.log("=====================");
  console.log(data.address);
  console.log("=====================");
  return data.address || null;
}

async function getLocation(geometry) {
  const { type, coordinates } = geometry;
  let flatCoords = [];

  if (type === "Point") {
    flatCoords = [coordinates];
  } else if (type === "LineString") {
    flatCoords = coordinates;
  } else if (type === "Polygon") {
    flatCoords = coordinates[0];
  } else if (type === "MultiLineString") {
    flatCoords = coordinates.flat(1);
  } else if (type === "MultiPolygon") {
    flatCoords = coordinates.flat(2);
  }
  const bbox = computeBBox(flatCoords);
  const centroid = computeCentroid(bbox);
  const loc = await reverseGeocode(centroid);
  return loc;
}

export async function getOneLoc(layers) {
  let loc = null;
  for (const layer of layers) {
    for (const feature of layer.features) {
      loc = await getLocation(feature.geometry);
      console.log(loc);
      if (loc !== null) return loc;
    }
  }
}
