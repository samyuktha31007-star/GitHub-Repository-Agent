const AdmZip = require('adm-zip');
const path = require('path');
const config = require('../config');
const { isPathSafe, shouldIgnorePath } = require('../utils/securityUtils');
const { detectLanguage, isEntryPoint } = require('../utils/languageDetect');

/**
 * Safely extracts files from a ZIP buffer
 */
function processZipBuffer(buffer, originalFilename = 'archive.zip') {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    throw new Error(`Corrupt or invalid ZIP archive: ${err.message}`);
  }

  const zipEntries = zip.getEntries();
  if (!zipEntries || zipEntries.length === 0) {
    throw new Error('The uploaded ZIP archive is empty.');
  }

  const files = [];
  let totalExtractedSize = 0;
  let fileCount = 0;

  // Determine if there's a common top-level directory (e.g., repo-main/)
  let topLevelDir = null;
  const firstEntry = zipEntries[0].entryName.split('/')[0];
  if (firstEntry && zipEntries.every(e => e.entryName.startsWith(firstEntry + '/') || e.entryName === firstEntry)) {
    topLevelDir = firstEntry + '/';
  }

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    let relativePath = entry.entryName;
    if (topLevelDir && relativePath.startsWith(topLevelDir)) {
      relativePath = relativePath.slice(topLevelDir.length);
    }

    // Safety checks against path traversal (Zip Slip)
    if (!isPathSafe(config.tempDir, relativePath) || relativePath.includes('..') || path.isAbsolute(relativePath)) {
      continue; // Skip dangerous entries
    }

    // Skip ignored directories and binaries
    if (shouldIgnorePath(relativePath)) {
      continue;
    }

    // Check bounds to prevent decompression bomb / resource exhaustion
    fileCount++;
    if (fileCount > config.maxZipFiles) {
      break; // Safe cutoff
    }

    const uncompressedSize = entry.header.size;
    totalExtractedSize += uncompressedSize;
    if (totalExtractedSize > config.maxUncompressedSize) {
      throw new Error(`Decompressed content exceeds safe limit of ${config.maxUncompressedSize / (1024 * 1024)}MB.`);
    }

    // Read content as utf-8 string, capping single file length if too large
    let content = '';
    try {
      const data = entry.getData();
      // Only treat as text if not binary
      content = data.toString('utf8');
      // Detect binary content with null bytes
      if (content.slice(0, 1000).indexOf('\0') !== -1) {
        continue;
      }
    } catch {
      continue;
    }

    const lines = content.split(/\r\n|\r|\n/);

    files.push({
      path: relativePath.replace(/\\/g, '/'),
      name: path.basename(relativePath),
      size: uncompressedSize,
      language: detectLanguage(relativePath),
      content,
      linesOfCode: lines.length,
      isEntryPoint: isEntryPoint(relativePath)
    });
  }

  if (files.length === 0) {
    throw new Error('No valid, readable source code files found in the archive after filtering ignored/binary files.');
  }

  return files;
}

/**
 * Processes multiple individual uploaded files
 */
function processUploadedFiles(uploadedFiles) {
  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new Error('No files uploaded.');
  }

  const files = [];

  for (const file of uploadedFiles) {
    let relativePath = file.originalname || file.name || 'unnamed.txt';
    // Clean path traversal in filenames
    relativePath = path.basename(relativePath);

    if (shouldIgnorePath(relativePath)) {
      continue;
    }

    let content = '';
    if (file.buffer) {
      content = file.buffer.toString('utf8');
    } else if (file.path) {
      const fs = require('fs');
      content = fs.readFileSync(file.path, 'utf8');
    }

    // Skip binary files with null characters
    if (content.slice(0, 1000).indexOf('\0') !== -1) {
      continue;
    }

    const lines = content.split(/\r\n|\r|\n/);

    files.push({
      path: relativePath,
      name: relativePath,
      size: file.size || Buffer.byteLength(content),
      language: detectLanguage(relativePath),
      content,
      linesOfCode: lines.length,
      isEntryPoint: isEntryPoint(relativePath)
    });
  }

  if (files.length === 0) {
    throw new Error('No valid source code or configuration files could be processed from the upload.');
  }

  return files;
}

module.exports = {
  processZipBuffer,
  processUploadedFiles
};
