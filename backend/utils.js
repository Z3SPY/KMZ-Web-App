import { ogr2ogr } from "ogr2ogr";
import { promisify } from "util";
import { exec } from "child_process";
import path from "path";

const execAsync = promisify(exec);

function gdalPath(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".kmz") {
    const abs = p.startsWith("/") ? p : `/${p}`;
    return `/vsizip//${abs}/doc.kml`;
  }
  return p;
}
export async function kmzToGeoJSON(inputPath, layer) {
  const { data } = await ogr2ogr(gdalPath(inputPath), {
    format: "GeoJSON",
    options: ["-sql", `SELECT * FROM "${layer}"`],
  });

  return data;
}

export async function listAllLayers(inputPath) {
  const src = gdalPath(inputPath);
  console.log(src);
  const { stdout } = await execAsync(`ogrinfo -ro -q -so "${src}"`, {
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
