import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;

let poolInstance = null;
let supabaseClient = null;

export const getSupabase = () => {
    const key = process.env.SUPABASE_SECRET_KEY || 
                process.env.SUPABASE_SERVICE_ROLE_KEY || 
                process.env.SUPABASE_PUBLISHABLE_KEY || 
                process.env.SUPABASE_ANON_KEY;
    if (!supabaseClient && process.env.SUPABASE_URL && key) {
        supabaseClient = createClient(process.env.SUPABASE_URL, key);
    }
    return supabaseClient;
};

export const getPool = () => {
    if (!poolInstance) {
        // Build connection configuration
        const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
        const isRemoteDb = connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
        poolInstance = new Pool({
            connectionString: connectionString || undefined,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: isRemoteDb ? { rejectUnauthorized: false } : false
        });

        poolInstance.on('error', (err) => {
            console.error('[DATABASE] Unexpected error on idle client:', err.message);
        });
    }
    return poolInstance;
};

// Set pool for testing (e.g. pg-mem)
export const setPool = (customPool) => {
    poolInstance = customPool;
};

export const query = async (text, params) => {
    const pool = getPool();
    return pool.query(text, params);
};

export const getClient = async () => {
    const pool = getPool();
    return pool.connect();
};

export const transaction = async (callback) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const checkHealth = async () => {
    try {
        const pool = getPool();
        const res = await pool.query('SELECT 1 AS healthy');
        return res.rows && res.rows[0] && res.rows[0].healthy === 1;
    } catch {
        return false;
    }
};

export const connectDB = async () => {
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!connectionString) {
        console.error('\n[DATABASE CONFIG ERROR] Missing database URI in environment configuration');
        throw new Error('Missing database connection string');
    }
    try {
        const pool = getPool();
        await pool.query('SELECT 1');
        console.log('[DATABASE] PostgreSQL / Supabase Connected Successfully');
    } catch (error) {
        console.error('[DATABASE] Failed to connect to PostgreSQL / Supabase:', error.message);
        throw error;
    }
};

export const closeDB = async () => {
    if (poolInstance) {
        await poolInstance.end();
        poolInstance = null;
    }
};

export default connectDB;