#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the HTML template
const htmlPath = path.join(__dirname, '..', 'ui.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Read the compiled UI JavaScript
const jsPath = path.join(__dirname, '..', 'dist', 'ui.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');

// Create a data URI for the JavaScript
const base64Js = Buffer.from(jsContent).toString('base64');
const dataUri = `data:text/javascript;base64,${base64Js}`;

// Replace the script src with data URI
htmlContent = htmlContent.replace(
  '<script src="ui.js"></script>',
  `<script src="${dataUri}"></script>`
);

// Write the final HTML to dist
const outputPath = path.join(__dirname, '..', 'dist', 'ui.html');
fs.writeFileSync(outputPath, htmlContent);

console.log('✅ Built ui.html with JavaScript as data URI');