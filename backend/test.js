// test.js (CJS)
const { ogr2ogr } = require("ogr2ogr");

const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);

async function kmzToGeoJSON(inputPath, layer) {
  const { data } = await ogr2ogr(inputPath, {
    format: "GeoJSON",
    options: ["-sql", `SELECT * FROM "${layer}"`],
  });

  return data;
}

async function listAllLayers(inputPath) {
  const { stdout } = await execAsync(`ogrinfo -ro -q -so "${inputPath}"`, {
    maxBuffer: 1024 * 1024 * 16,
  });
  console.log(stdout);

  const layers = [];

  //String Extract
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*\d+:\s+(.+?)(?:\s+\(|$)/);
    if (m) layers.push(m[1]);
  }

  console.log(layers);
  return layers;
}

module.exports = { kmzToGeoJSON, listAllLayers };
