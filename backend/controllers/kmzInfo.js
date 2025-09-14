import { PGISPool } from "../database.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";

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
    console.log("getKmzInfo error: ", e)

  } finally {
    client.release();
  }
}

export async function updateFileHash(kmzId, filePath) {
  const kmzBytes = await fs.readFile(filePath);
  const sha256 = crypto.createHash("sha256").update(kmzBytes).digest("hex");
  const client = await PGISPool.connect();
  try {
    const q = `
      UPDATE "KMZ_INFO"
      SET sha256 = $1,
        data = $2
      WHERE id = $3
    `;
    const { rows } = await client.query(q, [sha256, kmzBytes, kmzId]);
    return rows;
  } catch (e) {
    console.log("updateFileHash error: ", e)
  } finally {
    client.release();
  }
}
