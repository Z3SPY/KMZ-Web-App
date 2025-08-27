import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Map from "../Pages/Map.js";
import React from "react";


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Map />
  </StrictMode>
);