import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import fs from "fs";
import { getFileAsLayersAndFeatures } from "./files.js";
import { features } from "process";

// const kmlFile = "./uploads/ABH-ARIN-FDH-06.kml";
// const awsFile = "./uploads/aws.kml";
// const kmlContent = fs.readFileSync(kmlFile, "utf-8");

// const options = {
//   ignoreAttributes: false,
// };
// const parser = new XMLParser(options);
// const kmlData = parser.parse(kmlContent);

function findAndReplace(obj, name, newValue) {
  const targetKey = "MultiGeometry";
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      findAndReplace(obj[i], name, newValue);
    }
  } else if (obj !== null && typeof obj === "object") {
    for (let key in obj) {
      if (key === targetKey) {
        if (obj.name === name) {
          for (let key2 in obj[key]) {
            console.log(obj[key][key2]);
            let items = obj[key][key2];
            if (!Array.isArray(items)) {
              items = [items];
            }
            for (let coor of items) {
              coor.coordinates = newValue;
            }
          }
        }
      } else {
        findAndReplace(obj[key], name, newValue);
      }
    }
  }
}
export async function inject(kmlFile, dbData) {
  const kmlContent = fs.readFileSync(kmlFile, "utf-8");

  const options = {
    ignoreAttributes: false,
  };
  const parser = new XMLParser(options);
  const kmlData = parser.parse(kmlContent);

  for (const layer of dbData) {
    if (layer.features.length > 0) {
      for (const features of layer.features) {
        const feature_name = features.props.Name;
        if (features.geom.geometries) {
          for (const geom of features.geom.geometries) {
            const c = [];
            for (const coor of geom.coordinates || []) {
              c.push(coor.join(","));
            }
            const processed = c.join(" ");
            findAndReplace(kmlData, feature_name, processed);
          }
        } else {
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
            }
            findAndReplace(kmlData, feature_name, processed);
          }
        }
      }
    }
  }
  const builder = new XMLBuilder(options);
  const kml = builder.build(kmlData);
  fs.writeFileSync("kml.kml", kml, "utf-8");
}
export async function test() {
  const dbData = await getFileAsLayersAndFeatures(
    "62ad4c2a-829f-485c-bee0-81ea9315f9d9",
  );
  inject("./uploads/ABH-ARIN-FDH-06.kml", dbData);
}
