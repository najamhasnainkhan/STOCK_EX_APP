import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 15000,
});

export async function query(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (e) {
    if (e.code === undefined || /connect|timeout|ECONN/i.test(e.message)) {
      return await pool.query(sql, params);
    }
    throw e;
  }
}
