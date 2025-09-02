import { Router } from "express";
import { getFeatures, updateFeatures } from "../controllers/features.js";
import { PGISPool } from "../database.js";

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
      return res.status(400).json({ error: "Body must be { updates: [{id, geometry[, properties]}] }" });
    }


    const result = await updateFeatures(updates);
    res.json({ ok: true, ...result });

    
  } catch (e) {
    next(e);
  }
});