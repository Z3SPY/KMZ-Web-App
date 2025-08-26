/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const { PgLiteral } = require("node-pg-migrate");
const up = (pgm) => {
  pgm.createTable("LAYERS", {
    id: { type: "uuid", notNull: true, primaryKey: true },
    name: { type: "name", notNull: true },
    srid: { type: "integer", notNull: true, default: 4326 },
    createdAt: {
      type: "timestamptz",
      notNull: true,
      default: new PgLiteral("current_timestamp"),
    },
  });
  pgm.createTable("FEATURES", {
    id: { type: "uuid", primaryKey: true },
    layer_id: {
      type: "uuid",
      notNull: true,
      references: "LAYERS",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    geom: { type: "geometry(POINT,4326)", notNull: true },
    props: { type: "jsonb", notNull: true },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: new PgLiteral("current_timestamp"),
    },
  });
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
const down = (pgm) => {
  pgm.dropTable("LAYERS", { ifExists: true, cascade: true });
  pgm.dropTable("FEATURES", { ifExists: true, cascade: true });
  pgm.dropTable("UPLOADS", { ifExists: true, cascade: true });
};

module.exports = { up, down };
