import { Router } from "express";
import { getFiles } from "../controllers/files.js";

export const filesRoutes = Router();

filesRoutes.get("/", async (req, res) => {
  const files = await getFiles();
  console.log("---------");
  console.log("FILES: ", files);
  console.log("---------");
  res.json(files);
});
