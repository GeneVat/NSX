const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const nsxFile = path.join(__dirname, '../main.nsx');
const outputDir = path.join(__dirname, '../output');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Token types
const TokenType = {
  HTML: 'HTML',
  CSS: 'CSS',
  JS: 'JS',
  FUNCTION_START: 'FUNCTION_START',
  FUNCTION_END: 'FUNCTION_END',
  EOF: 'EOF'
};

class NSXSyntaxError extends Error {
  constructor(message, line) {
    super(`NSX Syntax Error: ${message} at line ${line}`);
    this.line = line;
  }
}

function lexer(input) {
  const tokens = [];
  const lines = input.split('\n');
  let inBlock = false;
  let blockType = null;
  let blockContent = '';
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();

    if (stripped.startsWith("*")) {
      continue;
    }

    if (inBlock) {
      if (stripped.endsWith('}')) {
        blockContent += ' ' + stripped.slice(0, -1).trim();
        tokens.push({ 
          type: blockType, 
          value: blockContent, 
          line: blockStartLine 
        });
        inBlock = false;
        blockType = null;
        blockContent = '';
      } else {
        blockContent += ' ' + stripped;
      }
      continue;
    }

    if (stripped.startsWith("#!")) {
      tokens.push({ type: TokenType.FUNCTION_START, value: stripped.slice("#!".length).trim(), line: i + 1 });
    } else if (stripped.startsWith("#!e")) {
      tokens.push({ type: TokenType.FUNCTION_END, value: '', line: i + 1 });
    } else if (stripped.startsWith("$")) {
      const content = stripped.slice(1).trim();
      if (content.endsWith('{')) {
        inBlock = true;
        blockType = TokenType.HTML;
        blockContent = content.slice(0, -1).trim();
        blockStartLine = i + 1;
      } else {
        tokens.push({ type: TokenType.HTML, value: content, line: i + 1 });
      }
    } else if (stripped.startsWith("%")) {
      const content = stripped.slice(1).trim();
      if (content.endsWith('{')) {
        inBlock = true;
        blockType = TokenType.CSS;
        blockContent = content.slice(0, -1).trim();
        blockStartLine = i + 1;
      } else {
        tokens.push({ type: TokenType.CSS, value: content, line: i + 1 });
      }
    } else if (stripped.startsWith("!")) {
      tokens.push({ type: TokenType.JS, value: stripped.slice(1).trim(), line: i + 1 });
    } else if (stripped !== "") {
      console.error(`\x1b[31;1mNSX Syntax Error: Invalid syntax "${stripped}" at line ${i + 1}\x1b[0m`);
    }
  }

  if (inBlock) {
    console.error(`\x1b[31;1mNSX Syntax Error: Unclosed ${blockType} block starting at line ${blockStartLine}\x1b[0m`);
  }

  tokens.push({ type: TokenType.EOF, value: '', line: lines.length });
  return tokens;
}

function parseNestedHTML(value) {
  const parts = value.split("&");
  const mainTagWithAttributes = parts[0].trim();
  const nestedTags = parts.slice(1);

  const [mainTag, ...mainAttributes] = mainTagWithAttributes.split("+");
  let mainTagAttributes = "";
  for (const attr of mainAttributes) {
    if (attr.includes("=")) {
      const [key, value] = attr.split("=");
      mainTagAttributes += ` ${key}=${value.replace(/\+/g, " ")}`;
    } else {
      mainTagAttributes += ` ${attr}`;
    }
  }

  let html = `<${mainTag}${mainTagAttributes}>`;

  for (const nestedTag of nestedTags) {
    const nestedParts = nestedTag.trim().split(" ");
    const nestedTagWithAttributes = nestedParts[0];
    const content = nestedParts.slice(1).join(" ").replace(/'/g, "");

    const [nestedTagName, ...nestedAttributes] = nestedTagWithAttributes.split("+");
    let nestedTagAttributes = "";
    for (const attr of nestedAttributes) {
      if (attr.includes("=")) {
        const [key, value] = attr.split("=");
        nestedTagAttributes += ` ${key}=${value.replace(/\+/g, " ")}`;
      } else {
        nestedTagAttributes += ` ${attr}`;
      }
    }

    html += `<${nestedTagName}${nestedTagAttributes}>${content}</${nestedTagName}>`;
  }

  html += `</${mainTag}>`;
  return html;
}

function parser(tokens) {
  let htmlContent = "";
  let cssContent = "";
  let jsContent = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    try {
      switch (token.type) {
        case TokenType.HTML:
          if (token.value.includes("&")) {
            htmlContent += parseNestedHTML(token.value) + "\n";
          } else {
            const raw = token.value;
            const parts = raw.split(" ");
            const firstPart = parts[0];
            const content = parts.slice(1).join(" ");
            const parts2 = firstPart.split("+");
            const tag = parts2[0];
            let attributes = "";

            for (let attr of parts2.slice(1)) {
              if (attr.includes("=")) {
                const [key, value] = attr.split("=");
                attributes += ` ${key}=${value.replace(/\+/g, " ")}`;
              } else {
                attributes += ` ${attr}`;
              }
            }

            htmlContent += `<${tag}${attributes}>${content}</${tag}>\n`;
          }
          break;

        case TokenType.CSS:
          if (token.value.includes("{")) {
            // This is a CSS block that was already processed by the lexer
            const parts = token.value.split(" ");
            const selector = parts[0];
            const rules = parts.slice(1).join(" ");
            cssContent += `${selector} {${rules}}\n`;
          } else {
            const cssParts = token.value.split(" ");
            if (cssParts.length < 2) {
              console.error(`\x1b[31;1mNSX Syntax Error: Invalid CSS rule "${token.value}" at line ${token.line}\x1b[0m`);
              break;
            }
            const selector = cssParts[0];
            const rules = cssParts.slice(1).join(" ");
            cssContent += `${selector} {${rules}}\n`;
          }
          break;

        case TokenType.JS:
          jsContent += token.value + "\n";
          break;

        case TokenType.FUNCTION_START:
          jsContent += `function ${token.value} {\n`;
          while (tokens[++i].type !== TokenType.FUNCTION_END) {
            if (tokens[i].type === TokenType.EOF) {
              console.error(`\x1b[31;1mNSX Syntax Error: Unclosed function block at line ${token.line}\x1b[0m`);
              break;
            }
            jsContent += tokens[i].value + "\n";
          }
          jsContent += "}\n";
          break;

        default:
          break;
      }
    } catch (error) {
      console.error(`\x1b[31;1mUnexpected error: ${error.message}\x1b[0m`);
    }
  }

  return { htmlContent, cssContent, jsContent };
}

