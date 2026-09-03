import cookieParser from 'cookie-parser';
import express from 'express';
import dotenv from "dotenv";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { checkHealth } from './configs/db.js';

import userRouter from './routes/userRoute.js';
import sellerRouter from './routes/sellerRoute.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import addressRouter from './routes/addressRoute.js';
import orderRouter from './routes/orderRoute.js';

dotenv.config();

const app = express();

// 1. Reverse Proxy Trust (Required for accurate rate-limiting behind Nginx/Render/Vercel/Railway/Cloudflare)
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

// 2. Security Headers (Helmet)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 3. CORS configuration (Dynamic environment origins + Vercel preview URLs)
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [])
];

app.use(cors({
    origin: (origin, callback) => {
        if (
            !origin || 
            allowedOrigins.includes(origin) || 
            origin.endsWith('.vercel.app') || 
            process.env.NODE_ENV === 'test'
        ) {
            callback(null, true);
        } else {
            callback(new Error('CORS blocked origin'));
        }
    },
    credentials: true
}));

// 4. Body & Cookie Parsing
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// 5. Rate Limiting (Bypass or relaxed in test mode)
if (process.env.NODE_ENV !== 'test') {
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes" }
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 15,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: "Too many authentication attempts, please try again after 15 minutes" }
    });

    const orderLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: "Too many order requests, please try again later" }
    });

    app.use('/api', globalLimiter);
    app.use('/api/user/login', authLimiter);
    app.use('/api/user/register', authLimiter);
    app.use('/api/seller/login', authLimiter);
    app.use('/api/order/cod', orderLimiter);
}

// 6. Health & Diagnostic Routes
app.get('/', (req, res) => res.send("API is Working"));

app.get('/health', async (req, res) => {
    const isDbConnected = await checkHealth();
    res.status(isDbConnected ? 200 : 503).json({
        success: isDbConnected,
        status: isDbConnected ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        database: isDbConnected ? "connected" : "disconnected"
    });
});

app.get('/ready', async (req, res) => {
    const isDbConnected = await checkHealth();
    const isReady = isDbConnected && Boolean(process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET);
    res.status(isReady ? 200 : 503).json({
        success: isReady,
        status: isReady ? "ready" : "not_ready",
        checks: {
            database: isDbConnected ? "pass" : "fail",
            environment: Boolean(process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET) ? "pass" : "fail"
        },
        timestamp: new Date().toISOString()
    });
});


// 7. Application Routes
app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/order', orderRouter);

// 8. 404 Handler for Undefined API Routes
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: `Endpoint not found: ${req.method} ${req.originalUrl}` });
    }
    next();
});

// 9. Centralized Error Handler
app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
    if (err.message === 'CORS blocked origin') {
        return res.status(403).json({ success: false, message: "Forbidden: Origin not allowed" });
    }
    console.error("Unhandled Error:", err.message || err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
});

export default app;
