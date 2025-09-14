import { Router } from "express";
import { kmzToGeoJSON, listAllLayers } from "../utils.js";
import { storeToDB } from "../database.js";

// ===================
// MULTER STORAGE
// ===================

// Store KMZ file then delete

import multer from "multer";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { warn } from "console";
import { handleDuplicate } from "../controllers/handleDuplicate.js";

export const uploadRoutes = Router();

// Idk this could probably be simplified? maybe stored in a online storage or something?
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "uploads");
await fs.mkdir(uploadDir, { recursive: true }); // ensure it exists

// kmzToGeoJSON Path
function vsiPathForGdal(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".kmz")
    return `/vsizip/${filePath.startsWith("/") ? "" : "/"}${filePath}`;
  return filePath;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const { name, ext } = path.parse(file.originalname); // ext = ".kmz" or ".kml"
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${name}-${unique}${ext}`); // <-- keeps ".kmz" at the end
  },
});

const upload = multer({
  storage,
  limits: { files: 1, fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    //a function to control which files should be uploaded and which should be skipped
    const ext = path.extname(file.originalname).toLowerCase();
    ext === ".kml" || ext === ".kmz"
      ? cb(null, true)
      : cb(new Error("Only .kml/.kmz"));
  },
});

/** HANDLE UPLOAD  */

uploadRoutes.post("/", upload.single("file"), async (req, res) => {
  // WE NEED TO CHECK IF ALREADY EXISTS THEN RETURN ERROR IF IT ALREADY DOES?
  // IDK how to ACCOMODATE FOR CHANGES
  // WHAT IF SOMEONE WANTED TO CHANGE REEDIT? A KMZ WITH THE

  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No file received (field must be 'file').",
      });
    }

    //Region / City Check
    const { region, city } = req.body || {};
    if (!region || !city) {
      return res
        .status(400)
        .json({ ok: false, error: "Region and City are required." });
    }

    const filePath = req.file.path;
    console.log("UPLOAD OK:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: filePath,
    });


    let layers = [];

    try {
      layers = await listAllLayers(filePath);
      if (!Array.isArray(layers))
        throw new Error("listAllLayers did not return an array");
    } catch (err) {
      throw new Error(
        "listAllLayers failed: " +
        (err instanceof Error ? err.message : String(err)),
      );
    }

    const featuresArrays = await Promise.all(
      layers.map(async (layerName) => {
        try {
          const gj = await kmzToGeoJSON(filePath, layerName);
          if (!gj || gj.type !== "FeatureCollection") {
            throw new Error(`invalid FC for layer "${layerName}"`);
          }

          return {
            name: String(layerName).trim(),
            features: gj.features || [],
          };
        } catch (err) {
          console.error(`Layer convert failed (${layerName}):`, err);
          return { name: String(layerName).trim(), features: [] };
        }
      }),
    );

    const features = featuresArrays.flatMap((x) => x?.features ?? []);
    const featureCollection = { type: "FeatureCollection", features };

    // DB store
    try {
      await storeToDB(
        filePath,
        req.file.originalname,
        featuresArrays,
        region,
        city,
        { sizeBytes: req.file.size, contentType: req.file.mimetype },
      );
      console.log("stored to db...")
    } catch (e) {
      console.warn("storeToDB failed (continuing):", e.code);
      // if error code is unique constraint violation
      console.log(e.code)
      if (e.code === "23505") {
        await handleDuplicate(e, res)
        return;
      }
      return res.status(500).json({
        ok: false,
        error: "Database error",
      });
    }

    return res.status(200).json({
      ok: true,
      features: features.length,
      geojson: featureCollection,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("UPLOAD ERROR:", msg, e);
    return res.status(500).json({ ok: false, error: msg });
  } finally {
    try {
      if (req.file?.path) await fs.unlink(req.file.path);
      //Handles Throw
      console.log("Finally Upload.js");
    } catch (e) {
      console.warn("cleanup failed:", e);
    }
  }
});
