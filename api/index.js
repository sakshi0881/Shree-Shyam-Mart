import app from '../server/app.js';
import connectDB from '../server/configs/db.js';
import connectCloudinary from '../server/configs/cloudinary.js';
import { validateEnv } from '../server/configs/env.js';

let initializationPromise;

async function initialize() {
    if (!initializationPromise) {
        initializationPromise = (async () => {
            validateEnv();
            await connectDB();
            await connectCloudinary();
        })().catch((err) => {
            initializationPromise = null;
            throw err;
        });
    }

    await initializationPromise;
}

export default async function handler(req, res) {
    try {
        await initialize();
        return app(req, res);
    } catch (err) {
        console.error('[SERVERLESS INIT ERROR]:', err.message || err);
        return res.status(500).json({
            success: false,
            message: `Serverless initialization error: ${err.message || 'Check environment variables in Vercel settings'}`
        });
    }
}
