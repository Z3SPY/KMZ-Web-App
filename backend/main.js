import express from "express";
import gdal from "gdal-async";
import { kmzToGeoJSON, listAllLayers } from "./test.js";
import { dbInit } from "./database.js";

const app = express();
const port = 3000;

const LAYER = "الأماكن المؤقتة";
const PATH = "./JED-HADA-FDH04_HADA FDH-4.kmz";
const ZIPPATH = `/vsizip//app/${PATH}/doc.kml`;

dbInit();

app.use(express.json());

app.get("/", (req, res) => {
  console.log("yo");
  res.send("testes");
});

app.post("/data", (req, res) => {
  res.json({ received: req.body });
});

app.get("/convert", async (_req, res) => {
  try {
    const gj = await kmzToGeoJSON(PATH, LAYER);
    res.json(gj.features); // Note this is case sensitive
    console.log(gj); // Logs full JSON in Docker
  } catch (e) {
    res.status(500).json({ error: String(e) });
    console.log("Conversion Failed");
  }
});

app.get("/list", async (_req, res) => {
  try {
    const list = await listAllLayers(PATH);
    res.json(list);
    console.log(list);
  } catch (e) {
    res.status(500).json({ error: String(e) });
    console.log("List Failed");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
