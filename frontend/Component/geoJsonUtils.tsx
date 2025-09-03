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
