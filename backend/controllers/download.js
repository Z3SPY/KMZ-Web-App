import { PGISPool } from "../database.js";
import path from "path";
import yauzl from "yauzl";
import { getFileAsLayersAndFeatures } from "./files.js";
import { inject } from "../controllers/injector.js";
import { fileURLToPath } from "url";
import { writeFile } from "fs/promises";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getFileData(fileId) {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");

    const file = await client.query(
      `SELECT data,content_type FROM "KMZ_INFO" WHERE file_id = $1`,
      [fileId],
    );

    await client.query("COMMIT");
    return file.rows[0].data;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

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

export async function getFileToDownload(id) {
  const kmzFile = await getFileData(id);

  const filePath = path.join("temp", `${id}.kmz`);
  if (!fs.existsSync("temp")) {
    fs.mkdirSync(folder, { recursive: true });
  }

  try {
    await writeFile(filePath, Buffer.from(kmzFile));
    console.log(`File saved to ${filePath}`);
  } catch (err) {
    console.error("Error saving file:", err);
  }
  return filePath
}
