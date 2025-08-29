import React, { ChangeEvent, useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import "./Floating.css";
import axios from "axios";

type UploadStatus = "idle" | "uploading" | "success" | "error";

type KmzFile = {
  id: string;
  name: string;
};

type Children = {
  id: string;
  name: string;
  isChecked: boolean;
}

interface FloatingProps {
  handleGeoJSON?: (fc: any) => void;
}

function shortenName(name: string, maxLength = 25) {
  if (name.length <= maxLength) return name;
  const start = name.slice(0, 10); // first part
  const end = name.slice(-10); // last part
  return `${start}...${end}`;
}

export default function Floating({ handleGeoJSON }: FloatingProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadButtonStatus, setUploadButtonStatus] = useState(false);

  const [layerList, setLayerList] = useState<KmzFile[] | null>(null);
  const [openLayer, setOpenLayer] = useState<string | null >(null); // i.e "item1" : true , "item2": true, etc.
  const [openLayerChildren, setOpenLayerChildren] = useState<Children[] | null>(null);

  function toggleOpen(id: string) {
    setOpenLayer(prev => (prev === id ? null : id)); // only one open
  }


  //** ========================================= */
  // EXTRA HELPER FOR FILTERING CHILDREN 
  const [currentLayers, setCurrentLayers] = useState<any[] | null>(null);

  //filtered FeatureCollection from checked children
  function buildFC(children: Children[], layersSource?: any[]): FeatureCollection {
    const allowed = new Set(children.filter(c => c.isChecked).map(c => c.id));
    const features =
      (layersSource ?? currentLayers ?? [])
        .filter((l: any) => allowed.has(l.id))
        .flatMap((l: any) =>
          (l.features ?? []).map((f: any) => ({
            type: "Feature",
            geometry: f.geom,
            properties: f.props ?? {},
            id: f.id,
          }))
        );
    return { type: "FeatureCollection", features } as FeatureCollection;
  }
  

  // toggle a child and immediately update the map
  function toggleChildCheckbox(childId: string, checked: boolean) {
    setOpenLayerChildren(prev => {
      if (!prev) return prev;
      const next = prev.map(c => (c.id === childId ? { ...c, isChecked: checked } : c));
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
        return;
      } else {
        setFile(selectedFile);
      }
    }
  }

  async function handleDelete(fileId : string) {
    try {
      await axios.delete(`http://localhost:3000/files/${fileId}`);
      getKMZList();
    } catch (error) {
      console.log(error);
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



      const list = await getKMZList();

      const newItem =
        (data?.fileId && list?.find(x => x.id === data.fileId)) || //Search for new file
        list?.find(x => x.name === file.name) ||
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

      
      const childrenLayer : Children[] = layers.map((l : any) => {
        return ({
          id: l.id, 
          name:  l.name,
          isChecked: true
        }) 
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
          <h4> Stored Queries </h4>
          <ul className="List-wrapper">
            {layerList && layerList.length > 0
              ? layerList.map((l) => {
                  const isOpen = openLayer === l.id;
                  return (
                    <>
                      <li
                      className={`List-item ${isOpen ? "is-open": ""}`}
                      key={l.id}
                    
                      
                      role="button"
                      aria-expanded={isOpen}
                      aria-controls={`panel-${l.id}`}
            
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        updateMapView(l.id)
                      }>
                      
                        <div className="List-data">
                          <p> 
                            <span className={`caret ${isOpen ? "down" : ""}`} aria-hidden />
                            {shortenName(l.name)} 
                          </p>

                          <div className="List-actions">
                            <button
                              className="List-view"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMapView(l.id);
                                // toggleOpen(l.id); // Handle TOggle
                              }}
                            >
                              View
                            </button>
                            <button
                              className="List-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(l.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        

                        
                        
                        {/* DROP DOWN */}
                        {isOpen && (
                         <div className="List-dropdown" id={`panel-${l.id}`}> 
                            { openLayerChildren ? 
                              openLayerChildren.map((child) => {
                                return (
                                  <>
                                    <div className="Content">
                                      <input
                                        type="checkbox"
                                        id={`child-${child.id}`}
                                        checked={child.isChecked}
                                        onChange={(e) => {
                                          console.log(`${child.name} toggled:`, e.target.checked);
                                          e.stopPropagation();
                                          toggleChildCheckbox(child.id, e.target.checked);
                                        }}
                                        style={{cursor: "pointer", margin: "0 10px"}}
                                      />
                                      <label htmlFor={`child-${child.id}`}>{child.name}</label>
                                    </div>
                                  </>
                                );
                              })
                            : null
                            }
                         </div> 
                        )}

                      </li>
                      
                    </>
                    
                  );
                })
              : null}
          </ul>
        </div>
      </div>
    </>
  );
}
