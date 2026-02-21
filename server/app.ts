import { type Server } from "node:http";

import express, { type Express, type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "../db/index";
import { registerRoutes } from "./routes";

const PgSession = connectPgSimple(session);
import { initializeDatabase } from "../db/init";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

// Flag para indicar se o servidor está completamente pronto
let isAppReady = false;

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Middleware de readiness check - responde 503 se app não estiver pronto
app.use((req, res, next) => {
  if (!isAppReady && !req.path.startsWith('/health')) {
    return res.status(503).json({ 
      error: 'Service Unavailable', 
      message: 'Application is initializing. Please try again in a moment.' 
    });
  }
  next();
});

// Middleware para confiar em proxies (Replit deployment)
app.set('trust proxy', 1);

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'fresh-market-secret-key-2025',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // false para funcionar em localhost HTTP
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 dias
    }
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// 🆕 NOVA FUNÇÃO: Tentar múltiplas portas
async function tryStartServer(
  server: Server,
  ports: number[],
  host: string
): Promise<number> {
  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    try {
      await new Promise<void>((resolve, reject) => {
        server.listen({ port, host, reusePort: true }, () => {
          resolve();
        }).on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`));
          } else if (err.code === 'EACCES') {
            reject(new Error(`Port ${port} requires elevated privileges`));
          } else if (err.code === 'ENOTSUP') {
            reject(new Error(`Windows socket error with host ${host}`));
          } else {
            reject(err);
          }
        });
      });
      
      // Se chegou aqui, conseguiu iniciar
      return port;
    } catch (err) {
      const isLastPort = i === ports.length - 1;
      
      if (isLastPort) {
        console.error(`❌ FATAL: Todas as portas estão em uso: ${ports.join(', ')}`);
        console.error(`💡 Tente fechar outros processos ou use: PORT=8000 npm run dev`);
        throw err;
      } else {
        console.log(`⚠️  Porta ${port} em uso, tentando próxima...`);
      }
    }
  }
  
  throw new Error('Failed to start server on any port');
}

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  let server: Server;
  
  // 🆕 CONFIGURAÇÃO DE MÚLTIPLAS PORTAS
  const preferredPort = parseInt(process.env.PORT || '3000', 10);
const alternatePorts = [3000, 5000, 8080, 3001, 5001, 8000, 8001, 8888, 9000]; // Mais portas!  
  // Remove duplicatas e coloca a porta preferida no início
  const ports = [preferredPort, ...alternatePorts.filter(p => p !== preferredPort)];
  
  const host = process.env.HOST || 'localhost';
  
  // PHASE 1: Fatal bootstrap - env/DB/routes (fail-fast required)
  try {
    // Verificar variável de ambiente essencial
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Inicializar banco de dados com dados padrão se estiver vazio
    log('Initializing database...');
    await initializeDatabase();
    log('Database initialization complete');
    
    // Registrar rotas
    log('Registering routes...');
    server = await registerRoutes(app);
    
    // Validar que server foi criado
    if (!server) {
      throw new Error('registerRoutes did not return a server instance');
    }
    log('Routes registered');
  } catch (error) {
    console.error('❌ FATAL: Server bootstrap failed');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    console.error('\n⚠️  Deployment cannot proceed. Fix the above error and redeploy.\n');
    process.exit(1);
  }

  // Middleware de erro para requests - não deve crashar o servidor
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error('Request error:', err.message || err);
    if (err instanceof Error && err.stack) {
      console.error('Stack trace:', err.stack);
    }
    
    res.status(status).json({ message });
  });

  // Health check endpoint (sempre disponível)
  app.get('/health', (_req, res) => {
    res.json({ 
      status: isAppReady ? 'ready' : 'initializing',
      timestamp: new Date().toISOString()
    });
  });

  // 🆕 INICIAR SERVIDOR COM MÚLTIPLAS PORTAS
  try {
    const actualPort = await tryStartServer(server, ports, host);
    
    log(`✓ Server listening on ${host}:${actualPort}`);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`Access at: http://${host}:${actualPort}`);
    
    if (actualPort !== preferredPort) {
      log(`⚠️  Note: Started on port ${actualPort} (preferred ${preferredPort} was in use)`);
    }
    
    // PHASE 2: Setup (Vite/static) - após servidor estar rodando
    try {
      log('Running setup (Vite/static serve)...');
      await setup(app, server);
      isAppReady = true;
      log('✅ Setup complete - application ready');
    } catch (error) {
      console.error('❌ ERROR: Setup failed after server started');
      console.error('Error:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
      console.error('\n⚠️  Server is running but application setup incomplete.');
      console.error('⚠️  Responding with 503 to all requests until fixed.');
      console.error('⚠️  Check logs and redeploy with fixes.\n');
    }
  } catch (error) {
    console.error('❌ FATAL: Could not start server on any port');
    process.exit(1);
  }
}
export function markAppReady() {
  isAppReady = true;
}
