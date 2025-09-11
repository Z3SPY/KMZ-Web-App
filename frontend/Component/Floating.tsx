import React, { ChangeEvent, useEffect, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Children } from "./geoJsonUtils";
import { buildFC } from "./geoJsonUtils";
import "./Floating.css";
import axios from "axios";
import Filter from "./Filter";
import { List } from "./List";

export type UploadStatus =
  | "idle"
  | "uploading"
  | "success"
  | "error"
  | "downloading";

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

  // toggle a child and immediately update the map
  function toggleChildCheckbox(childId: string, checked: boolean) {
    setOpenLayerChildren((prev) => {
      if (!prev) return prev;
      const next = prev.map((c) =>
        c.id === childId ? { ...c, isChecked: checked } : c,
      );
      const fc = buildFC(next);
      setExportFC(fc);
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

      if (data?.fileId) {
        await updateMapView(data.fileId);
      } else {
        // fallback if backend didn’t return fileId
        const list = await getKMZList();
        const newItem = list?.find(x => x.name === file.name) || list?.[list.length - 1];
        if (newItem) await updateMapView(newItem.id);
      }

      setTimeout(() => {
        setUploadButtonStatus(false);
        // clear the file status
        // NOTE: comment out if not applicable
        setFile(null);
        setStatus("idle");
      }, 3000);

    
    } catch (e) {
      if (axios.isAxiosError(e) && e.response) {
        alert(`${e.response.data.error}`);
      } else alert("File upload failed!");
      setStatus("error");
      setUploadProgress(0);
      setUploadButtonStatus(false);
      setFile(null);
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

  //** ========================================= */

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
      setExportFC(fc);

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

  useEffect(() => {
    function onChanged(e: any) {
      const fileId = e?.detail?.fileId ?? openLayer;
      if (fileId) {
        updateMapView(fileId);
      } else {
        // clear the map if nothing to show (e.g., deleted the open file)
        handleGeoJSON?.({ type: "FeatureCollection", features: [] });
        // optionally also refresh list, and collapse the open panel
        // await getKMZList();
        // setOpenLayer(null);
      }
    }
    window.addEventListener("kmz:changed", onChanged);
    return () => window.removeEventListener("kmz:changed", onChanged);
  }, [openLayer]);

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
      <div
        className={
          status === "downloading" || status === "uploading" ? "Download" : ""
        }
        style={{ display: "none" }}
      >
        {" "}
        {status.toUpperCase()}{" "}
      </div>
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
          setStatus={setStatus}
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
