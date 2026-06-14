// Split multi-device configs by delimiter

import type { RawConfigBlock } from './types';
import { detectRouterOS } from './routeros';
import { detectLinux } from './linux';
import { v4 as uuid } from 'uuid';

// Default delimiter patterns for multi-device configs
const DEFAULT_DELIMITERS = [
  /^#{3,}\s+([a-zA-Z0-9][\w.\-()\/]*?)\s*$/m,                    // ### HOSTNAME  or  #### HOSTNAME
  /^#{3,}\s+([a-zA-Z0-9][\w.\-()\/]*?)\s+#{3,}$/m,               // ### HOSTNAME ###
  /^={3,}\s+([a-zA-Z0-9][\w.\-()\/]*?)\s+={3,}$/m,               // === HOSTNAME ===
  /^---\s+([a-zA-Z0-9][\w.\-()\/]*?)\s+---$/m,                   // --- HOSTNAME ---
  /^::\s+([a-zA-Z0-9][\w.\-()\/]*?)$/m,                          // :: HOSTNAME
  /^[|]{3,}\s+([a-zA-Z0-9][\w.\-()\/]*?)\s+[|]{3,}$/m,           // |||| HOSTNAME ||||
  /^\/\/\/\s+([a-zA-Z0-9][\w.\-()\/]*?)\s+\/\/\/$/m,             // /// HOSTNAME ///
  /^\[\[\[\[\[\s+([a-zA-Z0-9][\w.\-()\/]*?)\s+\]\]\]\]\]$/m,      // [[[[[ HOSTNAME ]]]]]
  /^#\s*={3,}\s+([a-zA-Z0-9][\w.\-()\/]*?)\s*$/m,                // # === HOSTNAME  (comment-style header)
];

const DELIMITER_LINE_REGEX = /^(#{3,}|={3,}|-{3,}|:{2,}|\+{3,}|\/{3,}|\|{3,}|\[{3,})\s*([a-zA-Z0-9][\w.\-()\/]*?)\s*(\1)?$/m;

export interface SplitConfig {
  blocks: RawConfigBlock[];
  errors: string[];
}

export function splitMultiDevice(
  content: string,
  delimiterPattern?: string
): SplitConfig {
  const errors: string[] = [];
  const blocks: RawConfigBlock[] = [];

  if (!content.trim()) {
    return { blocks, errors };
  }

  // Normalize comment-style section headers with optional blank lines:
  //   # ===========================
  //   # ROUTER C1
  //   # ===========================
  //   →  ### ROUTER-C1
  let normalized = content;
  const tripleLinePattern = /^#\s*=+\s*$\n^\s*#\s+([A-Za-z0-9][\w\s\/\-.()]*?)\s*$\n^\s*#\s*=+\s*$/gm;
  normalized = normalized.replace(tripleLinePattern, (_, name) => `### ${name.trim().replace(/[\s/]+/g, '-')}`);

  // Normalize with optional blank line: # ====== \n # HEADER \n # ======  →  ### HEADER
  const tripleBlankPattern = /^#\s*=+\s*$\n+(^\s*#\s+([A-Za-z0-9][\w\s\/\-.()]*?)\s*)$\n+(^\s*#\s*=+\s*$)/gm;
  normalized = normalized.replace(tripleBlankPattern, (_, name) => {
    const cleaned = name.replace(/^#\s*/, '').replace(/[\s\/]+/g, '-');
    return `### ${cleaned}`;
  });

  // Normalize: # ====== (bare separator line) → blank line
  normalized = normalized.replace(/^#\s*={3,}\s*#?\s*$/gm, '');

  // Normalize: bare # ROUTER C1 header (RouterOS style) → ### ROUTER-C1
  // Only if name has no / (avoid "# IPB /ip address" style) and next content starts with /
  const rosHeaderPattern = /^#\s+([\w][\w\s\/\-()]*?)\s*$\n+/gm;
  normalized = normalized.replace(rosHeaderPattern, (match, name, offset, full) => {
    if (name.includes('/')) return match;
    const afterMatch = full.slice(offset + match.length).trimStart();
    if (afterMatch.startsWith('/')) {
      return `### ${name.trim().replace(/\s+/g, '-')}\n`;
    }
    return match;
  });

  // If no clear delimiter found, treat whole content as single device
  const lines = normalized.split('\n');
  let currentBlock: { hostname: string; content: string[]; lineStart: number } | null = null;
  let currentHostname = 'Device';
  const allLines: string[] = [];

  // Try delimiter-based split first
  const usePattern = delimiterPattern
    ? new RegExp(delimiterPattern, 'm')
    : DELIMITER_LINE_REGEX;

  if (usePattern.test(normalized)) {
    // Multi-device mode
    const matches = [...normalized.matchAll(new RegExp(usePattern.source, 'gm'))];
    if (matches.length > 1) {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const hostname = (match[2] || match[1] || `Device-${i + 1}`).trim();

        // Find content between this delimiter and next
        const startPos = match.index! + match[0].length;
        const endPos = i + 1 < matches.length
          ? matches[i + 1].index!
          : normalized.length;
        const blockContent = normalized.slice(startPos, endPos).trim();

        if (blockContent) {
          blocks.push({
            id: uuid(),
            filename: hostname,
            content: blockContent,
            parseWarnings: [],
            parseErrors: [],
          });
        }
      }

      // Auto-detect vendor per block before returning
      for (const block of blocks) {
        block.detectedVendor = detectRouterOS(block.content) ? 'routeros' : detectLinux(block.content) ? 'linux' : 'unknown';
      }
      return { blocks, errors };
    }
  }

  // Try simple double-newline separator
  const sections = content.split(/\n\n+/);
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    // Try to detect hostname from first line
    let hostname = `Device-${i + 1}`;
    const firstLine = section.split('\n')[0].trim();

    // Check if first line looks like a hostname marker
    if (/^[A-Za-z0-9][-_A-Za-z0-9]*/.test(firstLine) && firstLine.length < 32) {
      if (!firstLine.match(/\d+\.\d+\.\d+\.\d+/) && !firstLine.match(/\/[a-z]/)) {
        hostname = firstLine;
      }
    }

    blocks.push({
      id: uuid(),
      filename: hostname,
      content: section,
      parseWarnings: [],
      parseErrors: [],
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      id: uuid(),
      filename: 'Device-1',
      content: content.trim(),
      parseWarnings: [],
      parseErrors: [],
    });
  }

  // Auto-detect vendor per block
  for (const block of blocks) {
    if (detectRouterOS(block.content)) {
      block.detectedVendor = 'routeros';
    } else if (detectLinux(block.content)) {
      block.detectedVendor = 'linux';
    } else {
      block.detectedVendor = 'unknown';
    }
  }

  return { blocks, errors };
}

export function detectVendor(content: string): 'routeros' | 'linux' | 'linux-netplan' | 'unknown' {
  if (detectRouterOS(content)) return 'routeros';
  if (detectLinux(content)) return 'linux';
  if (content.includes('network:') && (content.includes('version:') || content.includes('renderer:'))) {
    return 'linux-netplan';
  }
  return 'unknown';
}