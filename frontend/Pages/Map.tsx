// ==================
// MAP (LEAFLET-PM REFACTOR)
// ==================
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet-Geoman (Leaflet-PM)
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

import type { FeatureCollection } from "geojson";
import axios from "axios";
import React from "react";
import Floating from "../Component/Floating";
import { PopupUI } from "../Component/popup";
import { Children, applyStyle, COLORS, getKey, setEditing, toggleEdit } from "../Component/geoJsonUtils";



// Note Request Refresh acts as a variable less interface
export default function Map({ requestRefresh }: { requestRefresh?: (id?: string) => void }) {
  type LeafletGeoJSON = ReturnType<typeof L.geoJSON>;
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Read-only display layer (all features)
  const displayLayerRef = useRef<L.GeoJSON | null>(null);

  // Editing Key ref
  const editingKeyRef = useRef<string | null>(null); 


  // Popup & selection state
  const [popUpState, setPopUpState] = useState<boolean>(false);
  const parentFileIdRef = useRef<string | null>(null);
  const popupRef = useRef<L.Popup | null>(null);
  const isEditingRef = useRef(false);
  const [isEditingUI, setIsEditingUI] = useState(false);

  const lastHighlightedRef = useRef<L.Layer | null>(null);
  const attachToIdRef = useRef<string | null>(null);

  const selectedEditIdRef = useRef<string | null>(null);
  const editSessionActiveRef = useRef(false);
  const pendingAddRef = useRef<{
    mode: "attach" | "standalone";
    parentId?: string;
    layerId?: string | null;  
    fileId?: string | null;    
  } | null>(null);



// ==================
// HELPERS
// ==================
  async function saveEditsToOriginalKMZ(updates: any[]) {
    try {
      const response = await axios.patch(
        "http://localhost:3000/features/saveEdit",
        { updates },
        { headers: { "Content-Type": "application/json" } }
      );
      return response.data;
    } catch (err) {
      console.error("Failed to save edits:", err);
    }
  }

  function setEditingUI(key: string | null) {
    const display = displayLayerRef.current!;
    setEditing(display, editingKeyRef, key);  
    setIsEditingUI(!!key);                    
  }

  function toggleEditUI(layer: any) {
    const key = getKey(layer);
    if (!key) return;
    const next = editingKeyRef.current === key ? null : key;
    setEditingUI(next);
  }

  function onDoneEdit() {
    setEditingUI(null); 
  }

  async function onSaveEdit() {
    try { await saveCurrentEditByKey(); }
    finally { setEditingUI(null); }
  }
  

  function onCancelEdit() {
    setEditingUI(null);
    if (parentFileIdRef.current) {
      window.dispatchEvent(new CustomEvent("kmz:changed", { detail: { fileId: parentFileIdRef.current } }));
    }
  }

  function getLayersForKey(key: string) {
    const display = displayLayerRef.current!;
    const out: any[] = [];
    display.eachLayer((lyr: any) => {
      const gj = lyr?.toGeoJSON?.();
      const id = lyr?.feature?.id ?? gj?.id;
      const pid = gj?.properties?.parentId ?? lyr?.feature?.properties?.parentId;
      if (id === key || pid === key) out.push(lyr);
    });
    return out;
  }
  
  async function saveCurrentEditByKey() {
    const key = editingKeyRef.current;
    if (!key) return;
    const layers = getLayersForKey(key);
    if (!layers.length) return;
  
    const first = layers[0].toGeoJSON();
    const props = first.properties ?? {};
    const parentId = first?.properties?.parentId;
    const originalType = first?.properties?.originalType;
  
    if (parentId && originalType === "MultiLineString") {
      const siblings = layers.map((l: any) => l.toGeoJSON());
      const coords = siblings
        .sort((a, b) => (a.properties?.childIndex ?? 0) - (b.properties?.childIndex ?? 0))
        .map((s) => s.geometry.coordinates);
  
      await saveEditsToOriginalKMZ([
        { type: "Feature", id: parentId, properties: { ...props },
          geometry: { type: "MultiLineString", coordinates: coords } }
      ]);
    } else {
      const target = layers.find((l: any) => {
        const gj = l.toGeoJSON();
        const fid = l.feature?.id ?? gj?.id;
        return fid === key;
      }) ?? layers[0];
  
      const gj = target.toGeoJSON();
      await saveEditsToOriginalKMZ([
        { type: "Feature", id: (target.feature?.id ?? gj.id),
          properties: gj.properties ?? {}, geometry: gj.geometry }
      ]);
    }
  
    if (parentFileIdRef.current) {
      window.dispatchEvent(new CustomEvent("kmz:changed", { detail: { fileId: parentFileIdRef.current } }));
    }
  }
  
  

// ==================
// INIT
// ==================
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

// ==========================
// TOOLBAR INIT (GEOMAN)
// ==========================
    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawPolyline: false,
      drawPolygon: false,
      drawRectangle: false,
      editMode: false,
      dragMode: false,
      removalMode: false,
    });

