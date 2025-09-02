import { PGISPool } from "../database.js";

export async function getFileData(fileId) {
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");

    const file = await client.query(
      `SELECT data,content_type FROM "KMZ_INFO" WHERE file_id = $1`,
      [fileId],
    );

    await client.query("COMMIT");
    return file.rows[0].data;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
