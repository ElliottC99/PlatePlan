import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const distDir = path.join(__dirname, 'dist');
const hasDist = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));
const staticDir = hasDist ? distDir : __dirname;

app.use(express.static(staticDir));
if (staticDir !== __dirname) {
  app.use(express.static(__dirname));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.get('*', (req, res) => {
  // Return clean 404 for missing asset/module files to prevent HTML fallback SyntaxErrors
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') {
    console.log(`[Server] Returning 404 for asset: ${req.path}`);
    return res.status(404).send('Asset Not Found');
  }
  console.log(`[Server] Serving HTML fallback for path: ${req.path}`);
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlatePlan server running on http://0.0.0.0:${PORT} (serving from ${staticDir})`);
});