// ==========================
// GLOBAL OPTIONS (SNAP/CONSTRAINTS)
// ==========================
    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
    });

// ==================
// EVENTS (GEOMAN)
// ==================

// ==========================
// GLOBAL EDIT MODE TOGGLE (draw:editstart/stop equivalent)
// ==========================
    map.on("pm:globaleditmodetoggled", (e: any) => {
      isEditingRef.current = !!e.enabled;
      if (e.enabled) map.doubleClickZoom.disable();
      else map.doubleClickZoom.enable();
      map.closePopup();
    });

// ==========================
// PER-LAYER EDIT EVENT (vertex drag end, etc.)
// ==========================
map.on("pm:edit", async (e: any) => {
  const lyr = e.layer as any;
  const gj = lyr?.toGeoJSON?.();
  if (!gj?.geometry) return;

  const parentId = gj?.properties?.parentId;
  const originalType = gj?.properties?.originalType;

  try {
    if (parentId && originalType === "MultiLineString") {
      const display = displayLayerRef.current!;
      const siblings: any[] = [];
      display.eachLayer((l: any) => {
        const s = l?.toGeoJSON?.();
        if (s?.properties?.parentId === parentId) siblings.push(s);
      });
      const coords = siblings
        .sort((a,b)=>(a.properties?.childIndex ?? 0) - (b.properties?.childIndex ?? 0))
        .map((s)=>s.geometry.coordinates);

      await axios.patch("http://localhost:3000/features/saveEdit", {
        updates: [{
          id: parentId,
          geometry: { type: "MultiLineString", coordinates: coords },
        }],
      });
    } else {
      const fid = lyr.feature?.id ?? gj.id;
      await axios.patch("http://localhost:3000/features/saveEdit", {
        updates: [{
          id: fid,
          geometry: gj.geometry,   
        }],
      });
    }

    const fileId = lyr?.feature?.properties?.fileId ?? parentFileIdRef.current;
    if (fileId) {
      window.dispatchEvent(new CustomEvent("kmz:changed", { detail: { fileId } }));
    }
  } catch (err) {
    console.error("Failed to save edits:", err);
  }
});


// ==========================
// CREATE NEW GEOMETRY (programmatic draw OR toolbar)
// ==========================
map.on("pm:create", async (e: any) => {
  const map = mapRef.current!;
  const display = displayLayerRef.current!;
  const layer = e.layer as any;
  const gj = layer.toGeoJSON?.();
  const newGeom = gj?.geometry;
  const intent = pendingAddRef.current;

  // temp visual for what user just drew
  (layer as any).setStyle?.({ color: "#1e90ff", weight: 4, opacity: 0.9 });

  // default: we will remove temp layer after this op
  let keepLayer = false;

  try {
    if (!newGeom || !intent) {
      // No intent (e.g., user clicked Draw from toolbar with no popup context) –
      // keep the temp layer by adding it into display for now.
      display.addLayer(layer);
      keepLayer = true;
      return;
    }

    if (intent.mode === "attach") {
      let nextIdx = 0;
      display.eachLayer((lyr: any) => {
        const p = lyr?.feature?.properties;
        if (p?.parentId === intent.parentId) {
          const i = (p.childIndex ?? -1) + 1;
          if (i > nextIdx) nextIdx = i;
        }
      });

      const optimisticChild: GeoJSON.Feature = {
        type: "Feature",
        id: `${intent.parentId}::opt-${Date.now()}`, // temporary id; server refresh will replace
        properties: {
          parentId: intent.parentId,
          childIndex: nextIdx,
          originalType: "MultiLineString",
          // keep context so your popup/edit logic works immediately:
          fileId: intent.fileId ?? null,
          layer_id: undefined, // optional for lines; not used on attach
          name: `segment ${nextIdx + 1}`,
        },
        geometry: newGeom, // the drawn LineString
      };
      
      display.addData(optimisticChild);


      await axios.patch("http://localhost:3000/features/attach", {
        id: intent.parentId,
        geometry: newGeom,
        mode: "collect",
      });

      
    } else if (intent.mode === "standalone") {
      const { data } = await axios.post(
        "http://localhost:3000/features/create",
        {
          layerId: intent.layerId ?? undefined,
          fileId:  intent.layerId ? undefined : intent.fileId,
          geometry: newGeom,
          properties: {}, 
        },
        { headers: { "Content-Type": "application/json" } }
      );
    
      const feature: GeoJSON.Feature = {
        type: "Feature",
        id: data.id,                           
        properties: {
          layer_id: intent.layerId ?? null,   
          fileId: intent.fileId ?? null,
          name: data.properties?.name ?? "New point",
        },
        geometry: newGeom,
      };
    
      // This will call your onEachFeature, styling, etc.
      display.addData(feature);
    }

    // SUCCESS 
    if (intent.fileId) {
      window.dispatchEvent(
        new CustomEvent("kmz:changed", { detail: { fileId: intent.fileId } })
      );
    } else {
      console.warn("Create/Attach succeeded but no fileId to refresh");
    }


  } catch (err: any) {
    console.error("Create/Attach failed:", err?.response?.status, err?.response?.data || err);
    // On failure: keep the temp layer so the user sees what failed
    keepLayer = true;
  }  finally {
    if (!keepLayer && map.hasLayer(layer)) {
      map.removeLayer(layer); // remove the TEMP draw layer
    }
    pendingAddRef.current = null;
    attachToIdRef.current = null;
    try { map.pm.disableDraw(e.shape); } catch {}
  }
});




