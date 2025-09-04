import { PGISPool } from "../database.js";

export async function handleDuplicate(e, res) {
  switch (e.constraint) {
    case "KMZ_INFO_sha256_key":
      const fileName = await getDuplicateFile(e.detail)
      res.status(500).json({
        ok: false,
        error: `File Already Exist as ${fileName}`,
      });
      break;
    default:
      break;
  }
}


export async function getDuplicateFile(detail) {
  const match = detail.match(/\(sha256\)=\(([^)]+)\)/);
  const client = await PGISPool.connect();
  try {
    await client.query("BEGIN");
    const list = await client.query(`SELECT f.name FROM "KMZ_INFO" k JOIN "FILES" f ON k.file_id = f.id WHERE k.sha256 = $1`, [match[1]]);
    return list.rows[0].name;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

