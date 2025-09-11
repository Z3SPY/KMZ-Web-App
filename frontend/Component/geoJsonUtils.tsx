import { Feature, FeatureCollection } from "geojson";


export type Children = {
    id: string;
    name: string;
    isChecked: boolean;
  };

  
export function buildFC(
    children: Children[],
    layersSource?: any[],
  ): FeatureCollection {
    const allowed = new Set(
      children.filter((c) => c.isChecked).map((c) => c.id),
    );

    const features = (layersSource ?? [])
      .filter((l: any) => allowed.has(l.id))
      .flatMap((l: any) =>
        (l.features ?? []).map((f: any) => {
          const geometry =
            typeof f.geom === "string" ? JSON.parse(f.geom) : f.geom;
          if (!geometry || !geometry.type) return null;

          const baseName =
            f.props?.name ?? f.name ?? l.name ?? `feature-${f.id ?? ""}`;

          const simplestyle: Record<string, any> = {};
          switch (geometry.type) {
            case "Point":
            case "MultiPoint":
              simplestyle["marker-color"] = f.props?.markerColor ?? "#3366FF";
              simplestyle["marker-size"] = f.props?.markerSize ?? "medium";
              break;
            case "LineString":
            case "MultiLineString":
              simplestyle["stroke"] = f.props?.stroke ?? "#FF6600";
              simplestyle["stroke-width"] = f.props?.strokeWidth ?? 7;
              simplestyle["stroke-opacity"] = f.props?.strokeOpacity ?? 1;
              break;
            default: // Polygon/MultiPolygon
              simplestyle["stroke"] = f.props?.stroke ?? "#333333";
              simplestyle["stroke-width"] = f.props?.strokeWidth ?? 7;
              simplestyle["stroke-opacity"] = f.props?.strokeOpacity ?? 1;
              simplestyle["fill"] = f.props?.fill ?? "#33CC99";
              simplestyle["fill-opacity"] = f.props?.fillOpacity ?? 0.4;
          }

          return {
            type: "Feature" as const,
            id: f.id,
            geometry,
            properties: {
              layer_id: l.id,
              fileId: l.kmz_id ?? l.fileId,
              name: baseName,
              description: f.props?.description ?? "",
              ...f.props,
              ...simplestyle,
            },
          };
        }),
      )
      .filter(Boolean) as Feature[];

    const fc: FeatureCollection = { type: "FeatureCollection", features };
    return fc;
  }




// Edit Selector Helper
export const COLORS = {
  base:   { color: "#ff7800", weight: 4, opacity: 0.8 },
  select: { color: "#AE75DA", weight: 6, opacity: 0.9 },
  edit:   { color: "#1e90ff", weight: 6, opacity: 0.9 },
} as const;

export function applyStyle(layer: any, mode: keyof typeof COLORS) {
  layer?.setStyle?.(COLORS[mode]);
}


// ----- Keys & Sets -----
  /** session key: parentId for exploded MultiLineString, else feature id */
export function getKey(layer: any): string | null {
  const gj = layer?.toGeoJSON?.();
  const pid = gj?.properties?.parentId ?? layer?.feature?.properties?.parentId;
  const fid = layer?.feature?.id ?? gj?.id ?? null;
  return (pid ?? fid) ?? null;
}
  
/** all layers in the display GeoJSON that correspond to the same editable unit */
export function getSetByKey(display: L.GeoJSON, key: string): any[] {
  const out: any[] = [];
  display.eachLayer((lyr: any) => {
    const gj = lyr?.toGeoJSON?.();
    const id = lyr?.feature?.id ?? gj?.id;
    const pid = gj?.properties?.parentId ?? lyr?.feature?.properties?.parentId;
    if (id === key || pid === key) out.push(lyr);
  });
  return out;
}
  

  // ----- Edit state API -----
// editingKeyRef is a React.MutableRefObject<string | null>

type EditOpts = {
  draggable?: boolean;
  snappable?: boolean;
  allowRemovingVertices?: boolean;
  allowSelfIntersection?: boolean;
};

const DEFAULT_PM_OPTS: EditOpts = {
  draggable: true,
  snappable: true,
  allowRemovingVertices: true,
  allowSelfIntersection: false,
};

/** enable/disable edit for one key (handles pm + colors) */
export function setEditing(
  display: L.GeoJSON,
  editingKeyRef: React.MutableRefObject<string | null>,
  key: string | null,
  pmOptions: EditOpts = DEFAULT_PM_OPTS
) {
  // turn OFF previous
  const prev = editingKeyRef.current;
  if (prev) {
    getSetByKey(display, prev).forEach((lyr) => {
      lyr.pm?.disable?.();
      applyStyle(lyr, "base");
    });
  }

  // update ref
  editingKeyRef.current = key;

  // turn ON new
  if (key) {
    getSetByKey(display, key).forEach((lyr) => {
      lyr.pm?.enable?.(pmOptions);
      applyStyle(lyr, "edit");
    });
  }
}

/** toggle edit for a clicked layer */
export function toggleEdit(
  display: L.GeoJSON,
  editingKeyRef: React.MutableRefObject<string | null>,
  layer: any,
  pmOptions: EditOpts = DEFAULT_PM_OPTS
) {
  const key = getKey(layer);
  if (!key) return;
  setEditing(
    display,
    editingKeyRef,
    editingKeyRef.current === key ? null : key,
    pmOptions
  );
}