// ==========================
// DELETIONS (removalMode)
// ==========================
    map.on("pm:remove", async (e: any) => {
      const lyr = e.layer as any;
      const id = lyr?.feature?.id;
      if (!id) return;
      try {

        // Problems with this 
        // TODO: call your delete endpoint here when available
        // await axios.delete(`http://localhost:3000/features/${id}`)
        if (parentFileIdRef.current) {
          window.dispatchEvent(
            new CustomEvent("kmz:changed", { detail: { fileId: parentFileIdRef.current } })
          );
        }
      } catch (err) {
        console.error("Failed to delete features:", err);
      }
    });

// ==========================
// POPUP UX
// ==========================
    map.on("click", () => map.closePopup());

    popupRef.current = L.popup({ closeButton: false, autoPan: true, className: "choice-popup" });

    return () => {
      map.remove();
      mapRef.current = null;
      displayLayerRef.current = null;
      popupRef.current = null;
    };
  }, []);

// ==================
// DRAWING AND GEOMETRY HEWLPERS  
// ==================
  function addGeometry(geoType: "point" | "line" ) {
    console.log(`Added Geometry ${geoType}`)
    const map = mapRef.current;
    if (!map) return;
    const shape = geoType === "point" ? "Marker" : "Line";
    map.pm.enableDraw(shape as any, { snappable: true });
  }

// ==================
// RENDER GEOJSON TO MAP
// ==================
// ==========================
// MULTILINESTRING EXPLODE HELPER (render-only)
// ==========================
function explodeMultiLineForRender(fc: FeatureCollection): FeatureCollection {
  const out: FeatureCollection = { type: "FeatureCollection", features: [] as any[] };
  for (const f of fc.features ?? []) {
    const g: any = (f as any).geometry;
    if (g?.type === "MultiLineString") {
      const lines: number[][][] = g.coordinates;
      lines.forEach((coords, idx) => {
        out.features.push({
          type: "Feature",
          id: `${(f as any).id}::${idx}`,
          properties: {
            ...(f as any).properties,
            parentId: (f as any).id,
            childIndex: idx,
            originalType: "MultiLineString",
            name: `${(f as any).properties?.name ?? (f as any).id} (part ${idx + 1})`,
          },
          geometry: { type: "LineString", coordinates: coords },
        });
      });
    } else {
      out.features.push(f as any);
    }
  }
  return out;
}



