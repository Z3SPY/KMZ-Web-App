import { Router } from "express";
import { getFileToDownload } from "../controllers/download.js";
import fs from "fs";

export const downloadRoutes = Router();

downloadRoutes.get("/:id", async (req, res) => {
  const { id } = req.params;
  const filePath = await getFileToDownload(id);

  res.download(filePath, (err) => {
    if (err) {
      console.error("Download error:", err);
      return res.status(500).send("Failed to download file.");
    }

    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Error deleting file:", unlinkErr);
      } else {
        console.log("File deleted successfully!");
      }
    });
  });
});
