// server.js
const express = require('express');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

// Helper: create cache key from params
function cacheKey(params) {
  const sortedKeys = Object.keys(params).sort();
  const concatenated = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha256').update(concatenated).digest('hex');
}

// Allowed params list (adapt to your .scad variables)
const ALLOWED_PARAMS = ['name', 'thickness', 'textsize', 'font', 'color', 'fontstyle'];

// Map raw query to -D overrides for OpenSCAD
function buildOverrides(query) {
  const overrides = [];
  for (const k of ALLOWED_PARAMS) {
    if (query[k] !== undefined) {
      // Basic sanitization:
      let v = String(query[k]).trim();

      // prevent injection - remove dangerous characters for filenames/commands
      v = v.replace(/["`$\\]/g, '');

      // If string param: wrap in quotes for OpenSCAD (-D name="John")
      // We'll treat numeric-looking params as numbers.
      if (!isNaN(v) && v !== '') {
        overrides.push(`-D`, `${k}=${v}`);
      } else {
        // Escape internal quotes
        v = v.replace(/"/g, '\\"');
        overrides.push(`-D`, `${k}="${v}"`);
      }
    }
  }
  return overrides;
}

app.get('/render', async (req, res) => {
  try {
    // Restrict allowed params and build a cleaned params object
    const params = {};
    for (const k of ALLOWED_PARAMS) {
      if (req.query[k] !== undefined) {
        params[k] = String(req.query[k]);
      }
    }

    // Create cache key
    const key = cacheKey(params);
    const svgPath = path.join(CACHE_DIR, `${key}.svg`);

    // If cached -> return quickly
    if (fs.existsSync(svgPath)) {
      const svgContent = fs.readFileSync(svgPath, 'utf8');
      res.set('Content-Type', 'image/svg+xml');
      return res.send(svgContent);
    }

    // Build openscad args
    const scadFile = path.join(__dirname, 'model.scad'); // ensure your file is here
    if (!fs.existsSync(scadFile)) {
      return res.status(500).send('model.scad not found on server.');
    }

    const overrides = buildOverrides(params);

    // Output temporary file
    const tmpOut = path.join(CACHE_DIR, `tmp-${key}.svg`);

    // Command:
    // openscad -o tmpOut -D param=... model.scad
    const args = ['-o', tmpOut, ...overrides, scadFile];

    // Run OpenSCAD (synchronous execution)
    const result = spawnSync('openscad', args, { encoding: 'utf8', timeout: 30_000 });

    if (result.error) {
      console.error('OpenSCAD spawn error:', result.error);
      return res.status(500).send('Error running OpenSCAD engine.');
    }

    if (result.status !== 0) {
      console.error('OpenSCAD stderr:', result.stderr);
      return res.status(500).send(`OpenSCAD failed: ${result.stderr || 'unknown error'}`);
    }

    // Read output, optionally sanitize or post-process
    if (!fs.existsSync(tmpOut)) {
      return res.status(500).send('OpenSCAD did not produce output.');
    }
    const svgContent = fs.readFileSync(tmpOut, 'utf8');

    // Save into cache (atomic rename)
    fs.renameSync(tmpOut, svgPath);

    res.set('Content-Type', 'image/svg+xml');
    return res.send(svgContent);

  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// Health check
app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`OpenSCAD renderer listening on port ${PORT}`);
});