function handleGeoJSON(fc: FeatureCollection) {
    const map = mapRef.current!;
    if (!map || !fc || !Array.isArray(fc.features)) return;

    // Explode MultiLineString -> 
    fc = explodeMultiLineForRender(fc);

    map.invalidateSize();

    if (displayLayerRef.current) {
      map.removeLayer(displayLayerRef.current);
      displayLayerRef.current = null;
    }

    const style = COLORS.base as L.PathOptions;

    const display = L.geoJSON(fc as any, {
      style,
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 6,
          color: (style as any).color,
          weight: 2,
          fillOpacity: 0.7,
        }),
      filter: (f) => !!f?.geometry,
      onEachFeature: (_f, lyr: any) => {
        lyr.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stop(e);
          e.originalEvent?.stopPropagation?.();
          if (isEditingRef.current) return; // ignore clicks while in global edit

          const layer = e.target as L.Layer & { feature?: any };
          const display = displayLayerRef.current!;
          const map = mapRef.current!;
          const popup = (popupRef.current ??= L.popup({
            closeButton: false,
            autoPan: true,
            className: "choice-popup",
            offset: L.point(0, -8),
          }));

          // capture ids for subsequent actions
          attachToIdRef.current = (layer as any).feature?.id ?? null;
          parentFileIdRef.current =
            (layer as any).feature?.properties?.fileId ??
            (layer as any).feature?.properties?.layer_id ??
            null;

          // highlight toggle
          setPopUpState((prev) => {
            const next = !prev;
            if (next) {
              applyStyle(layer, "select");
              (layer as any).bringToFront?.();
              lastHighlightedRef.current = layer;
            } else {
              const key = getKey(layer);
              if (key && editingKeyRef.current === key) applyStyle(layer, "edit");
              else applyStyle(layer, "base");
            }
            return next;
          });

          // reinforce on popup lifecycle
          layer.on("popupopen", () => applyStyle(layer, "select"));
          layer.on("popupclose", () => {
            const key = getKey(layer);
            if (key && editingKeyRef.current === key) applyStyle(layer, "edit");
            else applyStyle(layer, "base");
          });

          // mount React UI inside Leaflet popup
          const container = document.createElement("div");
          popup.setLatLng(e.latlng).setContent(container).openOn(map);
          const root = createRoot(container);

          // Render front end via created root div
          root.render(

            <PopupUI
                onAddGeometry={(t) => {
                  const f = (layer as any).feature;
                  const featureId = f?.id ?? null;

                  const p = f?.properties ?? {};
                  const fileId = p.fileId ?? null;
                  const layerId = p.layer_id ?? null;
                  const parentId = p.parentId ?? featureId; 

                  console.log(`
                    FILEID = ${fileId} \n
                    LAYER = ${layerId} \n
                    PARENT = ${parentId}
                  `)


                  parentFileIdRef.current = fileId;

                  if (t === "point") {
                    // Standalone point
                    console.log("point");
                    pendingAddRef.current = { mode: "standalone", layerId, fileId }
                  } else {
                    // Line/Polygon attach to the selected feature (parent-aware)
                    console.log("line");
                    pendingAddRef.current = { mode: "attach", parentId, fileId };
                  }
                
                  addGeometry(t);
                  map.closePopup();
                }}
                onEdit={() => {
                  map.closePopup();
                  toggleEditUI(layer);
                }}
              />


          );
            
          map.once("popupclose", () => root.unmount());
        });
      },
    }).addTo(map);

    displayLayerRef.current = display;

    const b = display.getBounds();
    if (b.isValid()) {
      map.flyToBounds(b, { padding: [20, 20], maxZoom: 17, animate: true });
    }
}

// ==================
// RESET HIGHLIGHT ON POPUP CLOSE
// ==================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClose = () => {
      const lyr = lastHighlightedRef.current;
      if (!lyr) return;
      const key = getKey(lyr);
      if (key && editingKeyRef.current === key) applyStyle(lyr, "edit");
      else applyStyle(lyr, "base");
      lastHighlightedRef.current = null;
      setPopUpState(false);
    };
    map.on("popupclose", onClose);
    return () => { map.off("popupclose", onClose); };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingKeyRef.current) {
        setEditingUI(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [])

  return (
    <>
      <Floating handleGeoJSON={handleGeoJSON} />
      <div ref={elRef} style={{ height: "100vh", width: "100vw" }} />
      {isEditingUI && (
          <div style={{
            position: "absolute",
            zIndex: 1000,
            left: 12,
            bottom: 12,
            display: "flex",
            gap: 8,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "8px 10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
          }}> 
            <button onClick={onSaveEdit}>Save</button>
            <button onClick={onCancelEdit}>Cancel</button>
          </div>
        )}
    </>
  );
}
