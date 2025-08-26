import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool();

export async function dbInit() {
  const client = await pool.connect();

  client.release();
}
