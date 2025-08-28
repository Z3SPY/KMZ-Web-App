import express from "express";
import gdal from "gdal-async";
import cors from "cors";
import { layerRoutes } from "./routes/layers.js";
import { featureRoutes } from "./routes/features.js";
import { testRoutes } from "./routes/test.js";
import { filesRoutes } from "./routes/files.js";



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
// Routes
// ===================
app.use("/files", filesRoutes);
app.use("/layers", layerRoutes);
app.use("/features", featureRoutes);
app.use("/test", testRoutes);


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



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
