import "../env";

import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express, { type Express } from "express";

import { app } from "./app";
import runApp from "./runApp";

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  await runApp(app, serveStatic);
})();
