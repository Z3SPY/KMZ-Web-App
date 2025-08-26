const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool();

async function dbInit() {
  const client = await pool.connect();

  // Create a table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT
    )
  `);

  // Insert
  await client.query("INSERT INTO users (name) VALUES ($1)", ["Alice"]);

  // Select
  const res = await client.query("SELECT * FROM users");
  console.log(res.rows);

  client.release();
}

module.exports = { dbInit };
