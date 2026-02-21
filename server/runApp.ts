import { type Server } from "node:http";
import type { Express, Request, Response, NextFunction } from "express";

import { registerRoutes } from "./routes";
import { initializeDatabase } from "../db/init";

/* =========================================================
   Logger simples
========================================================= */
function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${time} [${source}] ${message}`);
}

/* =========================================================
   Runner principal da aplicação
========================================================= */
export default async function runApp(
  app: Express,
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const host = process.env.HOST || "0.0.0.0";
  const port = Number(process.env.PORT || 9001);

  let server: Server;

  /* =======================================================
     PHASE 1 — Bootstrap (fail-fast)
  ======================================================= */
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    log("Initializing database...");
    await initializeDatabase();
    log("Database initialization complete");

    log("Registering routes...");
    server = await registerRoutes(app);

    if (!server) {
      throw new Error("registerRoutes did not return a server instance");
    }

    log("Routes registered");
  } catch (err) {
    console.error("❌ FATAL: Server bootstrap failed");
    console.error(err);
    process.exit(1);
  }

  /* =======================================================
     Middleware global de erro (não derruba o server)
  ======================================================= */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    console.error("Request error:", err);
    res.status(status).json({ message });
  });

  /* =======================================================
     PHASE 2 — Start server (UMA porta, UMA vez)
  ======================================================= */
  const protocol = process.env.HTTPS === "1" || process.env.HTTPS === "true" ? "https" : "http";
  server.listen(port, host, async () => {
    log(`✓ Server listening on ${host}:${port}`);
    log(`Environment: ${process.env.NODE_ENV || "development"}`);
    log(`Access at: ${protocol}://localhost:${port}`);
    if (protocol === "https") {
      log(`  ⚠ Certificado auto-assinado: aceite o aviso no navegador para usar a câmera no celular`);
    }
    if (host === "0.0.0.0") {
      try {
        const os = await import("node:os");
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
          for (const net of nets[name] || []) {
            const isIPv4 = net.family === "IPv4" || (net as { family?: number }).family === 4;
            if (isIPv4 && !net.internal) {
              log(`  Também em: ${protocol}://${net.address}:${port} (para testar no celular)`);
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    /* =====================================================
       PHASE 3 — Setup (Vite ou Static)
    ===================================================== */
    try {
      log("Running setup (Vite / Static)...");
      await setup(app, server);

const { markAppReady } = await import("./app");
markAppReady();

log("✅ Application ready");

    } catch (err) {
      console.error("❌ ERROR: Setup failed");
      console.error(err);
      console.error(
        "⚠️  Server is running, but application setup is incomplete",
      );
    }
  });

  /* =======================================================
     Tratamento explícito de erro de porta
  ======================================================= */
  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Porta ${port} já está em uso`);
    } else {
      console.error("❌ Server error:", err);
    }
    process.exit(1);
  });
}
