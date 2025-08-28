import { Router } from "express";
import { kmzToGeoJSON, listAllLayers } from "../test.js";
import { storeToDB } from "../database.js";
export const testRoutes = Router();
// ===================
// TEST PATHS
// ===================

/* all Layers: ["Temporary Places","الأماكن المؤقتة","4-1.kmz",
"قياس المسار  6   7.kmz","7-3.kmz","7-4.kmz","الأماكن المؤقتة","7-4.kmz","الأماكن المؤقتة","الأماكن المؤقتة"] */
const LAYER = "الأماكن المؤقتة";
const PATH = "./JED-HADA-FDH04_HADA FDH-4.kmz";
const ZIPPATH = `/vsizip//app/${PATH}/doc.kml`;

// ===================
// POST REQEUSTS
// ===================

testRoutes.post("/data", (req, res) => {
  res.json({ received: req.body });
});

// ===================
// GET REQEUSTS
// ===================
//

testRoutes.get("/", (req, res) => {
  console.log("yo");
  res.send("testes");
});

testRoutes.get("/convert", async (req, res) => {
  try {
    const gj = await kmzToGeoJSON(PATH, LAYER);
    res.json(gj.features); // Note this is case sensitive
    console.log(gj); // Logs full JSON in Docker
  } catch (e) {
    res.status(500).json({ error: String(e) });
    console.log("Conversion Failed");
  }
});

testRoutes.get("/list", async (req, res) => {
  try {
    const list = await listAllLayers(PATH);
    if (!list || list.length === 0) {
      return res.json({ type: "FeatureCollection", features: [] });
    }

    // For each layer name, run kmzToGeoJSON(PATH, layerName)
    const featureCollections = await Promise.all(
      list.map(async (layerName) => {
        try {
          const gj = await kmzToGeoJSON(PATH, layerName);
          return gj.features || [];
        } catch (err) {
          console.error(`Failed to convert layer ${layerName}:`, err);
          return []; // skip on error
        }
      }),
    );
    // Flatten all features into a single FeatureCollection
    const allFeatures = featureCollections.flat();

    const featureCollection = {
      type: "FeatureCollection",
      features: allFeatures,
    };

    res.json(allFeatures);
    console.log(
      `Layers converted: ${list.length}, total features: ${allFeatures.length}`,
    );
  } catch (e) {
    res.status(500).json({ error: String(e) });
    console.log("List Failed");
  }
});

testRoutes.get("/store", async (req, res) => {
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
