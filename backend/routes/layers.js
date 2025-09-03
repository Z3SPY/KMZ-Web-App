import { Router } from "express";
import { getLayers } from "../controllers/layers.js";

export const layerRoutes = Router();

layerRoutes.get("/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const layers = await getLayers(fileId);
  res.json(layers);
});
