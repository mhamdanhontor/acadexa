/**
 * Copies the built React frontend (frontend/dist) into electron/app-dist
 * so electron-builder can package it alongside main.js/preload.js.
 *
 * Usage: node scripts/copy-frontend.js
 * Assumes `npm run build` has already been run inside ../frontend.
 */
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', '..', 'frontend', 'dist')
const DEST = path.join(__dirname, '..', 'app-dist')

function copyRecursive(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

if (!fs.existsSync(SRC)) {
  console.error(
    `\n[copy-frontend] ERROR: ${SRC} does not exist.\n` +
      `Run "npm run build" inside the frontend/ directory first.\n`
  )
  process.exit(1)
}

if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true })
}

copyRecursive(SRC, DEST)
console.log(`[copy-frontend] Copied ${SRC} -> ${DEST}`)
