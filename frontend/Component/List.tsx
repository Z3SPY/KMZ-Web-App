import axios from "axios";
import React from "react";
import { useEffect, useState } from "react";
import tokml from "geojson-to-kml";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import JSZip from "jszip";

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
};

export const List = ({
  updateMapView,
  getKMZList,
  toggleChildCheckbox,
  openLayerChildren,
  layerList,
  openLayer,
  exportFC,
}: ListProps) => {
  // Impossible To Keep Styles (View Only)
  async function downloadKMZ(fc: FeatureCollection, name: string) {
    const kml = tokml(fc as any, {
      name: "name",
      description: "description",
      simplestyle: true,
    });
    const zip = new JSZip();
    zip.file("doc.kml", kml); // KMZ expects 'doc.kml'
    const kmzBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([kmzBlob], { type: "application/vnd.google-earth.kmz" }),
    );
    a.download = `${name}(Copy).kmz`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function shortenName(name: string, maxLength = 25) {
    if (name.length <= maxLength) return name;
    const start = name.slice(0, 10); // first part
    const end = name.slice(-10); // last part
    return `${start}...${end}`;
  }

  async function handleDelete(fileId: string) {
    try {
      await axios.delete(`http://localhost:3000/files/${fileId}`);
      getKMZList();
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
                                    <div className="Content">
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
                                downloadKMZ(exportFC, l.name);
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
