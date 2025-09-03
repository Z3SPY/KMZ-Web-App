import { PGISPool } from "../database.js";
import { getLayers } from "./layers.js";
import { getFeatures } from "./features.js";

export async function getFiles() {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");

    const filelist = await client.query(`SELECT id, name FROM "FILES"`);

    await client.query("COMMIT");
    return filelist.rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getFileAsLayersAndFeatures(fileId) {
  const layers = await getLayers(fileId);
  const result = [];

  for (const layer of layers) {
    const features = await getFeatures(layer.id);
    result.push({ id: layer.id, name: layer.name, features });
  }

  return result;
}

export async function getFileDataFromLayerID(layer_id) {
  const client = await PGISPool.connect();
  try {
    const { rows } = await client.query(
      `SELECT kmz_id FROM "LAYERS" WHERE id = $1`,
      [layer_id]
    );

    if (rows.length === 0 || !rows[0]?.kmz_id) return null;

    const fileId = rows[0].kmz_id;
    return await getFileAsLayersAndFeatures(fileId);
  } catch (error) {
    throw error; // no need for ROLLBACK on SELECT
  } finally {
    client.release();
  }
}


export async function getFilesWithLoc() {
  const client = await PGISPool.connect();
  try {
    const filelist = await client.query(
      `SELECT id, name, region, city, country FROM "FILES"`,
    );
    await client.query("COMMIT");
    return filelist.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteFile(id) {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM "FILES" WHERE id = $1`, [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
