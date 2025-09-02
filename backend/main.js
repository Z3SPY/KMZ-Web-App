import express from "express";
import gdal from "gdal-async";
import cors from "cors";
import { layerRoutes } from "./routes/layers.js";
import { featureRoutes } from "./routes/features.js";
import { testRoutes } from "./routes/store.js";
import { filesRoutes } from "./routes/files.js";
import { uploadRoutes } from "./routes/upload.js";
import { injRoutes } from "./routes/injector.js";
import { downloadRoutes } from "./routes/download.js";

// Fix in prod
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

const app = express();
const port = 3000;

// ===================
// INIT EXPRESS
// ===================

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: false,
  }),
);

// Body parser
app.use(express.json());

// ===================
// Routes
// ===================
app.use("/files", filesRoutes);
app.use("/layers", layerRoutes);
app.use("/features", featureRoutes);
app.use("/test", testRoutes);
app.use("/upload", uploadRoutes);
app.use("/injector", injRoutes);
app.use("/download", downloadRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
