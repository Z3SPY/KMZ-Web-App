import React, { ChangeEvent, useEffect, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "./Floating.css";
import axios from "axios";
import Filter from "./Filter";
import { List } from "./List";

type UploadStatus = "idle" | "uploading" | "success" | "error";

const REGION_OPTIONS = ["CR", "ER", "WR", "SR"];
const CITY_OPTIONS = [
  "BURAYDAH",
  "AHSA",
  "JEDDAH",
  "JIZAN",
  "KHUBAR",
  "ABHA",
  "DAMMAM",
  "MAKKAH",
  "HAIL",
  "Khamis Mushait",
  "TAIF",
  "JUBAIL",
  "MADINAH",
  "KHARJ",
  "RIYADH",
];

type Filters = { region: string | null; city: string | null; q: string };

type KmzFile = {
  id: string;
  name: string;
};

type Children = {
  id: string;
  name: string;
  isChecked: boolean;
};

interface FloatingProps {
  handleGeoJSON?: (fc: any) => void;
}

export default function Floating({ handleGeoJSON }: FloatingProps) {
  /* File Data */
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadButtonStatus, setUploadButtonStatus] = useState(false);

  const [uploadRegion, setUploadRegion] = useState<string>("");
  const [uploadCity, setUploadCity] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [exportFC, setExportFC] = useState<
    FeatureCollection | Feature | Geometry | null
  >(null);

  /** Layer and List */
  const [layerList, setLayerList] = useState<KmzFile[] | null>(null);
  const [openLayer, setOpenLayer] = useState<string | null>(null); // i.e "item1" : true , "item2": true, etc.
  const [openLayerChildren, setOpenLayerChildren] = useState<Children[] | null>(
    null,
  );

  const [openDropdown, setOpenDropdown] = useState<"region" | "city" | null>(
    null,
  );

  //** ========================================= */
  // EXTRA HELPER FOR FILTERING CHILDREN
  const [currentLayers, setCurrentLayers] = useState<any[] | null>(null);

  function buildFC(
    children: Children[],
    layersSource?: any[],
  ): FeatureCollection {
    const allowed = new Set(
      children.filter((c) => c.isChecked).map((c) => c.id),
    );

    const features = (layersSource ?? currentLayers ?? [])
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
    setExportFC(fc);
    return fc;
  }

  // toggle a child and immediately update the map
  function toggleChildCheckbox(childId: string, checked: boolean) {
    setOpenLayerChildren((prev) => {
      if (!prev) return prev;
      const next = prev.map((c) =>
        c.id === childId ? { ...c, isChecked: checked } : c,
      );
      const fc = buildFC(next);
      handleGeoJSON?.(fc);
      return next;
    });
  }

  //** ========================================= */

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const selectedFile = e.target.files[0];

      //Handle Allowerd
      const allowedExtensions = ["kml", "kmz"];
      const fileExtensionn = selectedFile.name.split(".").pop()?.toLowerCase();

      if (!fileExtensionn || !allowedExtensions.includes(fileExtensionn)) {
        alert("Invalid file type! Please upload a .KMZ file");
        setFile(null);
        setUploadRegion("");
        setUploadCity("");
        return;
      }
      setFile(selectedFile);
      setFormError(null);
    }
  }

  //** ========================================= */

  async function handleFileUpload() {
    if (!file) return;

    if (!uploadRegion || !uploadCity) {
      alert("Fill Country and Region");
      return;
    }

    setFormError(null);
    setStatus("uploading");
    setUploadProgress(0); // Reset on call
    setUploadButtonStatus(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("region", uploadRegion);
    formData.append("city", uploadCity);

    try {
      const { data } = await axios.post(
        "http://localhost:3000/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(progress);
          },
        },
      );
      setStatus("success");
      setUploadProgress(100);

      const list = await getKMZList();

      const newItem =
        (data?.fileId && list?.find((x) => x.id === data.fileId)) || //Search for new file
        list?.find((x) => x.name === file.name) ||
        (list && list[list.length - 1]);

      if (newItem) {
        await updateMapView(newItem.id); // opens dropdown + builds children + updates map
      } else if (data?.ok && data?.geojson && handleGeoJSON) {
        handleGeoJSON(data.geojson as FeatureCollection);
      }

      setTimeout(() => {
        setUploadButtonStatus(false);
        // clear the file status
        // NOTE: comment out if not applicable
        setFile(null);
        setStatus("idle");
      }, 3000);

      if (data?.ok && data?.geojson && handleGeoJSON) {
        handleGeoJSON(data.geojson as FeatureCollection);
      }
    } catch {
      alert("File upload failed!");
      setStatus("error");
      setUploadProgress(0);
      setUploadButtonStatus(false);
      setFile(null) 
    }
  }

  //** ========================================= */

  async function getKMZList(): Promise<KmzFile[] | undefined> {
    try {
      const resp = await axios.get<KmzFile[]>(
        "http://localhost:3000/files/locations",
      );
      setLayerList(resp.data);
      console.log("files:", resp.data);
      return resp.data;
    } catch (e) {
      console.log(`ERROR: ${e}`);
    }
  }

  async function updateMapView(fileId: string) {
    try {
      const resp = await axios.get(
        `http://localhost:3000/files/${fileId}/mapview`,
      );

      const layers = resp.data?.layers ?? [];

      // open this file’s dropdown
      setOpenLayer(fileId);

      // save raw layers for filtering later
      setCurrentLayers(layers);

      const childrenLayer: Children[] = layers.map((l: any) => {
        return {
          id: l.id,
          name: l.name,
          isChecked: true,
        };
      });

      setOpenLayerChildren(childrenLayer);

      const fc = buildFC(childrenLayer, layers);
      if (fc) {
        handleGeoJSON?.(fc);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const didFetch = React.useRef(false);
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    getKMZList();
  }, []);

  //** ========================================= */

  const [filters, setFilters] = useState<Filters>({
    region: null,
    city: null,
    q: "",
  });

  const filteredLayerList = React.useMemo(() => {
    const rows = layerList ?? [];
    return applyFilters(rows, filters);
  }, [layerList, filters]);

  function applyFilters<
    T extends { name: string; region?: string | null; city?: string | null },
  >(data: T[], { region, city, q }: Filters) {
    const qnorm = q.trim().toLowerCase();
    return data.filter((it) => {
      if (region && it.region !== region) return false;
      if (city && it.city !== city) return false;
      if (qnorm && !it.name.toLowerCase().includes(qnorm)) return false;
      return true;
    });
  }

  return (
    <>
      <div className="Floating">
        {/** Separate Component */}
        <div className="file-wrapper">
          <input
            className="file"
            type="file"
            name="file"
            accept=".kml,.kmz"
            onChange={handleFileChange}
          ></input>

          {file && (
            <>
              <div className="file-info">
                <p> File Name: {file.name} </p>
                <p> File Size: {(file.size / 1024).toFixed(2)} KB </p>
                <p> File Type: {file.type} </p>
              </div>

              <div className="upload-meta">
                <label>
                  Region&nbsp;
                  <select
                    value={uploadRegion}
                    onChange={(e) => setUploadRegion(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Region
                    </option>
                    {REGION_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  City&nbsp;
                  <select
                    value={uploadCity}
                    onChange={(e) => setUploadCity(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select City
                    </option>
                    {CITY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {formError && <p className="form-error">{formError}</p>}
            </>
          )}
          {file && status !== "uploading" && (
            <button
              disabled={uploadButtonStatus}
              className="upload-btn"
              onClick={handleFileUpload}
            >
              {" "}
              Upload{" "}
            </button>
          )}

          {status === "uploading" && (
            <div className="upload">
              <div className="upload-wrapper">
                <div
                  className="upload-bar"
                  style={{ width: `${uploadProgress}%` }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                />
              </div>
              <p> {uploadProgress}% upload progress </p>
            </div>
          )}

          {status === "success" && <p> File Uploaded Successfully! </p>}
          {status === "error" && <p> File Upload Failed! </p>}
        </div>

        <List
          updateMapView={updateMapView}
          getKMZList={getKMZList}
          toggleChildCheckbox={toggleChildCheckbox}
          openLayerChildren={openLayerChildren}
          layerList={filteredLayerList}
          openLayer={openLayer}
          exportFC={exportFC as FeatureCollection}
        />

        <Filter
          REGION_OPTIONS={REGION_OPTIONS}
          CITY_OPTIONS={CITY_OPTIONS}
          onChange={setFilters}
        />
      </div>
    </>
  );
}
