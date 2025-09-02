import { PGISPool } from "../database.js";
import dotenv from "dotenv";
dotenv.config();

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
