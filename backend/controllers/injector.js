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
          // console.log(obj.name, ":::::::", name);
          for (let key2 in obj[key]) {
            for (let coor of obj[key][key2]) {
              coor.coordinates = 0;
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
          for (const coor of features?.geom?.coordinates || []) {
            const processed = coor.map((c) => c.join(",")).join(" ");
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
    "810b9514-6282-4bf2-be6a-0a5e07b9223a",
  );
  inject("./uploads/ABH-ARIN-FDH-06.kml", dbData);
}
