import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db } from './config/db';
import authRoutes from './routes/auth';
import allowlistRoutes from './routes/allowlist';
import studyRoutes from './routes/study';
import proxyRoutes from './routes/proxy';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-unlock-token']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/allowlist', allowlistRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/proxy', proxyRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'DFBrowse Server (Node.js + Express + PostgreSQL)',
    timestamp: new Date().toISOString()
  });
});

// Serve built React client from client/dist if available
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`Serving static React client from ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

async function startServer(): Promise<void> {
  try {
    await db.initSchema();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`============= DFBrowse Server =============`);
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
      console.log(`API endpoints ready at /api`);
      console.log(`===========================================`);
    });
  } catch (err) {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  }
}

startServer();
