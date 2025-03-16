const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process'); // Using built-in module for opening the browser

const nsxFile = path.join(__dirname, '../main.nsx');
const outputDir = path.join(__dirname, '../output');

let lastMtime = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Convert .nsx file to HTML, CSS, JS
function convertNSX() {
  if (!fs.existsSync(nsxFile)) {
    console.log("main.nsx not found.");
    return;
  }

  const nsxContent = fs.readFileSync(nsxFile, 'utf8');
  const multiJsStart = "#jss";
  const multiJsEnd = "#jse";

  let htmlContent = "";
  let cssContent = "";
  let jsContent = "";
  let insideJsBlock = false;
  let extraCssImports = [];
  let extraJsImports = [];

  const lines = nsxContent.split('\n');

  for (let line of lines) {
    const stripped = line.trim();

    // Handle multi-line JS block
    if (insideJsBlock) {
      if (stripped.startsWith(multiJsEnd)) {
        insideJsBlock = false;
      } else {
        jsContent += line + "\n";
      }
      continue;
    }

    if (stripped === multiJsStart) {
      insideJsBlock = true;
      continue;
    }

    if (stripped.startsWith("$")) {
      const raw = stripped.slice(1).trim();
      const parts = raw.split(" ", 2);
      const firstPart = parts[0];
      const content = parts[1] || "";
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
      cssContent += stripped.slice(1).trim() + "\n";
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
  console.log(`
Commands:
o  - Open index.html in browser
r  - Reload index.html
q  - Quit the program
`);
}

// Monitor file changes manually (no package required)
fs.watch(nsxFile, { encoding: 'utf8' }, (eventType, filename) => {
  if (filename && eventType === 'change') {
    convertNSX();
    lastMtime = fs.statSync(nsxFile).mtime;
  }
});

// Start the program
console.log("NSX started. Press 'h' to show commands.");
convertNSX(); // Initial conversion

// Read user input continuously
rl.on('line', (input) => {
  const userInput = input.trim().toLowerCase();

  if (userInput === 'q') {
    rl.close();
    process.exit(0);
  } else if (userInput === 'o') {
    // Open in browser using native OS commands
    const filePath = path.join(outputDir, 'index.html');
    const platform = process.platform;
    if (platform === 'win32') {
      exec(`start ${filePath}`); // For Windows
    } else if (platform === 'darwin') {
      exec(`open ${filePath}`); // For macOS
    } else {
      exec(`xdg-open ${filePath}`); // For Linux
    }
  } else if (userInput === 'h') {
    showHelp();
  } else if (userInput === 'r') {
    convertNSX();
  } else {
    console.log("Unknown command. Press 'h' for help.");
  }
});
