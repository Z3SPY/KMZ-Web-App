const express = require("express");
const gdal = require("gdal-async");

const app = express();
const port = 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("testing");
});

app.post("/data", (req, res) => {
  res.json({ received: req.body });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
