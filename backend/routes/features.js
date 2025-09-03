import { Router } from "express";
import { getFeatures, updateFeatures, addGeometryToFeature } from "../controllers/features.js";
import { PGISPool } from "../database.js";
import { getFileDataFromLayerID } from "../controllers/files.js";

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
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});


featureRoutes.patch("/attach", async (req, res, next) => {
  try {

    const {id, geometry, mode} = req?.body;
    console.log(req.body);
    if (!id || !geometry || geometry.coordinates.length === 0)  {
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

