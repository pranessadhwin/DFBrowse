import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { hashPassword } from '../utils/password';
import { DEFAULT_ALLOWED_SITES } from '../utils/policy';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

class Database {
  private pgPool: Pool | null = null;
  private pglite: PGlite | null = null;
  private isPGlite = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.trim() !== '') {
      console.log('Connecting to PostgreSQL via DATABASE_URL...');
      this.pgPool = new Pool({
        connectionString: dbUrl,
      });
      this.isPGlite = false;
    } else {
      const dataDir = path.resolve(__dirname, '../../data/pglite-db');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      console.log(`No DATABASE_URL provided. Initializing embedded PGlite PostgreSQL at ${dataDir}...`);
      this.pglite = new PGlite(dataDir);
      this.isPGlite = true;
    }
  }

  async query<T = any>(sqlText: string, params: any[] = []): Promise<QueryResult<T>> {
    if (this.isPGlite && this.pglite) {
      const res = await this.pglite.query<T>(sqlText, params);
      return {
        rows: res.rows || [],
        rowCount: res.rows ? res.rows.length : 0,
      };
    } else if (this.pgPool) {
      const res = await this.pgPool.query(sqlText, params);
      return {
        rows: res.rows || [],
        rowCount: res.rowCount || (res.rows ? res.rows.length : 0),
      };
    }
    throw new Error('Database not initialized');
  }

  async initSchema(): Promise<void> {
    console.log('Initializing PostgreSQL database schema...');
    
    // Create users table
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        feature_password_hash VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create allowed_sites table
    await this.query(`
      CREATE TABLE IF NOT EXISTS allowed_sites (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hostname VARCHAR(255) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create study_sessions table
    await this.query(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ended_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    // Create navigation_logs table
    await this.query(`
      CREATE TABLE IF NOT EXISTS navigation_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_url TEXT NOT NULL,
        hostname VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create notes table
    await this.query(`
      CREATE TABLE IF NOT EXISTS user_notes (
        user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database schema created successfully.');

    // Check if demo user exists, seed if not
    const demoCheck = await this.query('SELECT id FROM users WHERE email = $1', ['student@dfbrowse.com']);
    if (demoCheck.rows.length === 0) {
      console.log('Seeding Demo Student user (student@dfbrowse.com)...');
      const userId = 'user-demo-dfbrowse-1001';
      const pwHash = hashPassword('study123');
      const fpwHash = hashPassword('4321');
      await this.query(
        `INSERT INTO users (id, email, name, password_hash, feature_password_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'student@dfbrowse.com', 'Demo Student', pwHash, fpwHash]
      );

      // Seed default allowed sites for demo user
      for (let i = 0; i < DEFAULT_ALLOWED_SITES.length; i++) {
        const hostname = DEFAULT_ALLOWED_SITES[i];
        const siteId = `site-demo-${i + 1}`;
        await this.query(
          `INSERT INTO allowed_sites (id, user_id, hostname, is_default)
           VALUES ($1, $2, $3, $4)`,
          [siteId, userId, hostname, true]
        );
      }

      // Seed default notes
      await this.query(
        `INSERT INTO user_notes (user_id, content) VALUES ($1, $2)`,
        [userId, 'Welcome to DFBrowse Web!\n- Strict study allowlist mode enabled\n- Unlock allowlist with feature password: 4321\n- Focus timer supports 25m study and 5m break sessions']
      );

      console.log('Demo Student seeded with default allowlist and feature password (4321).');
    }
  }
}

export const db = new Database();
