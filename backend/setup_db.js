const { Client } = require('pg');
const fs = require('fs');
const { execSync } = require('child_process');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5434,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'dev_password_only', // 🚨 Never hardcode real passwords in code
    database: process.env.DB_NAME || 'postgres',
};

async function main() {
    console.log('Step 1: Connecting to PostgreSQL on port 5434...');
    const client = new Client(dbConfig);
    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL.');

        // Check if incident_system database exists
        console.log('Step 2: Checking if "incident_system" database exists...');
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname='incident_system'");
        if (res.rowCount === 0) {
            console.log('Database "incident_system" does not exist. Creating it...');
            await client.query('CREATE DATABASE incident_system');
            console.log('✅ Database "incident_system" created successfully.');
        } else {
            console.log('✅ Database "incident_system" already exists.');
        }
    } catch (err) {
        console.error('❌ Error checking/creating database:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }

    // Step 3: Write .env file
    console.log('Step 3: Creating .env file...');
    const envContent = `PORT=3000
DATABASE_URL="postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/incident_system?schema=public"
DIRECT_URL="postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/incident_system?schema=public"
JWT_SECRET="supersecretkey_change_me_in_prod"
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
NODE_ENV=development
`;
    fs.writeFileSync('.env', envContent);
    console.log('✅ Created .env file successfully.');

    // Step 4: Run Prisma db push
    console.log('Step 4: Running Prisma db push...');
    try {
        execSync('npx prisma db push', { stdio: 'inherit' });
        console.log('✅ Prisma db push completed successfully.');
    } catch (err) {
        console.error('❌ Prisma db push failed:', err.message);
        process.exit(1);
    }

    // Step 5: Run database seed
    console.log('Step 5: Seeding the database...');
    try {
        execSync('node prisma/seed.js', { stdio: 'inherit' });
        console.log('✅ Database seed completed successfully.');
    } catch (err) {
        console.error('❌ Seeding database failed:', err.message);
        process.exit(1);
    }

    console.log('\n🎉 ALL DATABASE SETUP COMPLETED SUCCESSFULLY!');
}

main();
