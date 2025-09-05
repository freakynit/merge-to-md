#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const isBinaryFileSync = require("isbinaryfile").isBinaryFileSync;

const DEFAULT_OUTPUT = 'context.md';

function parseArgs(argv) {
  const args = { input: null, exclude: null, output: null, help: false, dryRun: false, maxDepth: Infinity, followSymlinks: false };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];

    if (a === '-h' || a === '--help') { args.help = true; break; }
    if (a === '-i' || a === '--input') { args.input = argv[++i]; continue; }
    if (a === '-e' || a === '--exclude') { args.exclude = argv[++i]; continue; }
    if (a === '-o' || a === '--output') { args.output = argv[++i]; continue; }
    if (a === '-d' || a === '--dry-run') { args.dryRun = true; continue; }
    if (a === '-m' || a === '--max-depth') { args.maxDepth = Number(argv[++i]); continue; }
    if (a === '-l' || a === '--follow-symlinks') { args.followSymlinks = true; continue; }

    // support --key=value
    if (a.startsWith('--input=')) args.input = a.split('=')[1];
    if (a.startsWith('--exclude=')) args.exclude = a.split('=')[1];
    if (a.startsWith('--output=')) args.output = a.split('=')[1];
    if (a.startsWith('--dry-run=')) args.dryRun = true;
    if (a.startsWith('--max-depth=')) args.maxDepth = Number(a.split('=')[1]);
    if (a.startsWith('--follow-symlinks=')) args.followSymlinks = true;
  }

  return args;
}

function usage() {
  console.log('Usage: node merge-to-md --input <folder> [OPTIONS]');
  console.log('\nOptions:');
  console.log('  -i, --input <folder>      Input folder to process (required)');
  console.log('  -e, --exclude <patterns>  Comma-separated exclude patterns (RegExp)');
  console.log('  -o, --output <file>       Output file path');
  console.log('  -d, --dry-run             Show what would be processed without writing');
  console.log('  -m, --max-depth <num>     Maximum directory depth to traverse');
  console.log('  -l, --follow-symlinks     Follow symbolic links');
  console.log('  -h, --help                Show this help message');
  console.log('\nEach exclude item is treated as a JavaScript RegExp (no leading/trailing slashes required).');
  console.log('\nExamples:');
  console.log("  node merge-to-md -i ./src -e 'node_modules,\\.git' -o ./context.md");
  console.log("  node merge-to-md --input=./src --exclude='test,spec' --dry-run");
  console.log("  node merge-to-md -i ./project -m 3 --follow-symlinks -o merged.md\n");
}

function compileExcludeRegexes(excludeStr) {
  if (!excludeStr) return [];
  return excludeStr.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    try {
      return new RegExp(s);
    } catch (err) {
      // fallback: escape literal
      return new RegExp(s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&"));
    }
  });
}

function matchesAnyRegex(str, regexes) {
  return regexes.some(r => r.test(str));
}

// Mapping of file extensions to markdown fence language
// <LLM generated>
const EXT_TO_LANG = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx',
  '.py': 'python', '.rb': 'ruby', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.go': 'go', '.rs': 'rust', '.php': 'php', '.html': 'html', '.css': 'css', '.json': 'json', '.md': 'markdown',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.yml': 'yaml', '.yaml': 'yaml', '.xml': 'xml', '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin', '.r': 'r', '.pl': 'perl', '.sql': 'sql', '.txt': '', '.text': '',
  '.cs': 'csharp', '.vb': 'vbnet', '.fs': 'fsharp', '.scala': 'scala', '.clj': 'clojure', '.cljs': 'clojure',
  '.ex': 'elixir', '.exs': 'elixir', '.erl': 'erlang', '.hrl': 'erlang', '.hs': 'haskell', '.lhs': 'haskell',
  '.ml': 'ocaml', '.mli': 'ocaml', '.lua': 'lua', '.dart': 'dart', '.m': 'objective-c', '.mm': 'objective-c',
  '.vim': 'vim', '.vimrc': 'vim', '.fish': 'fish', '.ps1': 'powershell', '.psm1': 'powershell',
  '.dockerfile': 'dockerfile', '.makefile': 'makefile', '.mk': 'makefile', '.cmake': 'cmake',
  '.gradle': 'gradle', '.groovy': 'groovy', '.gvy': 'groovy', '.properties': 'properties', '.ini': 'ini',
  '.toml': 'toml', '.cfg': 'ini', '.conf': 'apache', '.htaccess': 'apache', '.nginx': 'nginx',
  '.proto': 'protobuf', '.graphql': 'graphql', '.gql': 'graphql', '.scss': 'scss', '.sass': 'sass',
  '.less': 'less', '.styl': 'stylus', '.vue': 'vue', '.svelte': 'svelte', '.astro': 'astro',
  '.jinja': 'jinja2', '.jinja2': 'jinja2', '.j2': 'jinja2', '.hbs': 'handlebars', '.mustache': 'mustache',
  '.pug': 'pug', '.jade': 'pug', '.ejs': 'ejs', '.erb': 'erb', '.haml': 'haml',
  '.tex': 'latex', '.bib': 'bibtex', '.diff': 'diff', '.patch': 'diff', '.log': 'log',
  '.asm': 'assembly', '.s': 'assembly', '.nasm': 'nasm', '.masm': 'masm',
  '.sol': 'solidity', '.move': 'move', '.cairo': 'cairo', '.vyper': 'vyper',
  '.lean': 'lean', '.agda': 'agda', '.coq': 'coq', '.v': 'verilog', '.sv': 'systemverilog',
  '.vhd': 'vhdl', '.vhdl': 'vhdl', '.tcl': 'tcl', '.awk': 'awk', '.sed': 'sed',
  '.xquery': 'xquery', '.xq': 'xquery', '.sparql': 'sparql', '.rq': 'sparql',
  '.dockerfile.*': 'dockerfile', '.env': 'bash', '.envrc': 'bash', '.bashrc': 'bash', '.zshrc': 'bash'
};

function getLangForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_LANG.hasOwnProperty(ext) ? EXT_TO_LANG[ext] : '';
}

function hasBOM(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) {
    return null;
  }

  // UTF-8 BOM: EF BB BF
  if (buffer.length >= 3 &&
      buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { kind: 'utf8', bomLength: 3 };
  }

  // UTF-16 BE BOM: FE FF
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return { kind: 'utf16be', bomLength: 2 };
  }

  // UTF-32 BE BOM: 00 00 FE FF
  if (buffer.length >= 4 &&
      buffer[0] === 0x00 && buffer[1] === 0x00 &&
      buffer[2] === 0xFE && buffer[3] === 0xFF) {
    return { kind: 'utf32be', bomLength: 4 };
  }

  // FF FE could be UTF-16 LE or UTF-32 LE
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-32 LE BOM: FF FE 00 00
    if (buffer.length >= 4 && buffer[2] === 0x00 && buffer[3] === 0x00) {
      return { kind: 'utf32le', bomLength: 4 };
    }
    // UTF-16 LE BOM: FF FE
    return { kind: 'utf16le', bomLength: 2 };
  }

  return null;
}

function isLikelyBinary(buffer) {
  // simple heuristic: if there are NUL bytes, treat as binary
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function fenceFor(content) {
  // choose a fence of backticks longer than any backtick run in the content
  const matches = content.match(/`+/g);
  if (!matches) return '```';
  const maxRun = matches.reduce((m, s) => Math.max(m, s.length), 0);
  return '`'.repeat(maxRun + 1);
}

async function collectFiles(root, excludeRegexes, maxDepth = Infinity, followSymlinks = false) {
  const files = [];
  const resolvedRoot = path.resolve(root);

  async function walk(dir, currentDepth = 0) {
    if (currentDepth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (err) {
      console.error(`Error reading directory ${dir}:`, err.message);
      return; // skip this directory... continue with next traversal
    }

    const sortedEntries = entries
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    for (const ent of sortedEntries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(resolvedRoot, full).split(path.sep).join('/');

      if (matchesAnyRegex(rel, excludeRegexes) || matchesAnyRegex(full, excludeRegexes)) {
        continue;
      }

      if (ent.isDirectory()) {
        await walk(full, currentDepth + 1);
      } else if (ent.isFile()) {
        files.push({ full, rel });
      } else if (ent.isSymbolicLink() && followSymlinks) {
        try {
          const stats = await fs.promises.stat(full);
          if (stats.isDirectory()) {
            // Check for circular references by comparing resolved paths
            const resolvedPath = await fs.promises.realpath(full);
            if (!resolvedPath.startsWith(resolvedRoot)) {
              console.warn(`Skipping symbolic link outside root: ${full} -> ${resolvedPath}`);
              continue;
            }
            await walk(full, currentDepth + 1);
          } else if (stats.isFile()) {
            files.push({ full, rel });
          }
        } catch (err) {
          console.error(`Error processing symbolic link ${full}:`, err.message);
          continue;
        }
      }
    }
  }

  await walk(resolvedRoot);

  return files;
}

async function buildContext(files, root) {
  let out = '';
  for (const f of files) {
    let buffer;
    try {
      buffer = await fs.promises.readFile(f.full);
    } catch (err) {
      console.error('Failed to read', f.full, err.message);
      continue;
    }

    if(isBinaryFileSync(buffer, buffer.length)) {
      continue;
    }

    const content = buffer.toString('utf8');

    // prefix block with two leading newlines, then a separator block
    out += '\n\n';
    out += '================================================\n';
    out += `FILE: ${path.resolve(f.full)}\n`;
    out += '================================================\n\n';

    // Determine fence and language
    const lang = getLangForFile(f.full);
    const fence = fenceFor(content);
    const fenceStart = lang ? `${fence}${lang}\n` : `${fence}\n`;
    const fenceEnd = `\n${fence}\n\n`;

    out += fenceStart + content + fenceEnd;
  }
  return out;
}

async function main() {
  const { input, exclude, output, help } = parseArgs(process.argv);
  if (help || !input) {
    usage();
    process.exit(help ? 0 : 1);
  }

  const inputPath = path.resolve(input);
  let stats;
  try {
    stats = await fs.promises.stat(inputPath);
  } catch (err) {
    console.error('Input path does not exist:', inputPath);
    process.exit(2);
  }
  if (!stats.isDirectory()) {
    console.error('Input must be a directory');
    process.exit(3);
  }

  const excludeRegexes = compileExcludeRegexes(exclude);

  const files = await collectFiles(inputPath, excludeRegexes);
  if (!files.length) {
    console.error('No files found to process.');
    process.exit(4);
  }

  const context = await buildContext(files, inputPath);

  const outPath = output ? path.resolve(output) : path.resolve(process.cwd(), DEFAULT_OUTPUT);
  try {
    await fs.promises.writeFile(outPath, context, 'utf8');
    console.log('Wrote merged context to', outPath);
  } catch (err) {
    console.error('Failed to write output:', err.message);
    process.exit(5);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}
