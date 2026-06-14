// RouterOS tokenizer — converts /export output into tokens
// Supports: /path, /path/item, key=value, comments

export type TokenType =
  | 'PATH'
  | 'ITEM'
  | 'KEY_VALUE'
  | 'KEY_QUOTED'
  | 'COMMENT'
  | 'BLANK'
  | 'SECTION_START'
  | 'SECTION_END'
  | 'UNKNOWN';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  path?: string;
  key?: string;
}

export interface TokenContext {
  currentPath: string;
  line: number;
}

const PATH_REGEX = /^(\/[a-zA-Z0-9-]+(?:\s+[a-zA-Z0-9-]+)*)\s*$/;
const KV_REGEX = /^(\S+)\s*=\s*(.*)$/;
const ITEM_REGEX = /^add\s+(.+)$/;
const SET_REGEX = /^set\s+(.+)$/;
const REMOVE_REGEX = /^remove\s+(.+)$/;
const ENABLE_REGEX = /^enable\s+(.+)$/;
const DISABLE_REGEX = /^disable\s+(.+)$/;
const FIND_REGEX = /^find\s+(.+)$/;

export function tokenizeRouterOS(content: string): Token[] {
  const tokens: Token[] = [];
  const lines = content.split('\n');
  let currentPath = '';

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      tokens.push({ type: 'BLANK', value: '', line: lineNum });
      continue;
    }

    // Strip leading # or ; comment prefix
    const cleanLine = trimmed.replace(/^[#;]\s*/, '').trim();
    if (!cleanLine || cleanLine.startsWith('#')) {
      if (trimmed.startsWith('#')) {
        tokens.push({ type: 'COMMENT', value: cleanLine, line: lineNum, path: currentPath });
      }
      continue;
    }

    // Combined path+command on one line: /interface bridge add name=lo
    const combinedMatch = cleanLine.match(/^(\/[a-zA-Z0-9-]+(?:\s+[a-zA-Z0-9-]+)*)\s+(add|set|remove|enable|disable|find)\s+(.+)$/);
    if (combinedMatch) {
      const [, pathPart, cmd, args] = combinedMatch;
      currentPath = pathPart;
      tokens.push({ type: 'PATH', value: pathPart, line: lineNum, path: currentPath });
      tokens.push({ type: 'ITEM', value: `${cmd} ${args}`, line: lineNum, path: currentPath });
      continue;
    }

    // Path line: /interface
    const pathMatch = cleanLine.match(PATH_REGEX);
    if (pathMatch) {
      currentPath = pathMatch[1];
      tokens.push({
        type: 'PATH',
        value: currentPath,
        line: lineNum,
        path: currentPath,
      });
      continue;
    }

    // Key=value: address=10.0.0.1/30
    const kvMatch = cleanLine.match(KV_REGEX);
    if (kvMatch) {
      const [, key, val] = kvMatch;
      tokens.push({
        type: 'KEY_VALUE',
        value: cleanLine,
        line: lineNum,
        path: currentPath,
        key: key.trim(),
      });
      continue;
    }

    // Special commands
    if (cleanLine.startsWith('add ') || cleanLine.startsWith('set ') || cleanLine.startsWith('remove ') || cleanLine.startsWith('enable ') || cleanLine.startsWith('disable ') || cleanLine.startsWith('find ')) {
      const match = cleanLine.match(/^(add|set|remove|enable|disable|find)\s+(.+)$/);
      if (match) {
        tokens.push({
          type: 'ITEM',
          value: cleanLine,
          line: lineNum,
          path: currentPath,
        });
        continue;
      }
    }

    // Unknown
    tokens.push({
      type: 'UNKNOWN',
      value: cleanLine,
      line: lineNum,
      path: currentPath,
    });
  }

  return tokens;
}

export function tokensToSections(tokens: Token[]): Map<string, Token[][]> {
  const sections = new Map<string, Token[][]>();
  let currentPath = '';
  let currentItems: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'BLANK') continue;

    if (token.type === 'PATH') {
      // Save previous section
      if (currentPath && currentItems.length > 0) {
        const existing = sections.get(currentPath) || [];
        existing.push(currentItems);
        sections.set(currentPath, existing);
      }
      currentPath = token.value;
      currentItems = [];
    } else if (token.type === 'KEY_VALUE' || token.type === 'ITEM') {
      currentItems.push(token);
    }
  }

  // Save last section
  if (currentPath && currentItems.length > 0) {
    const existing = sections.get(currentPath) || [];
    existing.push(currentItems);
    sections.set(currentPath, existing);
  }

  return sections;
}

export function parseKeyValueLine(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Handle both key=value and key="quoted value"
  const pairs = line.split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      let key = pair.slice(0, eqIndex).trim();
      let value = pair.slice(eqIndex + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}