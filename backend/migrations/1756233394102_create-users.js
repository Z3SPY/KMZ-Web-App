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
  pgm.createTable("FILES", {
    id: { type: "uuid", notNull: true, primaryKey: true },
    name: { type: "text", notNull: true },
    uploadedAt: {
      type: "timestamptz",
      notNull: true,
      default: new PgLiteral("current_timestamp"),
    },
  });
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
  pgm.sql(`
    CREATE TABLE "FEATURES" (
      "id" uuid PRIMARY KEY,
      "layer_id" uuid NOT NULL REFERENCES "LAYERS" ON DELETE CASCADE ON UPDATE CASCADE,
      "geom" GEOMETRY(GEOMETRYZ, 4326) NOT NULL,
      "props" jsonb NOT NULL,
      "updated_at" timestamptz DEFAULT current_timestamp NOT NULL
    );
  `);
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
};
