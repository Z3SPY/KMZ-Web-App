import { Router } from "express";
import {
  getFiles,
  getFileAsLayersAndFeatures,
  deleteFile,
} from "../controllers/files.js";

export const filesRoutes = Router();

filesRoutes.get("/", async (req, res) => {
  const files = await getFiles();
  console.log("---------");
  console.log("FILES: ", files);
  console.log("---------");
  res.json(files);
});

filesRoutes.get("/:id/mapview", async (req, res) => {
  try {
    const data = await getFileAsLayersAndFeatures(req.params.id);
    res.json({ ok: true, layers: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

filesRoutes.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await deleteFile(id);
    res.sendStatus(200);
  } catch (error) {
    console.warn("Delete file error: ", error);
    res.sendStatus(500);
  }
});
