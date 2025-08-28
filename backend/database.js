import { Pool } from "pg";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
dotenv.config();

export const PGISPool = new Pool();

export async function storeToDB(name, layers) {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");

    const kmzRes = await client.query(
      `INSERT INTO "FILES" (id, name) VALUES ($1, $2) RETURNING id`,
      [uuidv4(), name],
    );
    const kmzId = kmzRes.rows[0].id;

    for (const layer of layers) {
      if (!layer || layer.length === 0) continue;

      const layerRes = await client.query(
        `INSERT INTO "LAYERS" (id, name, kmz_id) VALUES ($1, $2, $3) RETURNING id`,
        [uuidv4(), layer.name, kmzId],
      );
      const layerId = layerRes.rows[0].id;

      for (const feature of layer.features) {
        await client.query(
          `INSERT INTO "FEATURES" (id, layer_id, geom, props) VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4)`,
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

    client.release();
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    throw err;
  }
}
