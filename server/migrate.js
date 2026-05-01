import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    console.log('Resetting database...');
    await connection.query('DROP DATABASE IF EXISTS batuan_voting;');
    const schema = fs.readFileSync('server/schema.sql', 'utf8');
    
    // We need to split the schema into separate parts because of how multipleStatements works with CREATE DATABASE
    // Actually, let's just try running the whole thing first.
    // If it fails because the DB doesn't exist yet, we'll handle it.
    
    await connection.query(schema);
    console.log('Schema applied successfully.');

    // Seed additional sample data if it exists
    if (fs.existsSync('server/seed_sample_data.sql')) {
      const seed = fs.readFileSync('server/seed_sample_data.sql', 'utf8');
      await connection.query('USE batuan_voting;');
      await connection.query(seed);
      console.log('Sample data seeded successfully.');
    }

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

migrate();
