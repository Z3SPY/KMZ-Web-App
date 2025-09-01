import { Router } from "express";
import { test } from "../controllers/injector.js";

export const injRoutes = Router();

injRoutes.get("/", async (req, res) => {
  test();
  res.send("Hello");
});
