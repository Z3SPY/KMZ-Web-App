import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Feature, FeatureCollection, LineString } from "geojson";

import axios from "axios";
import React from "react";
import Floating from "../Component/Floating";

type MyProps = {
  Name: string;
  tessellate: number;
  extrude: number;
  visibility: number;
};

async function ExtractAllKMZFeatures() {
  return axios
    .get(`http://localhost:3000/list`)
    .then((res) => {
      console.log(res.data);
      return res.data;
    })
    .catch((e) => {
      console.log(`Failed Call Returns: ${e}`);
      throw e;
    });
}

export default function Map() {
  type LeafletGeoJSON = ReturnType<typeof L.geoJSON>;
  const elRef = useRef(null);
  const mapRef = useRef<any | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  /* Extracted Features */
  const [extractedFeatures, setExtractedFeatures] = useState<
    Feature<LineString, MyProps>[] | null
  >(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { center: [0, 0], zoom: 2 });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function handleGeoJSON(fc: FeatureCollection<LineString, MyProps>) {
    const map = mapRef.current!;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const style = { color: "#ff7800", weight: 4, opacity: 0.8 };
    const layer = L.geoJSON(fc as any, {
      style,
      onEachFeature: (f, lyr) => {
        if (f.properties?.Name) lyr.bindPopup(String(f.properties.Name));
      },
    }).addTo(map);

    layerRef.current = layer;

    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
  }

  return (
    <>
      <Floating handleGeoJSON={handleGeoJSON} />
      <div ref={elRef} style={{ height: "100vh", width: "100vw" }} />
    </>
  );
}
