#!/usr/bin/env node
/**
 * Shared primitives for the G1 harnesses. The scripts deliberately resolve
 * computed styles in Chromium against a built site (never raw CSS source).
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * Serve a built directory on an ephemeral port. Unknown paths fall back to
 * index.html (same static-file behaviour as the check-tokens harness).
 * @param {string} rootDir
 * @returns {Promise<import('node:http').Server>}
 */
export function serveDirectory(rootDir) {
  const root = path.resolve(rootDir);
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        let filePath = path.join(root, decodeURIComponent(url.pathname));
        if (!filePath.startsWith(root)) {
          response.writeHead(403).end('Forbidden');
          return;
        }
        if (!existsSync(filePath)) {
          filePath = path.join(root, 'index.html');
        } else {
          const { stat } = await import('node:fs/promises');
          const info = await stat(filePath);
          if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
        }
        const body = await readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
          'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        });
        response.end(body);
      } catch {
        response.writeHead(404).end('Not found');
      }
    })();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** @param {string} hex */
export function hexToRgb(hex) {
  const value = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** @param {string} cssColor */
export function parseCssColor(cssColor) {
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(cssColor);
  if (rgb) {
    return {
      r: Number.parseFloat(rgb[1]),
      g: Number.parseFloat(rgb[2]),
      b: Number.parseFloat(rgb[3]),
    };
  }

  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(cssColor);
  if (srgb) {
    return {
      r: Number.parseFloat(srgb[1]) * 255,
      g: Number.parseFloat(srgb[2]) * 255,
      b: Number.parseFloat(srgb[3]) * 255,
    };
  }
  return null;
}

/** @param {string} cssLength */
export function parsePx(cssLength) {
  const value = Number.parseFloat(cssLength);
  return Number.isFinite(value) ? value : null;
}

/** WCAG 2.x relative luminance for an sRGB colour. */
export function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, foreground/background order independent. */
export function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
