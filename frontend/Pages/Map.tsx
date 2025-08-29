import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Feature, FeatureCollection, LineString, Geometry  } from "geojson";

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

    const bounds = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

    const map = L.map(
      elRef.current, 
      { center: [0, 0], 
        zoom: 2,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0, 
        worldCopyJump: true, 
      },);
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
    console.log(`FC: `, fc);

    if (!map || !fc || !Array.isArray(fc.features)) return;
    map.invalidateSize();


    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const style = { color: "#ff7800", weight: 4, opacity: 0.8 };

    const layer = L.geoJSON(fc as any, {
      style: style,

      // Circle Markers
      pointToLayer: (_feature, latlng) => 
      L.circleMarker(latlng, { 
        radius: 6 ,
        color: style.color,
        weight: 2,
        fillOpacity: 0.7
      }),
      
      // Skip Empty Geometries 
      filter: (f) => !!f?.geometry,
      onEachFeature: (f, lyr) => {
        const name = f?.properties?.Name ?? f?.properties?.name;
        if (name) lyr.bindPopup(String(name));
      },
    }).addTo(map);

    layerRef.current = layer;

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [20, 20], maxZoom: 17, animate: true });
    } else {
      console.log(`Invalid Bounds: ${bounds}`);
      //map.setView([0, 0], 2);
    }
  }

  return (
    <>
      <Floating handleGeoJSON={handleGeoJSON} />
      <div ref={elRef} style={{ height: "100vh", width: "100vw" }} />
    </>
  );
}
