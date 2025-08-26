const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool();

async function dbInit() {
  const client = await pool.connect();

  client.release();
}

module.exports = { dbInit };
