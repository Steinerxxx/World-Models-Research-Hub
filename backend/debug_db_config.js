import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const url = process.env.DATABASE_URL;

if (!url) {
    console.error("❌ DATABASE_URL is missing from .env");
    process.exit(1);
}

try {
    // Parse the URL to check components without revealing password
    // Format: postgres://user:password@host:port/database
    const parsed = new URL(url);
    
    console.log("--- Database Configuration Check ---");
    console.log(`Protocol: ${parsed.protocol}`);
    console.log(`Host:     ${parsed.hostname}`);
    console.log(`Port:     ${parsed.port}`);
    console.log(`User:     ${parsed.username}`);
    console.log(`Database: ${parsed.pathname.replace('/', '')}`);
    console.log(`Password: ${parsed.password ? '****** (Present)' : '❌ MISSING'}`);
    
    // Check for common Supabase issues
    if (parsed.hostname.includes('supabase.co')) {
        console.log("\n--- Supabase Specific Checks ---");
        if (parsed.port === '6543') {
            console.log("ℹ️  Using Transaction Pooler (Port 6543)");
            console.log("   Note: Ensure your username is formatted as 'user.project_ref'");
        } else if (parsed.port === '5432') {
             console.log("ℹ️  Using Session Pooler / Direct Connection (Port 5432)");
        }
    }

} catch (e) {
    console.error("❌ Invalid DATABASE_URL format:", e.message);
}
