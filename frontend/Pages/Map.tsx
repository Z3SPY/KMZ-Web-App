import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

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
  

  // Read-only display layer (all features)
  const displayLayerRef = useRef<L.GeoJSON | null>(null);
  // Only layers inside this group are editable via the toolbar:
  const editableGroupRef = useRef<L.FeatureGroup | null>(null);

  const [popUpState, setPopUpState] = useState<boolean>(false);
  const popupRef = useRef<L.Popup | null>(null);


  const isEditingRef = useRef(false);
  const lastHighlightedRef = useRef<L.Layer | null>(null);



  //** HELPERS  */
  async function saveEditsToOriginalKMZ(updates: any[]) {
    console.log("Edited features:", updates);
  
    try {
      await fetch("http://localhost:3000/features/saveEdit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
    } catch (err) {
      console.error("Failed to save edits:", err);
    }
  }
  

  function isEditedEvent(evt: L.LeafletEvent): evt is L.DrawEvents.Edited {
    return !!(evt as any)?.layers?.eachLayer;
  }
  
  /** ================================ */

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const bounds = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

    const map = L.map(elRef.current, {
      center: [0, 0],
      zoom: 2,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      worldCopyJump: true,
    });


    mapRef.current = map;


    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);


    const editableGroup = new L.FeatureGroup();
    editableGroupRef.current = editableGroup;
    map.addLayer(editableGroup);
    console.log(editableGroup);

    const drawControl = new L.Control.Draw({
      draw: {
        marker: false,
        circle: false,
        circlemarker: false,
        polyline: false,
        polygon: false,
        rectangle: false,
      },                       
      edit: { featureGroup: editableGroup }
    });
    map.addControl(drawControl);


    map.on("draw:editstart", () => {
      isEditingRef.current = true;
      map.doubleClickZoom.disable(); 
      map.closePopup();
    });
    map.on("draw:editstop", () => {
      isEditingRef.current = false;
      map.doubleClickZoom.enable();
    });

    map.on("draw:edited", (evt) => {
      if (!isEditedEvent(evt)) return;            
    
      const edited: L.Layer[] = [];
      evt.layers.eachLayer((lyr: L.Layer) => edited.push(lyr));
    
      const updates = edited
        .map((l: any) => l.toGeoJSON?.())
        .filter(Boolean);
      
      console.log(updates);

      saveEditsToOriginalKMZ(updates);
    });

    map.on("popupclose", () => {
      const lyr = lastHighlightedRef.current;
      if (!lyr) return;
    
      const eg = editableGroupRef.current!;
      if (!eg.hasLayer(lyr)) {
        (lyr as any).setStyle?.({ color: "#ff7800", weight: 4, opacity: 0.8 });
      }
    
      lastHighlightedRef.current = null;
      setPopUpState(false);
    });

    popupRef.current = L.popup({
      closeButton: false,
      autoPan: true,
      className: "choice-popup", // optional for custom styling
    });

    map.on("click", () => map.closePopup());


    return () => {
      map.remove();
      mapRef.current = null;
      editableGroupRef.current = null;
      displayLayerRef.current = null;
      popupRef.current = null; 
    };
  }, []);



  function handleGeoJSON(fc: FeatureCollection<LineString, MyProps>) {
    const map = mapRef.current!;
    console.log(`FC: `, fc);

    if (!map || !fc || !Array.isArray(fc.features)) return;
    map.invalidateSize();

    if (displayLayerRef.current) {
      map.removeLayer(displayLayerRef.current);
      displayLayerRef.current = null;
    }

    const style = { color: "#ff7800", weight: 4, opacity: 0.8 };

    // Instantiate Map
    const display = L.geoJSON(fc as any, {
      style,
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 6,
          color: style.color,
          weight: 2,
          fillOpacity: 0.7,
        }),
      filter: (f) => !!f?.geometry,
      onEachFeature: (_f, lyr: any) => {
        lyr.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stop(e);
          e.originalEvent?.stopPropagation?.();

          if (isEditingRef.current) return;
          const layer = e.target as L.Layer;
          const eg = editableGroupRef.current!;
          const display = displayLayerRef.current!;
          const map = mapRef.current!;
          const popup = (popupRef.current ??= L.popup({
            closeButton: false,
            autoPan: true,
            className: "choice-popup",
            offset: L.point(0, -8),
          }));
      
          console.log(layer);
          console.log(popUpState);
      


          if (eg.hasLayer(layer)) {
            eg.removeLayer(layer);
            display.addLayer(layer);
            if (!display.hasLayer(layer)) display.addLayer(layer);
            (layer as any).setStyle?.({ color: "#ff7800", weight: 4, opacity: 0.8 });
          } else {
            setPopUpState(prev => {
              const next = !prev; // flip
              if (next) {
                (layer as any).setStyle?.({ color: "#AE75DA", weight: 6, opacity: 0.9 });
                (layer as any).bringToFront?.();
                lastHighlightedRef.current = layer; 
              } else {
                (layer as any).setStyle?.({ color: "#ff7800", weight: 4, opacity: 0.8 });
              }

              return next;
            });
      

            // ================================
            // PopUp
            // ================================

            const html = `
              <div class="Popup-Choice" > 
                <button id="pp-add" style="padding:.35rem .6rem;">Add Geometry</button>
                <button id="pp-edit" style="padding:.35rem .6rem;">Add To Edit</button>
              </div>
            `;

            popup.setLatLng(e.latlng).setContent(html).openOn(map);


            // ===============================
            // EVENM LISTENERS 
            // ================================
            layer.on("popupopen", () => {
              (layer as any).setStyle?.({ color: "#AE75DA", weight: 4, opacity: 0.8 });
            });
          
            layer.on("popupclose", () => {
              (layer as any).setStyle?.({ color: "#ff7800", weight: 6, opacity: 0.9 });
            });
      
            setTimeout(() => {
              document.getElementById("pp-add")?.addEventListener("click", () => {
                map.closePopup()
                console.log("Add Geometry clicked");
              }, {once: true});
              document.getElementById("pp-edit")?.addEventListener("click", () => {
                map.closePopup()
                display.removeLayer(layer); 
                eg.addLayer(layer); 
                console.log(layer);
                (layer as any).setStyle?.({ color: "#1e90ff", weight: 4, opacity: 0.8 });
                console.log("Edit clicked");
              }, {once: true});
            }, 0);
          }
        });
      }

      
    }).addTo(map);

    displayLayerRef.current = display;  



    // Map Re View 
    const bounds = display.getBounds();
    if (bounds.isValid()) {
      map.flyToBounds(bounds, {
        padding: [20, 20],
        maxZoom: 17,
        animate: true,
      });
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
