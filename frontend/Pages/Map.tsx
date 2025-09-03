import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as L from "leaflet";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

import type { Feature, FeatureCollection, LineString, Geometry } from "geojson";

import axios from "axios";
import React from "react";
import Floating from "../Component/Floating";
import { PopupUI } from "../Component/popup";
import type { Children } from "../Component/geoJsonUtils";
import { buildFC } from "../Component/geoJsonUtils";

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


// Note Request Refresh acts as a variable less interface
export default function Map({ requestRefresh }: { requestRefresh?: (id?: string)=>void }) {
  type LeafletGeoJSON = ReturnType<typeof L.geoJSON>;
  const elRef = useRef(null);
  const mapRef = useRef<any | null>(null);

  // Read-only display layer (all features)
  const displayLayerRef = useRef<L.GeoJSON | null>(null);
  // Only layers inside this group are editable via the toolbar:
  const editableGroupRef = useRef<L.FeatureGroup | null>(null);

  const [popUpState, setPopUpState] = useState<boolean>(false);

  const parentFileIdRef = useRef<string | null>(null);
  const popupRef = useRef<L.Popup | null>(null);

  const isEditingRef = useRef(false);
  const lastHighlightedRef = useRef<L.Layer | null>(null);
  const attachToIdRef = useRef<string | null>(null);



  //** HELPERS  */
  async function saveEditsToOriginalKMZ(updates: any[]) {
    console.log("Edited features:", updates);

    try {
      const response = await axios.patch("http://localhost:3000/features/saveEdit", {
        updates: updates,
      }, {
        headers: {
          "Content-Type": "application/json",
        }
      });

      return response.data;
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
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
      edit: { featureGroup: editableGroup },
    });
    map.addControl(drawControl);

    // =====================================
    /** EVENT LISTENERS FOR EDIT  */
    // =====================================

    
    //// =====================================
    //  Check Edit Start

    map.on("draw:editstart", () => {
      isEditingRef.current = true;
      map.doubleClickZoom.disable();
      map.closePopup();
    });

    //// =====================================
    //  Check Edit Stop

    map.on("draw:editstop", () => {
      isEditingRef.current = false;
      map.doubleClickZoom.enable();
    });


    //// =====================================
    //  Check If Event is in Edit Mode

    map.on("draw:edited", async (evt) => {
      if (!isEditedEvent(evt)) return;

      const edited: L.Layer[] = [];
      evt.layers.eachLayer((lyr: L.Layer) => edited.push(lyr));

      const updates = edited.map((l: any) => {
        const gj = l.toGeoJSON?.();
        if (!gj?.geometry) return null;
        const id = l.feature?.id ?? gj.id;
        if (!id) return null;
        const props = l.feature?.properties ?? gj.properties ?? {};
        return { type: "Feature", id, properties: props, geometry: gj.geometry };
      }).filter(Boolean) as any[];


      if (updates.length) {
        try {
          await saveEditsToOriginalKMZ(updates);
          // 🔔 tell Floating to refresh map view
          if (parentFileIdRef.current) {
            window.dispatchEvent(new CustomEvent("kmz:changed", {
              detail: { fileId: parentFileIdRef.current }
            }));
          }
        } catch (err) {
          console.error("Failed to save edits:", err);
        }
      }

      

      const eg = editableGroupRef.current!;
      const display = displayLayerRef.current!;

      edited.forEach((l: any) => {
        eg.removeLayer(l);                      // <-- remove from edit group
        display.addLayer(l);                    // <-- back to display
        l.setStyle?.({ color: "#ff7800", weight: 4, opacity: 0.8 }); // base style
      });

      
    });


    //// =====================================
    //  Check Deleted Event is Called

    // PLEASE FIX THIS
    map.on("draw:deleted", async (evt: any) => {
      const removed: L.Layer[] = [];
      evt.layers.eachLayer((lyr: L.Layer) => removed.push(lyr));
    
      const ids = removed.map((l: any) => l.feature?.id).filter(Boolean);
      if (!ids.length) return;
    
      try {
        
  
      } catch (err) {
        console.error("Failed to delete features:", err);
      }
    });


    //// =====================================
    /** Check if new Polygon Event is Called  */
    map.on("draw:created",  async (e : any) => {

      const map = mapRef.current!;
      const display = displayLayerRef.current!;

      const layer : L.Layer = e.layer;

      (layer as any).setStyle?.({ color: "#ff7800", weight: 4.0, opacity: 0.9 });

      const parentId = attachToIdRef.current;
      if (!parentId) return;

      const newGeom = e.layer.toGeoJSON().geometry;

      // Not in display
      if (!display.hasLayer(layer)) {
        display.addLayer(layer);

        // Attach fetch call
        try {
          const response = await axios.patch("http://localhost:3000/features/attach", {
            id: parentId,
            geometry: newGeom,
            mode: "collect"
          }, {
            headers: {
              "Content-Type": "application/json",
            }
          });
          


          // Could be bloat ware but it works?
          // It was all for this can we check???
          const layers = response.data?.updatedFeatureCollection ?? [];
          const childrenLayer: Children[] = layers.map((l: any) => {
            return {
              id: l.id,
              name: l.name,
              isChecked: true,
            };
          });
          const fc = buildFC(childrenLayer, layers);
          handleGeoJSON?.(fc);

          // It was all for this can we check???

          display.removeLayer(layer); 
          requestRefresh?.(parentFileIdRef.current ?? undefined); 
          console.log("Successfully created geometry", response.data);


          
         
        } catch (e : any ){ 
          if (axios.isAxiosError(e)) {
            console.error("Request failed:", e.response?.status, e.response?.data);
          } else {
            console.error("Unexpected error:", e);
          }
        }
        
        attachToIdRef.current = null; 
      }

      
      
    })


    //// =====================================
    /** Check if Leaflet Popup is closed  */
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


    //// =====================================
    /** Check if Click anywhere in map */
    map.on("click", () => map.closePopup());

    return () => {
      map.remove();
      mapRef.current = null;
      editableGroupRef.current = null;
      displayLayerRef.current = null;
      popupRef.current = null;
    };
  }, []);


  /** Handle Map */
  const activeDrawerRef = useRef<L.Draw.Feature | null>(null);

  function addGeometry(geoType: "point" | "line" | "polygon") {
    console.log(geoType);
    const map = mapRef.current;
    if (!map) return;

    activeDrawerRef.current?.disable();

    let drawer: L.Draw.Feature;
    const shapeOptions = {color: "#1e90ff", weight: 4, opacity: 0.9};

    switch(geoType) {
      case "point":
        drawer = new L.Draw.Marker(map, {});
        break;
      case "line":
        drawer = new L.Draw.Polyline(map, { shapeOptions });
        break;
      case "polygon":
        drawer = new L.Draw.Polygon(map, { shapeOptions });
        break;
      default:
        return;
     
    }

    activeDrawerRef.current = drawer;
    drawer.enable();
    
  }

  



  /** */
  function handleGeoJSON(fc: FeatureCollection) {
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

          // ============================
          // Refresh Checks 
          // ============================
          L.DomEvent.stop(e);
          e.originalEvent?.stopPropagation?.();

          if (isEditingRef.current) return;


          
          
          // ============================
          // Leaflet Layers
          // ============================
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

          //console.log(layer);
          //console.log(popUpState);

          attachToIdRef.current = (layer as any).feature?.id ?? null;
          parentFileIdRef.current =
            (layer as any).feature?.properties?.fileId ??
            (layer as any).feature?.properties?.layer_id ??
            null;


          // ============================
          // FEATURE HIGHLIGHTER
          // ============================

          if (eg.hasLayer(layer)) {

            // Remove from Edit layer, Add Featue back to display
            eg.removeLayer(layer);
            display.addLayer(layer);
            if (!display.hasLayer(layer)) display.addLayer(layer);
            (layer as any).setStyle?.({
              color: "#ff7800",
              weight: 4,
              opacity: 0.8,
            });
          } else {

            // Else the selected feature is called for Edit or Add Geometry

            // Popup Color State 
            // Check  For Click Features
            setPopUpState((prev) => {
              const next = !prev; // flip
              if (next) {
                (layer as any).setStyle?.({
                  color: "#AE75DA",
                  weight: 6,
                  opacity: 0.9,
                });
                (layer as any).bringToFront?.();
                lastHighlightedRef.current = layer;
              } else {
                (layer as any).setStyle?.({
                  color: "#ff7800",
                  weight: 4,
                  opacity: 0.8,
                });
              }

              return next;
            }); 


            // Popup Event Listener 
            layer.on("popupopen", () => {
              (layer as any).setStyle?.({
                color: "#AE75DA",
                weight: 4,
                opacity: 0.8,
              });
            });

            layer.on("popupclose", () => {
              (layer as any).setStyle?.({
                color: "#ff7800",
                weight: 6,
                opacity: 0.9,
              });
            });

            // ================================
            // HANDLE POPUP UI / LOGIC
            // ================================

            const container = document.createElement("div"); 

            popup.setLatLng(e.latlng).setContent(container).openOn(map);

            const root = createRoot(container);
            root.render(
              <PopupUI
                onAddGeometry={(t) => {
                  attachToIdRef.current = (layer as any).feature?.id ?? null;
                  addGeometry(t);
                  map.closePopup();
                }}
                onEdit={() => {
                  map.closePopup();
                  display.removeLayer(layer);
                  eg.addLayer(layer);
                  (layer as any).setStyle?.({
                    color: "#1e90ff",
                    weight: 6,
                    opacity: 0.9,
                  });
                }}
              />
            )

            map.once("popupclose", () => {
              root.unmount();
            });

            // ===============================
            // EVENM LISTENERS
            // ================================
            

            
          }
        });
      },
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
