import axios from "axios";
import React from "react";
import { useEffect, useState } from "react";
import tokml from "geojson-to-kml";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import JSZip from "jszip";
import type { UploadStatus } from "./Floating";

type KmzFile = {
  id: string;
  name: string;
};

type Children = {
  id: string;
  name: string;
  isChecked: boolean;
};

type ListProps = {
  updateMapView: (id: string) => void;
  getKMZList: () => void;
  toggleChildCheckbox: (id: string, e: boolean) => void;
  openLayerChildren: Children[] | null;
  layerList: KmzFile[] | null;
  openLayer: string | null;
  exportFC: FeatureCollection;
  setStatus: (a : UploadStatus) => void;
};

export const List = ({
  updateMapView,
  getKMZList,
  toggleChildCheckbox,
  openLayerChildren,
  layerList,
  openLayer,
  exportFC,
  setStatus
}: ListProps) => {
  // Impossible To Keep Styles (View Only)
  async function downloadKMZ(fileId: string, fileName: string) {
    try {
      setStatus("downloading");

      const response = await axios.get(
        `http://localhost:3000/download/${fileId}`,
        {
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      link.setAttribute("download", `${fileName}`);
      document.body.appendChild(link);
      link.click();

      link.remove();
      

      window.URL.revokeObjectURL(url);
      setTimeout(() => { setStatus("idle")}, 2000); // tempo

    } catch (error) {
      console.error("Download failed:", error);
    }
    
  }

  function shortenName(name: string, maxLength = 25) {
    if (name.length <= maxLength) return name;
    const start = name.slice(0, 10); // first part
    const end = name.slice(-10); // last part
    return `${start}...${end}`;
  }

  async function handleDelete(fileId: string) {

    if (!confirm("Delete this file?")) return;

    try {
      await axios.delete(`http://localhost:3000/files/${fileId}`);

      const wasOpen = openLayer === fileId;


      getKMZList();

      window.dispatchEvent(
        new CustomEvent("kmz:changed", {
          detail: { fileId: wasOpen ? null : openLayer }
        })
      );

      
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    getKMZList();
  }, []);
  return (
    <>
      <div className="List">
        <h4> Stored Queries </h4>
        <ul className="List-wrapper">
          {layerList && layerList.length > 0
            ? layerList.map((l) => {
                const isOpen = openLayer === l.id;
                return (
                  <>
                    <li
                      className={`List-item ${isOpen ? "is-open" : ""}`}
                      key={l.id}
                      role="button"
                      aria-expanded={isOpen}
                      aria-controls={`panel-${l.id}`}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        updateMapView(l.id)
                      }
                    >
                      <div className="List-data">
                        <p>
                          <span
                            className={`caret ${isOpen ? "down" : ""}`}
                            aria-hidden
                          />
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
                          {openLayerChildren
                            ? openLayerChildren.map((child) => {
                                return (
                                  <>
                                    <div
                                      className="Content"
                                      id={`Content-${child.id}`}
                                    >
                                      <input
                                        type="checkbox"
                                        id={`child-${child.id}`}
                                        checked={child.isChecked}
                                        onChange={(e) => {
                                          console.log(
                                            `${child.name} toggled:`,
                                            e.target.checked,
                                          );
                                          e.stopPropagation();
                                          toggleChildCheckbox(
                                            child.id,
                                            e.target.checked,
                                          );
                                        }}
                                        style={{
                                          cursor: "pointer",
                                          margin: "0 10px",
                                        }}
                                      />
                                      <label htmlFor={`child-${child.id}`}>
                                        {child.name}
                                      </label>
                                    </div>
                                  </>
                                );
                              })
                            : null}

                          {exportFC && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadKMZ(l.id, l.name);
                              }}
                            >
                              Download Copy {/** Remove If Bad */}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  </>
                );
              })
            : null}
        </ul>
      </div>
    </>
  );
};
