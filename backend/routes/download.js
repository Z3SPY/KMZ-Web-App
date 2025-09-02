import { Router } from "express";
import { getFileData } from "../controllers/download.js";
import { inject } from "../controllers/injector.js";
import { getFileAsLayersAndFeatures } from "../controllers/files.js";
import yauzl from "yauzl";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const downloadRoutes = Router();

downloadRoutes.get("/:id", async (req, res) => {
  const { id } = req.params;

  const kmzFile = await getFileData(id);
  const dbData = await getFileAsLayersAndFeatures(id);
  const kmlFile = await extractKMLFromKMZ(kmzFile)
    .then((kml) => {
      return kml;
    })
    .catch(console.error);
  console.log("kml extracted");
  inject(kmlFile, dbData, id);
  const filePath = path.join(__dirname, "..", "temp", `${id}.kmz`);
  // res.send("Hello");
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(500).send("Could not send KMZ file");
    }
  });
});

function extractKMLFromKMZ(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (/\.kml$/i.test(entry.fileName)) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);

            let chunks = [];
            readStream.on("data", (chunk) => chunks.push(chunk));
            readStream.on("end", () => {
              resolve(Buffer.concat(chunks).toString("utf8"));
              zipfile.close();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on("end", () =>
        reject(new Error("No KML file found inside KMZ")),
      );
    });
  });
}
