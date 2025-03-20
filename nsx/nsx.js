const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Custom error class for NSX syntax errors
class NSXSyntaxError extends Error {
  constructor(message, line) {
    super(`NSX Syntax Error: ${message} at line ${line}`);
    this.line = line;
  }
}

// Lexer
function lexer(input) {
  const tokens = [];
  const lines = input.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();

    if (stripped.startsWith("#!")) {
      tokens.push({ type: TokenType.FUNCTION_START, value: stripped.slice("#!".length).trim(), line: i + 1 });
    } else if (stripped.startsWith("#!e")) {
      tokens.push({ type: TokenType.FUNCTION_END, value: '', line: i + 1 });
    } else if (stripped.startsWith("$")) {
      tokens.push({ type: TokenType.HTML, value: stripped.slice(1).trim(), line: i + 1 });
    } else if (stripped.startsWith("%")) {
      tokens.push({ type: TokenType.CSS, value: stripped.slice(1).trim(), line: i + 1 });
    } else if (stripped.startsWith("!")) {
      tokens.push({ type: TokenType.JS, value: stripped.slice(1).trim(), line: i + 1 });
    } else if (stripped !== "") {
      throw new NSXSyntaxError(`Invalid syntax: "${stripped}"`, i + 1);
    }
  }

  tokens.push({ type: TokenType.EOF, value: '', line: lines.length });
  return tokens;
}

// Parse nested HTML tags with attributes
function parseNestedHTML(value) {
  const parts = value.split("&");
  const mainTagWithAttributes = parts[0].trim();
  const nestedTags = parts.slice(1);

  // Parse main tag and its attributes
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

  // Parse nested tags and their attributes
  for (const nestedTag of nestedTags) {
    const nestedParts = nestedTag.trim().split(" ");
    const nestedTagWithAttributes = nestedParts[0];
    const content = nestedParts.slice(1).join(" ").replace(/'/g, ""); // Remove single quotes

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

// Parser
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
          const cssParts = token.value.split(" ");
          if (cssParts.length < 2) {
            throw new NSXSyntaxError(`Invalid CSS rule: "${token.value}"`, token.line);
          }
          const selector = cssParts[0];
          const rules = cssParts.slice(1).join(" ");
          cssContent += `${selector} {${rules}}\n`;
          break;

        case TokenType.JS:
          jsContent += token.value + "\n";
          break;

        case TokenType.FUNCTION_START:
          jsContent += `function ${token.value} {\n`;
          while (tokens[++i].type !== TokenType.FUNCTION_END) {
            if (tokens[i].type === TokenType.EOF) {
              throw new NSXSyntaxError(`Unclosed function block`, token.line);
            }
            jsContent += tokens[i].value + "\n";
          }
          jsContent += "}\n";
          break;

        default:
          break;
      }
    } catch (error) {
      if (error instanceof NSXSyntaxError) {
        console.error(`\x1b[31;1m${error.message}\x1b[0m`);
        process.exit(1);
      } else {
        throw error;
      }
    }
  }

  return { htmlContent, cssContent, jsContent };
}

// Convert .nsx file to HTML, CSS, JS
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
    if (error instanceof NSXSyntaxError) {
      console.error(`\x1b[31;1m${error.message}\x1b[0m`);
    } else {
      console.error(`\x1b[31;1mUnexpected error: ${error.message}\x1b[0m`);
    }
    process.exit(1);
  }
}

// Show command help
function showHelp() {
  console.log("\x1b[34m", `
Commands:
r  - Reload files
q  - Quit the program
`, "\x1b[0m");
}

// Monitor file changes manually (no package required)
fs.watch(nsxFile, { encoding: 'utf8' }, (eventType, filename) => {
  if (filename && eventType === 'change') {
    convertNSX();
  }
});

// Start the program
console.log('\x1b[32;1m', 'NSX Compiler Running, Press h for help', "\x1b[0m");
convertNSX(); // Initial conversion

// Read user input continuously
rl.on('line', (input) => {
  const userInput = input.trim().toLowerCase();

  if (userInput === 'q') {
    rl.close();
    process.exit(0);
  } else if (userInput === 'h') {
    showHelp();
  } else if (userInput === 'r') {
    convertNSX();
    console.log('\x1b[32m', 'Files updated', "\x1b[0m");
  } else {
    console.log("\x1b[33m", "Unknown command. Press 'h' for help.", "\x1b[0m");
  }
});