function convertNSX() {
  if (!fs.existsSync(nsxFile)) {
    console.log("\x1b[31;1m", "main.nsx not found.", "\x1b[0m");
    return;
  }

  try {
    const nsxContent = fs.readFileSync(nsxFile, 'utf8');
    const tokens = lexer(nsxContent);
    const { htmlContent, cssContent, jsContent } = parser(tokens);

    if (fs.existsSync(outputDir)) {
      fs.readdirSync(outputDir).forEach(file => {
        fs.unlinkSync(path.join(outputDir, file));
      });
    } else {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const head = `<link rel="stylesheet" href="style.css"><script src="script.js"></script>`;
    const fullHtml = `${head}\n${htmlContent}`;
    fs.writeFileSync(path.join(outputDir, 'index.html'), fullHtml);
    fs.writeFileSync(path.join(outputDir, 'style.css'), cssContent);
    fs.writeFileSync(path.join(outputDir, 'script.js'), jsContent);
  } catch (error) {
    console.error(`\x1b[31;1mError: ${error.message}\x1b[0m`);
  }
}

function showHelp() {
  console.log("\x1b[34m", `
Commands:
r  - Reload files (recompile .nsx)
c  - Clear console
q  - Quit the program
h  - Show this help menu
l  - List all output files
`, "\x1b[0m");
}

function listOutputFiles() {
  if (!fs.existsSync(outputDir)) {
    console.log("\x1b[31;1m", "Output directory does not exist.", "\x1b[0m");
    return;
  }

  const files = fs.readdirSync(outputDir);
  if (files.length === 0) {
    console.log("\x1b[33m", "No files found in the output directory.", "\x1b[0m");
  } else {
    console.log("\x1b[32m", "Output files:", "\x1b[0m");
    files.forEach(file => {
      console.log(`- ${file}`);
    });
  }

  const platform = process.platform;
  let command;

  if (platform === 'win32') {
    command = `start "" "${outputDir}"`;
  } else if (platform === 'darwin') {
    command = `open "${outputDir}"`;
  } else if (platform === 'linux') {
    command = `xdg-open "${outputDir}"`;
  } else {
    console.log("\x1b[31;1m", "Unsupported platform.", "\x1b[0m");
    return;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`\x1b[31;1mError: ${error.message}\x1b[0m`);
    }
  });
}

fs.watch(nsxFile, { encoding: 'utf8' }, (eventType, filename) => {
  if (filename && eventType === 'change') {
    convertNSX();
  }
});

console.log('\x1b[32;1m', 'NSX Compiler Running, Press h for help', "\x1b[0m");
convertNSX();

rl.on('line', (input) => {
  const userInput = input.trim().toLowerCase();

  switch (userInput) {
    case 'q':
      rl.close();
      process.exit(0);
      break;
    case 'h':
      showHelp();
      break;
    case 'r':
      convertNSX();
      console.log('\x1b[32m', 'Files updated', "\x1b[0m");
      break;
    case 'c':
      console.clear();
      break;
    case 'l':
      listOutputFiles();
      break;
    default:
      console.log("\x1b[33m", "Unknown command. Press 'h' for help.", "\x1b[0m");
      break;
  }
});