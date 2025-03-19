const fs = require('fs');
const path = require('path');
const readline = require('readline');

const nsxFile = path.join(__dirname, '../main.nsx');
const outputDir = path.join(__dirname, '../output');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Convert .nsx file to HTML, CSS, JS
function convertNSX() {
  if (!fs.existsSync(nsxFile)) {
    console.log("\x1b[31;1m","main.nsx not found.","\x1b[0m");
    return;
  }

  const nsxContent = fs.readFileSync(nsxFile, 'utf8');

  let htmlContent = "";
  let cssContent = "";
  let jsContent = "";
  let extraCssImports = [];
  let extraJsImports = [];

  const lines = nsxContent.split('\n');
  let isFunctionBlock = false;
  let functionBlockContent = "";

  for (let line of lines) {
    const stripped = line.trim();

    if (stripped.startsWith("#fn")) {
      isFunctionBlock = true;
      functionBlockContent = "function " + stripped.slice("#fn".length).trim() + "\n";
      continue;
    }

    if (stripped.startsWith("#efn")) {
      isFunctionBlock = false;
      jsContent += functionBlockContent;
      functionBlockContent = "";
      continue;
    }

    if (isFunctionBlock) {
      functionBlockContent += line + "\n";
      continue;
    }

    if (stripped.startsWith("$")) {
      const raw = stripped.slice(1).trim();
      const parts = raw.split(" ");
      const firstPart = parts[0];
      const content = parts.slice(1).join(" "); // Join all parts after the first one
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
    } else if (stripped.startsWith("%")) {
      const content = stripped.slice(1).trim();
      const firstSpaceIndex = content.indexOf(" ");
      const selector = content.slice(0, firstSpaceIndex); 
      const rules = content.slice(firstSpaceIndex + 1).trim(); 
      cssContent += `${selector} {${rules}}\n`;
    } else if (stripped.startsWith("!")) {
      jsContent += stripped.slice(1).trim() + "\n";
    }
  }

  // Clear output folder before writing new files
  if (fs.existsSync(outputDir)) {
    fs.readdirSync(outputDir).forEach(file => {
      fs.unlinkSync(path.join(outputDir, file));
    });
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Add the extra imports in the head
  let head = `<script src="script.js"></script><link rel="stylesheet" href="style.css">`;
  for (let jsFile of extraJsImports) {
    head += `<script src="${jsFile}"></script>`;
  }
  for (let cssFile of extraCssImports) {
    head += `<link rel="stylesheet" href="${cssFile}">`;
  }

  const fullHtml = `${head}\n${htmlContent}`;
  fs.writeFileSync(path.join(outputDir, 'index.html'), fullHtml);
  fs.writeFileSync(path.join(outputDir, 'style.css'), cssContent);
  fs.writeFileSync(path.join(outputDir, 'script.js'), jsContent);
}

// Show command help
function showHelp() {
  console.log("\x1b[34m",`
Commands:
r  - Reload files
q  - Quit the program
`,"\x1b[0m");
}

// Monitor file changes manually (no package required)
fs.watch(nsxFile, { encoding: 'utf8' }, (eventType, filename) => {
  if (filename && eventType === 'change') {
    convertNSX();
    lastMtime = fs.statSync(nsxFile).mtime;
  }
});

// Start the program
console.log('\x1b[32;1m', 'NSX Compiler Running, Press h for help',"\x1b[0m");
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
    console.log('\x1b[32m', 'Files updated',"\x1b[0m");
  } else {
    console.log("\x1b[33m","Unknown command. Press 'h' for help.","\x1b[0m");
  }
});