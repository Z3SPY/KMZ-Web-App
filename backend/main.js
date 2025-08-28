import express from "express";
import gdal from "gdal-async";
import { kmzToGeoJSON, listAllLayers } from "./test.js";
import { storeToDB } from "./database.js";
import cors from "cors";



// ===================
// MULTER STORAGE 
// ===================

// Store KMZ file then delete

import multer from "multer";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";


// Idk this could probably be simplified? maybe stored in a online storage or something?
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const uploadDir = path.join(__dirname, "uploads"); 
await fs.mkdir(uploadDir, { recursive: true }); // ensure it exists



// kmzToGeoJSON Path
function vsiPathForGdal(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".kmz")
    return `/vsizip/${filePath.startsWith("/") ? "" : "/"}${filePath}`; 
  return filePath;
}


//Handles Local Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const { name, ext } = path.parse(file.originalname); // ext = ".kmz" or ".kml"
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${name}-${unique}${ext}`); // <-- keeps ".kmz" at the end
  },
});


//Handle Upload
const upload = multer({ 
  storage,
  limits: {files: 1, fileSize: 200 * 1024 * 1024},
  fileFilter: (req, file, cb) => { //a function to control which files should be uploaded and which should be skipped
    const ext = path.extname(file.originalname).toLowerCase();
    ext === ".kml" || ext === ".kmz" ? cb(null, true) : cb(new Error("Only .kml/.kmz"));
  }
})


// ===================
// ===================


// Fix in prod
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

const app = express();
const port = 3000;

// ===================
// TEST PATHS
// ===================

/* all Layers: ["Temporary Places","الأماكن المؤقتة","4-1.kmz",
"قياس المسار  6   7.kmz","7-3.kmz","7-4.kmz","الأماكن المؤقتة","7-4.kmz","الأماكن المؤقتة","الأماكن المؤقتة"] */
const LAYER = "الأماكن المؤقتة";
const PATH = "./JED-HADA-FDH04_HADA FDH-4.kmz";
const ZIPPATH = `/vsizip//app/${PATH}/doc.kml`;

// ===================
// INIT EXPRESS
// ===================

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: false,
  }),
);

// Body parser
app.use(express.json());

// ===================
// POST REQEUSTS
// ===================

app.post("/data", (req, res) => {
  res.json({ received: req.body });
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file received (field must be 'file')." });
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
      if (!Array.isArray(layers)) throw new Error("listAllLayers did not return an array");
    } catch (err) {
      throw new Error("listAllLayers failed: " + (err instanceof Error ? err.message : String(err)));
    }

    const featuresArrays = await Promise.all(
      layers.map(async (layerName) => {
        try {
          const gj = await kmzToGeoJSON(filePath, layerName); 
          if (!gj || gj.type !== "FeatureCollection") throw new Error(`invalid FC for layer "${layerName}"`);
          return gj.features || [];
        } catch (err) {
          console.error(`Layer convert failed (${layerName}):`, err);
          return []; 
        }
      })
    );

    const features = featuresArrays.flat();
    const featureCollection = { type: "FeatureCollection", features };

    // DB store
    try {
      await storeToDB(filePath, [featureCollection]);
    } catch (e) {
      console.warn("storeToDB failed (continuing):", e);
    }

    return res.json({ ok: true, features: features.length, geojson: featureCollection });
  } catch (e) {

    const msg = e instanceof Error ? e.message : String(e);
    console.error("UPLOAD ERROR:", msg, e);
    return res.status(500).json({ ok: false, error: msg });

  } finally {
    try { if (req.file?.path) await fs.unlink(req.file.path); } catch (e) { console.warn("cleanup failed:", e); }
  }
});



// ===================
// GET REQEUSTS
// ===================

app.get("/", (req, res) => {
  console.log("yo");
  res.send("testes");
});

app.get("/convert", async (req, res) => {
  try {
    const gj = await kmzToGeoJSON(PATH, LAYER);
    res.json(gj.features); // Note this is case sensitive
    console.log(gj); // Logs full JSON in Docker
  } catch (e) {
    res.status(500).json({ error: String(e) });
    console.log("Conversion Failed");
  }
});

app.get("/list", async (req, res) => {
  try {
    const list = await listAllLayers(PATH);
    if (!list || list.length === 0) {
      return res.json({ type: "FeatureCollection", features: [] });
    }

    // For each layer name, run kmzToGeoJSON(PATH, layerName)
    const featureArray = await Promise.all(
      list.map(async (layerName) => {
        try {
          const gj = await kmzToGeoJSON(PATH, layerName);
          return gj.features || [];
        } catch (err) {
          console.error(`Failed to convert ladoyer ${layerName}:`, err);
          return []; // skip on error
        }
      }),
    );
    // Flatten all features into a single FeatureCollection
    const features = featureArray.flat();

    const featureCollection = {
      type: "FeatureCollection",
      features: features,
    };

    res.json(featureCollection);
    console.log(
      `Layers converted: ${list.length}, total features: ${features.length}`,
    );
  } catch (e) {
    res.status(500).json({ error: String(e) });
    console.log("List Failed");
  }
});


app.get("/store", async (req, res) => {
  try {
    const list = await listAllLayers(PATH);
    if (!list || list.length === 0) {
      return res.json({ type: "FeatureCollection", features: [] });
    }

    const featureCollections = await Promise.all(
      list.map(async (layerName) => {
        try {
          const gj = await kmzToGeoJSON(PATH, layerName);
          return gj;
        } catch (err) {
          console.error(`Failed to convert layer ${layerName}:`, err);
          return []; // skip on error
        }
      }),
    );
    storeToDB(PATH, featureCollections);

    res.json("stored");
  } catch (e) {
    // res.status(500).json({ error: String(e) });
    console.log("store failed: ", e);
  }
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
