import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import yazl from "yazl";

function ensureArraySlot(parent, key, i) {
  let arr = parent[key];
  if (!arr) parent[key] = arr = [];
  if (!Array.isArray(arr)) parent[key] = arr = [arr];
  while (arr.length <= i) arr.push({});
  return arr[i];
}


// write coords into the correct KML node
function setPlacemarkCoords(pm, type, idx, coordText) {
  // MultiGeometry
  if (pm?.MultiGeometry) {
    const mg = pm.MultiGeometry;

    if (type === "LineString" || type === "Point") {
      const node = ensureArraySlot(mg, type, idx);
      node.coordinates = coordText;
      return true;
    }

    if (type === "Polygon") {
      const poly = ensureArraySlot(mg, "Polygon", idx);
      poly.outerBoundaryIs ??= {};
      poly.outerBoundaryIs.LinearRing ??= {};
      poly.outerBoundaryIs.LinearRing.coordinates = coordText; // outer ring
      return true;
    }
    return false;
  }

  // Geometry and Placemark 
  if ((type === "LineString" || type === "Point") && pm?.[type]) {
    if (Array.isArray(pm[type])) {
      const node = ensureArraySlot(pm, type, idx);
      node.coordinates = coordText;
    } else {
      pm[type].coordinates = coordText;
    }
    return true;
  }

  if (type === "Polygon" && pm?.Polygon) {
    const poly = Array.isArray(pm.Polygon) ? ensureArraySlot(pm, "Polygon", idx) : pm.Polygon;
    poly.outerBoundaryIs ??= {};
    poly.outerBoundaryIs.LinearRing ??= {};
    poly.outerBoundaryIs.LinearRing.coordinates = coordText;
    return true;
  }

  return false;
}

function findAndReplace(root, placemarkName, type, idx, coordText) {
  if (!root || typeof root !== "object") return false;

  // If this node looks like a Placemark
  if (root.name === placemarkName && (root.MultiGeometry || root[type] || root.Polygon)) {
    return setPlacemarkCoords(root, type, idx, coordText);
  }

  // Otherwise, recurse into children
  for (const k of Object.keys(root)) {
    const v = root[k];
    if (v && typeof v === "object") {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (findAndReplace(item, placemarkName, type, idx, coordText)) return true;
        }
      } else {
        if (findAndReplace(v, placemarkName, type, idx, coordText)) return true;
      }
    }
  }
  return false;
}


function createKMZ(kml, outPath, filename = "doc.kml") {
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    const outStream = fs.createWriteStream(outPath);

    zipfile.addReadStreamLazy(filename, (cb) => {
      cb(null, Readable.from([kml]));
    });

    zipfile.outputStream
      .pipe(outStream)
      .on("finish", () => resolve(outPath))
      .on("error", reject);

    zipfile.end();
  });
}

export async function inject(kmlFile, dbData, id) {
  const options = {
    ignoreAttributes: false,
    isArray: (name, jpath) =>
      jpath?.includes("Placemark") &&
      (name === "LineString" || name === "Point" || name === "Polygon" || name === "Placemark")
  };

  const parser = new XMLParser(options);
  const kmlData = parser.parse(kmlFile);

  for (const layer of dbData) {
    if (layer.features.length > 0) {
      for (const features of layer.features) {
        const feature_name = features.props.Name;
        if (features.geom.geometries) {
          let counter = 0;
          for (const geom of features.geom.geometries) {
            const t = geom?.type;
            if (!t) continue;

            if (t === "Point") {
              const coordText = (geom.coordinates || []).join(",");
              findAndReplace(kmlData, feature_name, "Point", counter++, coordText);
            } else if (t === "LineString") {
              const coordText = (geom.coordinates || []).map(c => c.join(",")).join(" ");
              findAndReplace(kmlData, feature_name, "LineString", counter++, coordText);
            } else if (t === "Polygon") {
              const outer = (geom.coordinates || [])[0] || [];
              const coordText = outer.map(c => c.join(",")).join(" ");
              findAndReplace(kmlData, feature_name, "Polygon", counter++, coordText);
              // (Optional: handle inner rings later via innerBoundaryIs)
            } else if (t === "MultiLineString") {
              for (const part of (geom.coordinates || [])) {
                const coordText = (part || []).map(c => c.join(",")).join(" ");
                findAndReplace(kmlData, feature_name, "LineString", counter++, coordText);
              }
            }
          }
        } else {
          const G = features.geom;
          const t = G?.type;
          let counter = 0;

          if (t === "Point") {
            const coordText = (G.coordinates || []).join(",");
            findAndReplace(kmlData, feature_name, "Point", counter++, coordText);
          } else if (t === "LineString") {
            const coordText = (G.coordinates || []).map(c => c.join(",")).join(" ");
            findAndReplace(kmlData, feature_name, "LineString", counter++, coordText);
          } else if (t === "Polygon") {
            const outer = (G.coordinates || [])[0] || [];
            const coordText = outer.map(c => c.join(",")).join(" ");
            findAndReplace(kmlData, feature_name, "Polygon", counter++, coordText);
          } else if (t === "MultiLineString") {
            for (const part of (G.coordinates || [])) {
              const coordText = (part || []).map(c => c.join(",")).join(" ");
              findAndReplace(kmlData, feature_name, "LineString", counter++, coordText);
            }
          }
        }
      }
    }
  }
  const builder = new XMLBuilder(options);
  const kml = builder.build(kmlData);
  const folder = "temp";
  const filePath = path.join(folder, `${id}.kmz`);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  await createKMZ(kml, filePath)
    .then((file) => console.log("KMZ created"))
    .catch(console.error);
}
