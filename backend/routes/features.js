import { Router } from "express";
import { getFeatures, updateFeatures, addGeometryToFeature, createFeature } from "../controllers/features.js";
import { getFileDataFromLayerID } from "../controllers/files.js";
import { getOrCreateDefaultLayer } from "../controllers/layers.js";
import { getKmzInfo, upadateFileHash } from "../controllers/kmzInfo.js";
import { makeKmzFile } from "../controllers/download.js";
import fs from "fs";

export const featureRoutes = Router();

featureRoutes.get("/:layerId", async (req, res) => {
  const { layerId } = req.params;
  console.log(layerId);
  const features = await getFeatures(layerId);
  res.json(features);
});

// Feature Edit
featureRoutes.patch("/saveEdit", async (req, res, next) => {
  try {
    const updates = req.body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        error: "Body must be { updates: [{id, geometry[, properties]}] }",
      });
    }

    const result = await updateFeatures(updates);
    const kmzInfo = await getKmzInfo(updates[0].id)
    const filePath = await makeKmzFile(kmzInfo[0].file_id)
    await upadateFileHash(kmzInfo[0].kmz_id, filePath).finally(() => {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting file:", unlinkErr);
        } else {
          console.log("File deleted successfully!");
        }
      })
    })
    console.log("KMZ ID: ", kmzInfo[0].kmz_id)

    res.json({ ok: true, ...result });

  } catch (e) {
    next(e);
  } finally {
  }
});


featureRoutes.post("/create", async (req, res, next) => {
  try {
    const { layerId, fileId, geometry, properties = {} } = req.body || {};
    if (!geometry || !geometry.type || !geometry.coordinates) {
      return res.status(400).json({ ok: false, error: "Missing geometry" });
    }

    // resolve target layer
    let targetLayerId = layerId;
    if (!targetLayerId) {
      if (!fileId) {
        return res.status(400).json({ ok: false, error: "Provide layerId or fileId" });
      }
      targetLayerId = await getOrCreateDefaultLayer(fileId);
    }

    // 🔑 call the query
    const feature = await createFeature(targetLayerId, geometry, properties);

    // same refresh pattern as /attach
    const fc = await getFileDataFromLayerID(targetLayerId);
    if (!fc) {
      return res.status(404).json({ ok: false, error: `No file found for layer_id=${targetLayerId}` });
    }

    res.json({ ok: true, feature, updatedFeatureCollection: fc });
  } catch (e) {
    next(e);
  }
});




featureRoutes.patch("/attach", async (req, res, next) => {
  try {

    const { id, geometry, mode } = req?.body;
    console.log(req.body);
    if (!id || !geometry || geometry.coordinates.length === 0) {
      console.log(req.body);
      return res.status(400).json({
        error: "Missing required values, unable to add geometry",
      });
    }

    const result = await addGeometryToFeature(id, geometry, mode);

    if (result !== null) {
      const featureCollection = await getFileDataFromLayerID(result.layer_id);
      if (!featureCollection) {
        return res.status(404).json({
          ok: false,
          error: `No file found for layer_id=${layer_id}`,
        });
      }

      res.json({ ok: true, updatedFeatureCollection: featureCollection, result: `Add Geometry Status: ${result}` });
    }


  } catch (e) {
    next(e);
  }
});

