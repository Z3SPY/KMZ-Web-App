import { XMLParser, XMLBuilder } from "fast-xml-parser";
import fs from "fs";
import path from "path";
import yazl from "yazl";

function findAndReplace(obj, name, newValue, counter) {
  const targetKey = "MultiGeometry";
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      findAndReplace(obj[i], name, newValue, counter);
    }
  } else if (obj !== null && typeof obj === "object") {
    for (let key in obj) {
      if (key === targetKey) {
        if (obj.name === name) {
          for (let key2 in obj[key]) {
            let items = obj[key][key2];
            if (!Array.isArray(items)) {
              items = [items];
            }
            items[counter].coordinates = newValue;
          }
        }
      } else {
        findAndReplace(obj[key], name, newValue, counter);
      }
    }
  }
}

function createKMZ(kml, outPath, filename = "doc.kml") {
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();

    const kmlBuffer = Buffer.from(kml, "utf8");
    if (!kmlBuffer.length) {
      return reject(new Error("KML string is empty!"));
    }
    zipfile.addBuffer(kmlBuffer, filename);

    const outStream = fs.createWriteStream(outPath);
    zipfile.outputStream.pipe(outStream);

    outStream.on("finish", () => {
      console.log("FINISHED");
      resolve(outPath);
    });
    outStream.on("error", reject);
    zipfile.end();
  });
}

export async function inject(kmlFile, dbData, id) {
  const options = {
    ignoreAttributes: false,
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
            const c = [];
            for (const coor of geom.coordinates || []) {
              c.push(coor.join(","));
            }
            const processed = c.join(" ");
            findAndReplace(kmlData, feature_name, processed, counter);
            counter++;
          }
        } else {
          let counter = 0;
          for (const coor of features.geom.coordinates || []) {
            let processed = "";
            if (features.geom.type === "Point") {
              processed = features.geom.coordinates.join(",");
            } else if (features.geom.type === "LineString") {
              processed = features.geom.coordinates
                .map((c) => c.join(","))
                .join(" ");
            } else if (features.geom.type === "Polygon") {
              processed = features.geom.coordinates
                .map((ring) => ring.map((c) => c.join(",")).join(" "))
                .join(" ");
            } else if (features.geom.type === "MultiLineString") {
              processed = coor.map((c) => c.join(",")).join(" ");
            }
            findAndReplace(kmlData, feature_name, processed, counter);
            counter++;
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
