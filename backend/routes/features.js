import { Router } from "express";
import { getFeatures } from "../controllers/features.js";

export const featureRoutes = Router();

featureRoutes.get("/:layerId", async (req, res) => {
  const { layerId } = req.params;
  console.log(layerId);
  const features = await getFeatures(layerId);
  res.json(features);
});
