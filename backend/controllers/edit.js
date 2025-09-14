import { getFileAsLayersAndFeatures } from "./files.js";
import { inject } from "../controllers/injector.js";
import { extractKMLFromKMZ, getFileData } from "./download.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function makeKmzFile(id) {
  const kmzFile = await getFileData(id);
  const dbData = await getFileAsLayersAndFeatures(id);
  const kmlFile = await extractKMLFromKMZ(kmzFile)
    .then((kml) => {
      return kml;
    })
    .catch(console.error);
  console.log("kml extracted");
  await inject(kmlFile, dbData, id);
  const filePath = path.join(__dirname, "..", "temp", `${id}.kmz`);
  return filePath;
}
