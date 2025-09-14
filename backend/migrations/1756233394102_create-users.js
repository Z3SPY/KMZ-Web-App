/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
import { PgLiteral } from "node-pg-migrate";
export const up = (pgm) => {

  pgm.sql(`CREATE EXTENSION IF NOT EXISTS postgis;`);

  /** FILE TABLE  */
  pgm.createTable("FILES", {
    id: { type: "uuid", notNull: true, primaryKey: true },
    name: { type: "text", notNull: true },
    region: { type: "text", notNull: true },
    city: { type: "text", notNull: true },
    postcode: { type: "text", notNull: false },
    country: { type: "text", notNull: true },
    uploadedAt: {
      type: "timestamptz",
      notNull: true,
      default: new PgLiteral("current_timestamp"),
    },
  });

  /** LAYERS TABLE  */
  pgm.createTable("LAYERS", {
    id: { type: "uuid", notNull: true, primaryKey: true },
    name: { type: "text", notNull: true },
    srid: { type: "integer", notNull: true, default: 4326 },
    kmz_id: {
      type: "uuid",
      notNull: true,
      references: "FILES",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    createdAt: {
      type: "timestamptz",
      notNull: true,
      default: new PgLiteral("current_timestamp"),
    },
  });

  /** FEATURES TABLE  */
  pgm.sql(`
    CREATE TABLE "FEATURES" (
      "id" uuid PRIMARY KEY,
      "layer_id" uuid NOT NULL REFERENCES "LAYERS" ON DELETE CASCADE ON UPDATE CASCADE,
      "geom" GEOMETRY(GEOMETRYZ, 4326) NOT NULL,
      "props" jsonb NOT NULL,
      "updated_at" timestamptz DEFAULT current_timestamp NOT NULL
    );
  `);

  pgm.sql(`
    ALTER TABLE "FEATURES"
    ALTER COLUMN geom TYPE geometry(Geometry, 4326)
    USING geom;
  `);


  /** UPLOAD (On stand by? dunno if its being used?) */
  pgm.createTable("UPLOADS", {
    id: { type: "uuid", primaryKey: true },
    layer_id: {
      type: "uuid",
      notNull: false,
      references: "LAYERS",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    filename: { type: "text", notNull: true },
    status: { type: "text", notNull: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: new PgLiteral("current_timestamp"),
    },
    started_at: {
      type: "timestamptz",
      notNull: false,
    },
    finished_at: {
      type: "timestamptz",
      notNull: false,
    },
  });

  pgm.createTable("KMZ_INFO", {
    id: { type: "uuid", primaryKey: true, notNull: true },
    file_id: {
      type: "uuid", notNull: true, references: "FILES", /** // For Version Control */
      onDelete: "CASCADE", onUpdate: "CASCADE" /**DELETE Corresponding FIles */
    },
    data: { type: "bytea", notNull: true }, // KMZ Files Here
    size_bytes: { type: "bigint", notNull: true },
    sha256: { type: "text", notNull: true, unique: true },
    content_type: { type: "text", notNull: true, default: "application/vnd.google-earth.kmz" },
    uploaded_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("FILES", { ifExists: true, cascade: true });
  pgm.dropTable("LAYERS", { ifExists: true, cascade: true });
  pgm.dropTable("FEATURES", { ifExists: true, cascade: true });
  pgm.dropTable("UPLOADS", { ifExists: true, cascade: true });
  pgm.dropTable("KMZ_INFO", { ifExists: true, cascade: true });
  pgm.sql(`
    ALTER TABLE "FEATURES"
    ALTER COLUMN geom TYPE geometry(GeometryZ, 4326)
    USING ST_Force3DZ(geom);
  `);

};
