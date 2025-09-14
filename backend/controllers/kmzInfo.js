import { PGISPool } from "../database.js";

export async function getKmzInfo(featureId) {
  const client = await PGISPool.connect();
  try {
    const q = `
      SELECT k.id AS kmz_id, f.id AS file_id
      FROM "FEATURES" ft
      JOIN "LAYERS" l
        ON ft.layer_id = l.id
      JOIN "FILES" f
        ON l.kmz_id = f.id
      JOIN "KMZ_INFO" k
        ON f.id = k.file_id
      WHERE ft.id = $1
    `;
    const { rows } = await client.query(q, [featureId]);
    return rows;
  } catch (e) {
    console.log(e)

  } finally {
    client.release();
  }
}

export async function upadateFileHash() {

}
