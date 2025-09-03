import { PGISPool } from "../database.js";

/** 
* @param {string[]} ids - Array of feature UUIDs
* @param {object} fields - Fields to update (layer_id, props, etc.)
* @returns {Promise<number>} Number of updated rows
*/

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

export async function updateFeatures(updates) {
    const q = `
      WITH data AS (
        SELECT
          (elem->>'id')::uuid                                      AS id,
          ST_SetSRID(ST_GeomFromGeoJSON(elem->>'geometry'), 4326)  AS geom,
          CASE WHEN elem ? 'properties' THEN (elem->'properties')::jsonb END AS props
        FROM jsonb_array_elements($1::jsonb) AS elem
      )
      UPDATE "FEATURES" f
      SET
        geom       = d.geom,
        props      = COALESCE(d.props, f.props),
        updated_at = NOW()
      FROM data d
      WHERE f.id = d.id
      RETURNING f.id;
    `;

    const client = await PGISPool.connect();

    try {
      await client.query("BEGIN");
      const { rows } = await client.query(q, [JSON.stringify(updates)]);
      await client.query("COMMIT");

      const updated = rows.map(r => r.id);
      const notFound = updates.map(u => u.id).filter(id => !updated.includes(id));
      return { updated: updated.length, notFound };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
}



