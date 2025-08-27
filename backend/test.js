import { ogr2ogr } from "ogr2ogr";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

export async function kmzToGeoJSON(inputPath, layer) {
  const { data } = await ogr2ogr(inputPath, {
    format: "GeoJSON",
    options: ["-sql", `SELECT * FROM "${layer}"`],
  });

  return data;
}

export async function listAllLayers(inputPath) {
  const { stdout } = await execAsync(`ogrinfo -ro -q -so "${inputPath}"`, {
    maxBuffer: 1024 * 1024 * 16,
  });

  console.log("==STDOUT==");
  console.log(stdout);
  console.log("==========");

  const layers = [];

  //String Extract
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*\d+:\s+(.+?)(?:\s+\(|$)/);
    if (m) layers.push(m[1]);
  }

  console.log("==LAYERS==");
  console.log(layers);
  console.log("==========");
  return layers;
}
