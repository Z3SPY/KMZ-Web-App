import { PGISPool } from "../database.js";
import dotenv from "dotenv";
dotenv.config();
import { v4 as uuidv4 } from "uuid";

export async function getLayers(fileId) {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");

    const layerList = await client.query(
      `SELECT id, name FROM "LAYERS" WHERE kmz_id = $1`,
      [fileId],
    );

    await client.query("COMMIT");
    return layerList.rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


export async function getOrCreateDefaultLayer(fileId) {
  const client = await PGISPool.connect();
  try {
    // validate file exists
    const exists = await client.query(`SELECT 1 FROM "FILES" WHERE id=$1`, [fileId]);
    if (!exists.rowCount) {
      const err = new Error(`fileId ${fileId} not found`);
      err.status = 400;
      throw err;
    }

    const find = await client.query(
      `SELECT id FROM "LAYERS" WHERE kmz_id = $1 AND name = 'Standalone' LIMIT 1`,
      [fileId]
    );
    if (find.rows[0]?.id) return find.rows[0].id;

    const newId = uuidv4();
    await client.query(
      `INSERT INTO "LAYERS" (id, name, kmz_id) VALUES ($1, $2, $3)`,
      [newId, "Standalone", fileId]
    );
    return newId;
  } finally {
    client.release();
  }
}