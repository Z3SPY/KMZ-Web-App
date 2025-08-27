import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, LineString } from "geojson";

import axios from "axios";
import React from "react";

/*const linesFC = [
    {"type":"Feature","properties":{"Name":"Path Measure","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29421684929999,21.37893114395834,0],[39.29525057209879,21.37834781746814,0]]}},
    {"type":"Feature","properties":{"Name":"Path Measure","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29366240249556,21.37831751757152,0],[39.29399883441911,21.37889056255904,0]]}},
    {"type":"Feature","properties":{"Name":"Path Measure","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29355897007441,21.37837911960291,0],[39.29395595774383,21.37901184047029,0]]}},
    {"type":"Feature","properties":{"Name":"4-2","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29434554227358,21.38052872364472,0],[39.29314308930748,21.37860344762833,0],[39.29452843915922,21.37782811074431,0]]}},
    {"type":"Feature","properties":{"Name":"قياس المسار","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29555326072215,21.38013888500975,0],[39.29466678102718,21.37876192982188,0]]}},
    {"type":"Feature","properties":{"Name":"قياس المسار","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29362294902697,21.37934413138801,0],[39.29527657500274,21.37844053017304,0]]}},
    {"type":"Feature","properties":{"Name":"قياس المسار","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29544968594126,21.3799848886787,0],[39.29438907999589,21.38056101818589,0]]}},
    {"type":"Feature","properties":{"Name":"قياس المسار","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29480140444539,21.38004362753877,0],[39.29399484648132,21.37889955620059,0]]}},
    {"type":"Feature","properties":{"Name":"قياس المسار","tessellate":1,"extrude":0,"visibility":-1},
     "geometry":{"type":"LineString","coordinates":[[39.29470160789991,21.38017988003348,0],[39.29405245998554,21.37910965262494,0]]}}
  ];*/

type MyProps = {
  Name: string;
  tessellate: number;
  extrude: number;
  visibility: number;
};


async function ExtractAllKMZFeatures() {
    return axios.get(`http://localhost:3000/list`)
    .then(res => {
      console.log(res.data);
      return res.data;
    })
    .catch(e => {
      console.log(`Failed Call Returns: ${e}`);
      throw e;
    });
}



export default function Map() {
    const elRef = useRef(null);
    const mapRef = useRef(null);
    

    /* Extracted Features */
    const [extractedFeatures, setExtractedFeatures] = useState<Feature<LineString, MyProps>[] | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const map = L.map(elRef.current, {
      center: [0, 0],
      zoom: 2,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const style = { color: "#ff7800", weight: 4, opacity: 0.8 };

    



    (async () => {
        try {
            const feats = await ExtractAllKMZFeatures();
            setExtractedFeatures(feats);

            // Leaflet accepts Feature[] or a FeatureCollection
            const fc: FeatureCollection<LineString, MyProps> = {
                type: "FeatureCollection",
                features: feats,
            };


            /** Stores Feature as */
            const layer = L.geoJSON(fc, {
                style,
                onEachFeature: (f, layer) => {
                if (f.properties?.name) layer.bindPopup(f.properties.name);
                },
            }).addTo(map);
  

            // Auto-center & zoom to the lines
            const boundRef = layer.getBounds();
            if (boundRef.isValid()) {
                map.fitBounds(boundRef, { padding: [20, 20] });
            } else {
                map.setView([0,0], 2);
            }
            
        } catch (e) {
            console.log(`ERROR: ${e}`);
            map.setView([0,0], 2);
        }

    })();


    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={elRef} style={{ height: "100vh", width: "100vw" }} />;
}
