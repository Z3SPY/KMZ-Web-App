import { PGISPool } from "../database.js";

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
