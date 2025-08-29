import React, { ChangeEvent, useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import "./Floating.css";
import axios from "axios";

type UploadStatus = "idle" | "uploading" | "success" | "error";

type KmzFile = {
  id: string;
  name: string;
};

interface FloatingProps {
  handleGeoJSON?: (fc: any) => void;
}

function shortenName(name: string, maxLength = 25) {
  if (name.length <= maxLength) return name;
  const start = name.slice(0, 12); // first part
  const end = name.slice(-10); // last part
  return `${start}...${end}`;
}

export default function Floating({ handleGeoJSON }: FloatingProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadButtonStatus, setUploadButtonStatus] = useState(false);

  const [layerList, setLayerList] = useState<KmzFile[] | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const selectedFile = e.target.files[0];

      //Handle Allowerd
      const allowedExtensions = ["kml", "kmz"];
      const fileExtensionn = selectedFile.name.split(".").pop()?.toLowerCase();

      if (!fileExtensionn || !allowedExtensions.includes(fileExtensionn)) {
        alert("Invalid file type! Please upload a .KMZ file");
        setFile(null);
        return;
      } else {
        setFile(selectedFile);
      }
    }
  }

  async function handleFileUpload() {
    if (!file) return;

    setStatus("uploading");
    setUploadProgress(0); // Reset on call
    setUploadButtonStatus(true);

    const formData = new FormData();
    formData.append("file", file);
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
      getKMZList();
      setTimeout(() => {
        setUploadButtonStatus(false);
        // clear the file status
        // NOTE: comment out if not applicable
        setFile(null);
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

  async function getKMZList() {
    try {
      const resp = await axios.get<KmzFile[]>("http://localhost:3000/files");
      setLayerList(resp.data);
      console.log("files:", resp.data);
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

      const features = layers.flatMap((l: any) =>
        (l.features ?? []).map((f: any) => ({
          type: "Feature",
          geometry: f.geom,
          properties: f.props ?? {},
          id: f.id,
        })),
      );

      const fc = { type: "FeatureCollection", features } as FeatureCollection;
      handleGeoJSON?.(fc);
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
        <div className="file-wrapper">
          <input
            className="file"
            type="file"
            name="file"
            accept=".kml,.kmz"
            onChange={handleFileChange}
          ></input>
          {file && (
            <div className="file-info">
              <p> File Name: {file.name} </p>
              <p> File Size: {(file.size / 1024).toFixed(2)} </p>
              <p> File Type: {file.type} </p>
            </div>
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

        <div className="List">
          <h4> KMZ FILES </h4>
          <ul className="List-wrapper">
            {layerList && layerList.length > 0
              ? layerList.map((l) => {
                  return (
                    <li
                      key={l.id}
                      onClick={() => updateMapView(l.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        updateMapView(l.id)
                      }
                    >
                      {shortenName(l.name)}
                    </li>
                  );
                })
              : null}
          </ul>
        </div>
      </div>
    </>
  );
}
