/**
 * Startup Environment Configuration Validator
 * Validates the presence of required configuration variables without exposing secrets.
 */
export const validateEnv = () => {
    // In automated testing mode, environment variables are managed by the test runner
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    const hasDb = process.env.DATABASE_URL || (process.env.SUPABASE_URL && (
        process.env.SUPABASE_SERVICE_ROLE_KEY || 
        process.env.SUPABASE_ANON_KEY || 
        process.env.SUPABASE_SECRET_KEY || 
        process.env.SUPABASE_PUBLISHABLE_KEY
    ));
    if (!hasDb) {
        console.error('[FATAL ERROR] Server startup failed. Missing required database configuration');
        throw new Error('Missing required database configuration');
    }

    const requiredVars = [
        'JWT_SECRET',
        'SELLER_EMAIL',
        'SELLER_PASSWORD',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET'
    ];

    const missingVars = requiredVars.filter((varName) => !process.env[varName] || process.env[varName].trim() === '');

    if (missingVars.length > 0) {
        console.error(`[FATAL ERROR] Server startup failed. Missing required environment variables: ${missingVars.join(', ')}`);
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 16) {
        console.warn('[WARNING] JWT_SECRET appears to be short. A strong secret of at least 32 characters is recommended for production.');
    }
};
