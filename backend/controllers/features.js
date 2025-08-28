import { PGISPool } from "../database.js";

export async function getFeatures(layerId) {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");

    const featureList = await client.query(
      `SELECT id, geom::json, props FROM "FEATURES" WHERE layer_id = $1`,
      [layerId],
    );

    await client.query("COMMIT");
    return featureList.rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
