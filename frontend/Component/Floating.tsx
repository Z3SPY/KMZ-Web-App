import React, { ChangeEvent, useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
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

  /** Layer and List */
  const [layerList, setLayerList] = useState<KmzFile[] | null>(null);
  const [openLayer, setOpenLayer] = useState<string | null>(null); // i.e "item1" : true , "item2": true, etc.
  const [openLayerChildren, setOpenLayerChildren] = useState<Children[] | null>(
    null,
  );

  const [openDropdown, setOpenDropdown] = useState<"region" | "city" | null>(
    null,
  );

  function toggleDropdown(name: "region" | "city") {
    setOpenDropdown((curr) => (curr === name ? null : name));
  }

  function toggleOpen(id: string) {
    setOpenLayer((prev) => (prev === id ? null : id)); // only one open
  }

  //** ========================================= */
  // EXTRA HELPER FOR FILTERING CHILDREN
  const [currentLayers, setCurrentLayers] = useState<any[] | null>(null);

  //filtered FeatureCollection from checked children
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
        (l.features ?? []).map((f: any) => ({
          type: "Feature",
          geometry: f.geom,
          properties: f.props ?? {},
          id: f.id,
        })),
      );
    return { type: "FeatureCollection", features } as FeatureCollection;
  }

  // toggle a child and immediately update the map
  function toggleChildCheckbox(childId: string, checked: boolean) {
    setOpenLayerChildren((prev) => {
      if (!prev) return prev;
      const next = prev.map((c) =>
        c.id === childId ? { ...c, isChecked: checked } : c,
      );
      if (handleGeoJSON) handleGeoJSON(buildFC(next));
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
      setFile(null);
    }
  }

  async function getKMZList(): Promise<KmzFile[] | undefined> {
    try {
      const resp = await axios.get<KmzFile[]>("http://localhost:3000/files");
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

      handleGeoJSON?.(buildFC(childrenLayer, layers));
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
          layerList={layerList}
          openLayer={openLayer}
        />

        <Filter REGION_OPTIONS={REGION_OPTIONS} CITY_OPTIONS={CITY_OPTIONS} />
      </div>
    </>
  );
}
