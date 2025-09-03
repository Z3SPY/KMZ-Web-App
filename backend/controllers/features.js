import { PGISPool } from "../database.js";

/**
 * @param {string[]} ids - Array of feature UUIDs
 * @param {object} fields - Fields to update (layer_id, props, etc.)
 * @returns {Promise<number>} Number of updated rows
 */

export async function getFeatures(layerId) {
  const client = await PGISPool.connect();
  try {
    const q = `
      SELECT id,
             ST_AsGeoJSON(ST_CurveToLine(ST_MakeValid(geom)))::json AS geom,
             props
      FROM "FEATURES"
      WHERE layer_id = $1
    `;
    const { rows } = await client.query(q, [layerId]);
    return rows;
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

    const updated = rows.map((r) => r.id);
    const notFound = updates
      .map((u) => u.id)
      .filter((id) => !updated.includes(id));
    return { updated: updated.length, notFound };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}


export async function addGeometryToFeature(id, newGeometry, mode) {
  const client = await PGISPool.connect();
  try {
    // detect the target feature’s dimensionality
    const { rows } = await client.query(
      `SELECT ST_NDims(geom) AS dims FROM "FEATURES" WHERE id = $1`,
      [id]
    );
    if (!rows.length) throw new Error(`Feature ${id} not found`);
    const dims = rows[0].dims; // 2 or 3

    const composer = mode === 'collect' ? 'ST_Collect' : 'ST_Union';


    const incoming = (dims >= 3)
      ? `ST_Force3DZ(ST_CurveToLine(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326))))`
      : `ST_CurveToLine(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)))`;

    const base     = (dims >= 3)
      ? `ST_Force3DZ(ST_CurveToLine(ST_MakeValid(geom)))`
      : `ST_CurveToLine(ST_MakeValid(geom))`;

    const sql = `
      UPDATE "FEATURES"
      SET geom = ST_CollectionHomogenize(
                   ST_UnaryUnion(${composer}(${base}, ${incoming}))
                 ),
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, layer_id, ST_AsGeoJSON(geom) AS geom_json
    `;

    const r = await client.query(sql, [JSON.stringify(newGeometry), id]);
    return { ok: true, id: r.rows[0].id, layer_id: r.rows[0].layer_id, geom: JSON.parse(r.rows[0].geom_json) };
  } finally {
    client.release();
  }
}

