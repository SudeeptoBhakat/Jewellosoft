const { Pool } = require("pg");

let connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DIRECT_CONN_STR;


const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("error", (err) => {
    console.error("Unexpected Supabase error:", err);
});

module.exports = pool;