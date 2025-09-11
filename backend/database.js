import { Pool } from "pg";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { getOneLoc } from "./controllers/location.js";
import fs from "node:fs/promises";
import crypto from "node:crypto";

dotenv.config();

export const PGISPool = new Pool();

export async function storeToDB(
  kmzpath,
  name,
  layers,
  region,
  city,
  meta = {},
) {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");

    let loc = null;
    try {
      loc = await getOneLoc(layers);
    } catch (e) { throw e }

    // Create Files Row
    const kmzRes = await client.query(
      `INSERT INTO "FILES" (id, name, region, city, postcode, country) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        uuidv4(),
        name,
        region,
        city,
        loc?.postcode ?? null,
        loc?.country ?? "UNKNOWN",
      ],
    );
    const kmzId = kmzRes.rows[0].id;

    const kmzBytes = await fs.readFile(kmzpath);
    const sizeBytes = meta.sizeBytes ?? kmzBytes.length;
    const contentType = meta.contentType ?? "application/vnd.google-earth.kmz";
    const sha256 = crypto.createHash("sha256").update(kmzBytes).digest("hex");

    try {
      if (!kmzBytes) return;
      await client.query(
        `INSERT INTO "KMZ_INFO"(id, file_id, data, size_bytes, sha256, content_type)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [kmzId, kmzBytes, sizeBytes, sha256, contentType],
      );
    } catch (e) {
      console.log(e);
      throw e
    }

    for (const layer of layers) {
      if (!layer || layer.length === 0) continue;

      const layerRes = await client.query(
        `INSERT INTO "LAYERS" (id, name, kmz_id) VALUES ($1, $2, $3) RETURNING id`,
        [uuidv4(), layer.name, kmzId],
      );
      const layerId = layerRes.rows[0].id;

      for (const feature of layer.features) {
        await client.query(
          `INSERT INTO "FEATURES" (id, layer_id, geom, props) 
              VALUES ($1, $2, ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($3)), 4326), $4)`, //Handles conversion
          [
            uuidv4(),
            layerId,
            JSON.stringify(feature.geometry),
            JSON.stringify(feature.properties || {}),
          ],
        );
      }
    }

    await client.query("COMMIT");
    return kmzId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
