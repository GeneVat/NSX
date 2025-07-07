const https = require('https'), fs = require('fs'), path = require('path'), readline = require('readline'), {exec} = require('child_process'), {
        currentTag = 'v0.6.0'
    } = process.env, VERSION = currentTag, NSX_DIR = path.join(__dirname, '../src'), OUTPUT_DIR = path.join(__dirname, '../dist'), TokenType = {
        'HTML': 'HTML',
        'CSS': 'CSS',
        'JS': 'JS',
        'EOF': 'EOF'
    }, colors = {
        'error': 31,
        'success': 32,
        'info': 34
    }, log = (type, message) => console.log('\x1B[' + colors[type] + 'm' + message + '\x1B[0m');
class NSXError extends Error {
    constructor(message, line = null, column = null) {
        super('NSX Error: ' + message + (line !== null ? ' at line ' + line : '') + (column !== null ? ', column ' + column : ''));
        this.line = line;
        this.column = column;
    }
}
https.get('https://api.github.com/repos/GeneVat/NSX/tags', { 'headers': { 'User-Agent': 'Node.js' } }, response => {
    let rawData = '';
    response.on('data', chunk => rawData += chunk);
    response.on('end', () => {
        const latestTag = JSON.parse(rawData)[0]?.name;
        latestTag && latestTag > currentTag && console.log('NSX (' + currentTag + ') is outdated. Update to ' + latestTag + ' on Github.com/GeneVat/NSX/releases/tag/' + latestTag);
    });
}).on('error', () => {
});
function lex(inputContent) {
    const tokens = [], lines = inputContent.split('\n').filter(line => (line = line.trim()) && !line.startsWith('*')), tokenTypeMap = {
            '$': TokenType.HTML,
            '%': TokenType.CSS,
            '!': TokenType.JS
        };
    for (let i = 0; i < lines.length;) {
        const lineNumber = i + 1, currentLine = lines[i], trimmedLine = currentLine.trim(), lineMatch = currentLine.match(/^([$\%!])\s*(.*)$/);
        if (!trimmedLine || trimmedLine.startsWith('*')) {
            i++;
            continue;
        }
        if (lineMatch && tokenTypeMap[lineMatch[1]]) {
            const tokenType = tokenTypeMap[lineMatch[1]], initialValue = lineMatch[2];
            let valueContent = initialValue;
            const startLine = lineNumber;
            if (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || lines[i + 1].startsWith('\t'))) {
                valueContent = initialValue ? initialValue + '\n' : '';
                let nextLineIndex = i + 1;
                while (nextLineIndex < lines.length && (/^\s/.test(lines[nextLineIndex]) || lines[nextLineIndex].startsWith('\t'))) {
                    valueContent += lines[nextLineIndex++].replace(/^(\t| {1,2})/, '') + '\n';
                }
                tokens.push({
                    'type': tokenType,
                    'value': valueContent.trimEnd(),
                    'line': startLine,
                    'column': 1
                });
                i = nextLineIndex;
                continue;
            } else {
                tokens.push({
                    'type': tokenType,
                    'value': valueContent,
                    'line': startLine,
                    'column': 1
                });
                i++;
                continue;
            }
        } else {
            if (trimmedLine === '#C2') {
                i++;
                continue;
            } else {
                log('error', 'Invalid syntax "' + trimmedLine + '" at line ' + lineNumber + ', column 1');
                i++;
            }
        }
    }
    return tokens.push({
        'type': TokenType.EOF,
        'value': '',
        'line': lines.length + 1,
        'column': 1
    }), tokens;
}
function parseHTML(htmlContent) {
    function parseAttributes(attrString) {
        const attributes = {};
        let i = 0, len = attrString.length;
        while (i < len) {
            while (i < len && /\s/.test(attrString[i])) {
                i++;
            }
            if (i >= len) {
                break;
            }
            let attrName = '';
            while (i < len && /[^\s=]/.test(attrString[i])) {
                attrName += attrString[i++];
            }
            while (i < len && /\s/.test(attrString[i])) {
                i++;
            }
            if (attrString[i] !== '=') {
                i++;
                continue;
            }
            i++;
            while (i < len && /\s/.test(attrString[i])) {
                i++;
            }
            let attrValue = '', valueStartPos = i;
            if (attrString[i] === '"' || attrString[i] === '\'') {
                const quoteChar = attrString[i++];
                let hasClosedQuote = false;
                while (i < len) {
                    if (attrString[i] === '\\' && i + 1 < len && attrString[i + 1] === quoteChar) {
                        attrValue += quoteChar;
                        i += 2;
                    } else {
                        if (attrString[i] === quoteChar) {
                            i++;
                            hasClosedQuote = true;
                            break;
                        } else {
                            attrValue += attrString[i++];
                        }
                    }
                }
                if (!hasClosedQuote) {
                    throw new NSXError('Unclosed quote in attribute value: ' + attrName, null, valueStartPos + 1);
                }
            } else {
                while (i < len && /[^\s)]/.test(attrString[i])) {
                    attrValue += attrString[i++];
                }
            }
            attributes[attrName] = attrValue.replace(/\+/g, ' ');
        }
        return attributes;
    }
    function parseTagAndAttributes(tagString) {
        const match = tagString.match(/^([a-zA-Z][a-zA-Z0-9\-_]*)(\[([^\]]*)\])?/);
        if (!match) {
            throw new NSXError('Invalid tag name in "' + tagString + '"', null, 1);
        }
        return {
            'tagName': match[1],
            'attrs': match[3] ? parseAttributes(match[3]) : {}
        };
    }
    const isSelfClosingTag = tagName => /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tagName);
    function escapeHtml(htmlString) {
        return htmlString.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/#d;/g, '$').replace(/#a;/g, '&');
    }
    const generateHtmlTag = (tagName, attributes, content) => '<' + tagName + (Object.entries(attributes).length ? ' ' + Object.entries(attributes).map(([attrName, attrValue]) => attrName + '="' + attrValue + '"').join(' ') : '') + (isSelfClosingTag(tagName) ? ' /' : '') + '>' + (isSelfClosingTag(tagName) ? '' : escapeHtml(content) + ('</' + tagName + '>'));
    function processHtmlLine(line) {
        let tagPart = line, contentPart = '';
        const tagMatch = line.match(/^([a-zA-Z0-9\-_]+(\[[^\]]*\])?)/);
        tagMatch && (tagPart = tagMatch[1], contentPart = line.slice(tagPart.length).trim());
        const {
            tagName,
            attrs
        } = parseTagAndAttributes(tagPart);
        return generateHtmlTag(tagName, attrs, contentPart);
    }
    function splitHtmlBlocks(htmlString) {
        const blocks = [];
        let currentContent = '', parenthesisCount = 0, charIndex = 0;
        while (charIndex < htmlString.length) {
            const char = htmlString[charIndex];
            if (char === '(') {
                parenthesisCount++;
                currentContent += char;
                charIndex++;
                continue;
            }
            if (char === ')') {
                parenthesisCount--;
                if (parenthesisCount < 0) {
                    throw new NSXError('Unbalanced parentheses in HTML block at position ' + charIndex, null, charIndex + 1);
                }
                currentContent += char;
                charIndex++;
                continue;
            }
            if (char === '&' && parenthesisCount === 0) {
                let level = 1;
                charIndex++;
                while (htmlString[charIndex] === '&') {
                    level++;
                    charIndex++;
                }
                blocks.push({
                    'level': level,
                    'content': currentContent.trim()
                });
                currentContent = '';
                continue;
            }
            currentContent += char;
            charIndex++;
        }
        if (currentContent.trim()) {
            blocks.push({
                'level': 1,
                'content': currentContent.trim()
            });
        }
        return blocks;
    }
    const processedHtml = htmlContent.startsWith('$') ? htmlContent.slice(1).trim() : htmlContent.trim(), htmlBlocks = splitHtmlBlocks(processedHtml);
    if (!htmlBlocks.length) {
        return '';
    }
    const htmlStack = [];
    for (const {
                level,
                content
            } of htmlBlocks) {
        try {
            const generatedHtml = processHtmlLine(content);
            if (htmlStack.length < level) {
                htmlStack.push(generatedHtml);
            } else {
                let currentHtml = generatedHtml;
                while (htmlStack.length >= level) {
                    const previousHtml = htmlStack.pop();
                    currentHtml = previousHtml.replace(/<\/[^>]+>$/, () => currentHtml + '</' + previousHtml.match(/^<([a-zA-Z0-9\-_]+)/)[1] + '>');
                }
                htmlStack.push(currentHtml);
            }
        } catch (error) {
            log('error', error instanceof NSXError ? error.message : 'HTML Parsing Error: ' + error.message);
        }
    }
    return htmlStack.reduceRight((accumulator, current) => current.replace(/<\/[^>]+>$/, () => accumulator + '</' + current.match(/^<([a-zA-Z0-9\-_]+)/)[1] + '>'));
}
;
function parseCSS(cssContent) {
    const replacedPercent = cssContent.replace(/#p;/g, '%'), trimmedCss = replacedPercent.trim();
    if (trimmedCss.includes('{') && trimmedCss.includes('}') && trimmedCss.includes(':')) {
        return replacedPercent;
    }
    const equalsIndex = trimmedCss.indexOf('=');
    if (equalsIndex !== -1) {
        const selector = trimmedCss.slice(0, equalsIndex).trim();
        let properties = trimmedCss.slice(equalsIndex + 1).trim();
        if (replacedPercent.includes('\n')) {
            properties = replacedPercent.split('\n').slice(1).map(line => line.trim()).filter(Boolean).join(' ');
        }
        if (selector && properties) {
            return selector + ' { ' + properties + ' }';
        }
    }
    const parts = trimmedCss.split(/\s+/), selector = parts[0], properties = parts.slice(1);
    if (!selector || !properties.length) {
        return replacedPercent;
    }
    return selector + ' { ' + properties.join(' ') + ' }';
}
function parse(tokens) {
    const components = new Map(), parseArguments = componentArgs => {
            const parsedArgs = {};
            let match;
            while (match = /([a-zA-Z0-9_]+)(?:\s*=\s*(?:(['"])(.*?)\2|([^\s"'\]]+)))?/g.exec(componentArgs)) {
                parsedArgs[match[1]] = match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : '';
            }
            return /([a-zA-Z0-9_]+)(?:\s*=\s*(?:(['"])(.*?)\2|([^\s"'\]]+)))?/g.lastIndex = 0, parsedArgs;
        }, replacePlaceholders = (template, data) => template.replace(/\{pass\.([a-zA-Z0-9_]+)\}/g, (fullMatch, key) => data[key] !== undefined ? data[key] : '');
    const compiledOutput = { html: '', css: '', js: '' };
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
            if (token.type === TokenType.HTML) {
                compiledOutput.html += parseHTML(token.value) + '\n';
            } else {
                if (token.type === TokenType.CSS) {
                    compiledOutput.css += parseCSS(token.value) + '\n';
                } else {
                    if (token.type === TokenType.JS) {
                        const jsCode = token.value.replace(/#e;/g, '!');
                        if (jsCode.startsWith('add ')) {
                            const addMatch = /^add\s+([a-zA-Z0-9_]+)(?:\s*\[([^\]]*)\])?\s*(.*)$/s.exec(jsCode);
                            if (!addMatch) {
                                throw new NSXError('Invalid add syntax', token.line, 1);
                            }
                            const componentName = addMatch[1];
                            let componentHtml = addMatch[3].trim();
                            if (componentHtml.startsWith('$')) {
                                componentHtml = parseHTML(componentHtml);
                            }
                            components.set(componentName, {
                                'html': componentHtml,
                                'args': addMatch[2] || ''
                            });
                        } else {
                            if (jsCode.startsWith('use ')) {
                                const useMatch = /^use\s+([a-zA-Z0-9_]+)(?:\s*\[([^\]]*)\])?/.exec(jsCode);
                                if (!useMatch) {
                                    throw new NSXError('Invalid use syntax', token.line, 1);
                                }
                                const componentToUse = useMatch[1], componentArguments = parseArguments(useMatch[2] || ''), componentData = components.get(componentToUse);
                                if (!componentData) {
                                    throw new NSXError('Component "' + componentToUse + '" used before definition', token.line, 1);
                                }
                                compiledOutput.html += replacePlaceholders(componentData.html, componentArguments) + '\n';
                            } else {
                                compiledOutput.js += jsCode + '\n';
                            }
                        }
                    }
                }
            }
        } catch (error) {
            log('error', error instanceof NSXError ? error.message : 'Parsing Error near line ' + (token?.line || 'unknown') + ', column ' + (token?.column || 1) + ': ' + error.message);
        }
    }
    return compiledOutput;
}
function transformCSS(cssContent) {
    const cssTransformations = [
        [
            /text-align-([a-z]+)/g,
            'text-align',
            value => value
        ],
        [
            /text-decoration-([a-z]+)/g,
            'text-decoration',
            value => value
        ],
        [
            /text-transform-([a-z]+)/g,
            'text-transform',
            value => value
        ],
        [
            /text-shadow-([^;]+)/g,
            'text-shadow',
            value => value
        ],
        [
            /size-([0-9]+)(px|em|rem|%)?/g,
            'font-size',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /font-family-([a-zA-Z0-9,\s"'-]+)/g,
            'font-family',
            value => value
        ],
        [
            /font-weight-([a-z0-9]+)/g,
            'font-weight',
            value => value
        ],
        [
            /font-style-([a-z]+)/g,
            'font-style',
            value => value
        ],
        [
            /line-height-([0-9.]+)/g,
            'line-height',
            value => value
        ],
        [
            /letter-spacing-([0-9.]+)(px|em|rem)?/g,
            'letter-spacing',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /word-spacing-([0-9.]+)(px|em|rem)?/g,
            'word-spacing',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /color-([#a-zA-Z0-9]+)/g,
            'color',
            value => value
        ],
        [
            /background-([#a-zA-Z0-9]+)/g,
            'background',
            value => value
        ],
        [
            /background-color-([#a-zA-Z0-9]+)/g,
            'background-color',
            value => value
        ],
        [
            /background-image-([^;]+)/g,
            'background-image',
            value => value
        ],
        [
            /background-size-([a-z0-9% ]+)/g,
            'background-size',
            value => value
        ],
        [
            /background-position-([a-z0-9% ]+)/g,
            'background-position',
            value => value
        ],
        [
            /background-repeat-([a-z]+)/g,
            'background-repeat',
            value => value
        ],
        [
            /margin-([0-9]+)(px|em|rem|%)?/g,
            'margin',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /margin-top-([0-9]+)(px|em|rem|%)?/g,
            'margin-top',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /margin-right-([0-9]+)(px|em|rem|%)?/g,
            'margin-right',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /margin-bottom-([0-9]+)(px|em|rem|%)?/g,
            'margin-bottom',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /margin-left-([0-9]+)(px|em|rem|%)?/g,
            'margin-left',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /padding-([0-9]+)(px|em|rem|%)?/g,
            'padding',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /padding-top-([0-9]+)(px|em|rem|%)?/g,
            'padding-top',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /padding-right-([0-9]+)(px|em|rem|%)?/g,
            'padding-right',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /padding-bottom-([0-9]+)(px|em|rem|%)?/g,
            'padding-bottom',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /padding-left-([0-9]+)(px|em|rem|%)?/g,
            'padding-left',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /border-([0-9]+)(px|em|rem)?-([a-z]+)-([#a-zA-Z0-9]+)/g,
            'border',
            (width, unit, style, color) => '' + width + (unit || 'px') + ' ' + style + ' ' + color
        ],
        [
            /border-([0-9]+)(px|em|rem)?/g,
            'border-width',
            (width, unit) => width + (unit || 'px')
        ],
        [
            /border-style-([a-z]+)/g,
            'border-style',
            value => value
        ],
        [
            /border-color-([#a-zA-Z0-9]+)/g,
            'border-color',
            value => value
        ],
        [
            /border-radius-([0-9]+)(px|em|rem)?/g,
            'border-radius',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /width-([0-9]+)(px|em|rem|%)?/g,
            'width',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /height-([0-9]+)(px|em|rem|%)?/g,
            'height',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /max-width-([0-9]+)(px|em|rem|%)?/g,
            'max-width',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /min-width-([0-9]+)(px|em|rem|%)?/g,
            'min-width',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /max-height-([0-9]+)(px|em|rem|%)?/g,
            'max-height',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /min-height-([0-9]+)(px|em|rem|%)?/g,
            'min-height',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /display-([a-z]+)/g,
            'display',
            value => value
        ],
        [
            /flex-direction-([a-z]+)/g,
            'flex-direction',
            value => value
        ],
        [
            /flex-wrap-([a-z]+)/g,
            'flex-wrap',
            value => value
        ],
        [
            /justify-content-([a-z-]+)/g,
            'justify-content',
            value => value
        ],
        [
            /align-items-([a-z-]+)/g,
            'align-items',
            value => value
        ],
        [
            /align-content-([a-z-]+)/g,
            'align-content',
            value => value
        ],
        [
            /gap-([0-9]+)(px|em|rem|%)?/g,
            'gap',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /row-gap-([0-9]+)(px|em|rem|%)?/g,
            'row-gap',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /column-gap-([0-9]+)(px|em|rem|%)?/g,
            'column-gap',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /position-([a-z]+)/g,
            'position',
            value => value
        ],
        [
            /top-([0-9]+)(px|em|rem|%)?/g,
            'top',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /right-([0-9]+)(px|em|rem|%)?/g,
            'right',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /bottom-([0-9]+)(px|em|rem|%)?/g,
            'bottom',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /left-([0-9]+)(px|em|rem|%)?/g,
            'left',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /overflow-([a-z]+)/g,
            'overflow',
            value => value
        ],
        [
            /overflow-x-([a-z]+)/g,
            'overflow-x',
            value => value
        ],
        [
            /overflow-y-([a-z]+)/g,
            'overflow-y',
            value => value
        ],
        [
            /opacity-([0-9.]+)/g,
            'opacity',
            value => value
        ],
        [
            /z-index-([0-9]+)/g,
            'z-index',
            value => value
        ],
        [
            /cursor-([a-z-]+)/g,
            'cursor',
            value => value
        ],
        [
            /pointer-events-([a-z-]+)/g,
            'pointer-events',
            value => value
        ],
        [
            /box-shadow-([^;]+)/g,
            'box-shadow',
            value => value
        ],
        [
            /object-fit-([a-z-]+)/g,
            'object-fit',
            value => value
        ],
        [
            /object-position-([a-z0-9% ]+)/g,
            'object-position',
            value => value
        ],
        [
            /transition-([^;]+)/g,
            'transition',
            value => value
        ],
        [
            /transform-([^;]+)/g,
            'transform',
            value => value
        ],
        [
            /animation-([^;]+)/g,
            'animation',
            value => value
        ],
        [
            /size-([0-9]+)(px|em|rem)?/g,
            'font-size',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /weight-([a-z0-9]+)/g,
            'font-weight',
            value => value
        ],
        [
            /mawidth-([0-9]+)(px|em|rem|%)?/g,
            'max-width',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /miheight-([0-9]+)(px|em|rem|%)?/g,
            'min-height',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /border-top-([0-9]+)(px|em|rem)?-([a-z]+)-([#a-zA-Z0-9]+)/g,
            'border-top',
            (width, unit, style, color) => '' + width + (unit || 'px') + ' ' + style + ' ' + color
        ],
        [
            /border-right-([0-9]+)(px|em|rem)?-([a-z]+)-([#a-zA-Z0-9]+)/g,
            'border-right',
            (width, unit, style, color) => '' + width + (unit || 'px') + ' ' + style + ' ' + color
        ],
        [
            /border-bottom-([0-9]+)(px|em|rem)?-([a-z]+)-([#a-zA-Z0-9]+)/g,
            'border-bottom',
            (width, unit, style, color) => '' + width + (unit || 'px') + ' ' + style + ' ' + color
        ],
        [
            /border-left-([0-9]+)(px|em|rem)?-([a-z]+)-([#a-zA-Z0-9]+)/g,
            'border-left',
            (width, unit, style, color) => '' + width + (unit || 'px') + ' ' + style + ' ' + color
        ],
        [
            /border-top-left-radius-([0-9]+)(px|em|rem)?/g,
            'border-top-left-radius',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /border-top-right-radius-([0-9]+)(px|em|rem)?/g,
            'border-top-right-radius',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /border-bottom-left-radius-([0-9]+)(px|em|rem)?/g,
            'border-bottom-left-radius',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /border-bottom-right-radius-([0-9]+)(px|em|rem)?/g,
            'border-bottom-right-radius',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /outline-([0-9]+)(px|em|rem)?-([a-z]+)-([#a-zA-Z0-9]+)/g,
            'outline',
            (width, unit, style, color) => '' + width + (unit || 'px') + ' ' + style + ' ' + color
        ],
        [
            /text-shadow-([a-zA-Z0-9# ,.-]+)/g,
            'text-shadow',
            value => value
        ],
        [
            /filter-([^;]+)/g,
            'filter',
            value => value
        ],
        [
            /clip-path-([^;]+)/g,
            'clip-path',
            value => value
        ],
        [
            /visibility-([a-z]+)/g,
            'visibility',
            value => value
        ],
        [
            /user-select-([a-z]+)/g,
            'user-select',
            value => value
        ],
        [
            /white-space-([a-z]+)/g,
            'white-space',
            value => value
        ],
        [
            /list-style-([a-z]+)/g,
            'list-style',
            value => value
        ],
        [
            /float-([a-z]+)/g,
            'float',
            value => value
        ],
        [
            /clear-([a-z]+)/g,
            'clear',
            value => value
        ],
        [
            /vertical-align-([a-z]+)/g,
            'vertical-align',
            value => value
        ],
        [
            /direction-([a-z]+)/g,
            'direction',
            value => value
        ],
        [
            /resize-([a-z]+)/g,
            'resize',
            value => value
        ],
        [
            /scroll-behavior-([a-z]+)/g,
            'scroll-behavior',
            value => value
        ],
        [
            /scroll-snap-type-([a-z]+)/g,
            'scroll-snap-type',
            value => value
        ],
        [
            /will-change-([a-z-]+)/g,
            'will-change',
            value => value
        ],
        [
            /aspect-ratio-([0-9]+)\/([0-9]+)/g,
            'aspect-ratio',
            (num1, num2) => num1 + '/' + num2
        ],
        [
            /columns-([0-9]+)/g,
            'columns',
            value => value
        ],
        [
            /column-gap-([0-9]+)(px|em|rem|%)?/g,
            'column-gap',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /order-([0-9]+)/g,
            'order',
            value => value
        ],
        [
            /grid-template-columns-([^;]+)/g,
            'grid-template-columns',
            value => value
        ],
        [
            /grid-template-rows-([^;]+)/g,
            'grid-template-rows',
            value => value
        ],
        [
            /grid-gap-([0-9]+)(px|em|rem|%)?/g,
            'grid-gap',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /transition-delay-([0-9.]+)(s|ms)?/g,
            'transition-delay',
            (value, unit) => value + (unit || 's')
        ],
        [
            /transition-duration-([0-9.]+)(s|ms)?/g,
            'transition-duration',
            (value, unit) => value + (unit || 's')
        ],
        [
            /transition-timing-function-([a-z-]+)/g,
            'transition-timing-function',
            value => value
        ],
        [
            /animation-delay-([0-9.]+)(s|ms)?/g,
            'animation-delay',
            (value, unit) => value + (unit || 's')
        ],
        [
            /animation-duration-([0-9.]+)(s|ms)?/g,
            'animation-duration',
            (value, unit) => value + (unit || 's')
        ],
        [
            /animation-timing-function-([a-z-]+)/g,
            'animation-timing-function',
            value => value
        ],
        [
            /perspective-([0-9]+)(px|em|rem|%)?/g,
            'perspective',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /backface-visibility-([a-z]+)/g,
            'backface-visibility',
            value => value
        ],
        [
            /outline-offset-([0-9]+)(px|em|rem)?/g,
            'outline-offset',
            (value, unit) => value + (unit || 'px')
        ],
        [
            /tab-size-([0-9]+)/g,
            'tab-size',
            value => value
        ],
        [
            /font-variant-([a-z-]+)/g,
            'font-variant',
            value => value
        ],
        [
            /font-stretch-([a-z-]+)/g,
            'font-stretch',
            value => value
        ],
        [
            /isolation-([a-z]+)/g,
            'isolation',
            value => value
        ],
        [
            /mix-blend-mode-([a-z-]+)/g,
            'mix-blend-mode',
            value => value
        ],
        [
            /pointer-events-([a-z-]+)/g,
            'pointer-events',
            value => value
        ],
        [
            /blur-([0-9]+)(px|em|rem)?/g,
            'filter',
            (value, unit) => 'blur(' + value + (unit || 'px') + ')'
        ],
        [
            /drop-shadow-([^;]+)/g,
            'filter',
            value => 'drop-shadow(' + value + ')'
        ],
        [
            /grayscale-([0-9.]+)/g,
            'filter',
            value => 'grayscale(' + value + ')'
        ],
        [
            /sepia-([0-9.]+)/g,
            'filter',
            value => 'sepia(' + value + ')'
        ],
        [
            /invert-([0-9.]+)/g,
            'filter',
            value => 'invert(' + value + ')'
        ],
        [
            /saturate-([0-9.]+)/g,
            'filter',
            value => 'saturate(' + value + ')'
        ],
        [
            /hue-rotate-([0-9.]+)deg/g,
            'filter',
            value => 'hue-rotate(' + value + 'deg)'
        ],
        [
            /brightness-([0-9.]+)/g,
            'filter',
            value => 'brightness(' + value + ')'
        ],
        [
            /contrast-([0-9.]+)/g,
            'filter',
            value => 'contrast(' + value + ')'
        ],
        [
            /keyframes-([a-zA-Z0-9_-]+)\s*=\s*([^@]+)/g,
            '@keyframes',
            (animationName, keyframeRules) => animationName + ' { ' + keyframeRules.trim() + ' }'
        ],
        [
            /keyframes-([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g,
            '@keyframes',
            (animationName, keyframeRules) => animationName + ' { ' + keyframeRules.trim() + ' }'
        ]
    ];
    for (const [regex, propertyName, valueFormatter] of cssTransformations) {
        cssContent = cssContent.replace(regex, function (...args) {
            if (typeof propertyName === 'string' && propertyName.startsWith('@keyframes')) {
                return '@keyframes ' + valueFormatter(...args.slice(1, -2));
            }
            if (propertyName === 'filter') {
                const formattedValue = valueFormatter(...args.slice(1, -2));
                return 'filter: ' + formattedValue + ';';
            }
            return propertyName + ': ' + valueFormatter(...args.slice(1, -2)) + ';';
        });
    }
    return cssContent;
}
function getNsxFiles() {
    return fs.readdirSync(NSX_DIR).filter(file => file.endsWith('.nsx')).map(file => path.join(NSX_DIR, file));
}
async function compileAll() {
    fs.existsSync(OUTPUT_DIR) && fs.rmSync(OUTPUT_DIR, {
        'recursive': true,
        'force': true
    });
    await fs.promises.mkdir(OUTPUT_DIR, { 'recursive': true });
    const nsxFiles = getNsxFiles();
    let compilationSuccessful = true;
    for (const nsxFilePath of nsxFiles) {
        try {
            await fs.promises.access(nsxFilePath, fs.constants.F_OK);
        } catch {
            log('error', path.basename(nsxFilePath) + ' not found.');
            compilationSuccessful = false;
            continue;
        }
        try {
            const fileContent = await fs.promises.readFile(nsxFilePath, 'utf8'),
                lexedTokens = lex(fileContent),
                parsedOutput = parse(lexedTokens),
                shouldTransformCss = fileContent.split('\n').some(line => line.includes('#C2'));
            if (shouldTransformCss) {
                parsedOutput.css = transformCSS(parsedOutput.css);
            }
            const {
                html: compiledHtml,
                css: compiledCss,
                js: compiledJs
            } = parsedOutput;
            let outputFilePath;
            if (path.basename(nsxFilePath) === 'main.nsx') {
                outputFilePath = path.join(OUTPUT_DIR, 'index.html');
            } else {
                const fileNameWithoutExt = path.basename(nsxFilePath, '.nsx');
                outputFilePath = path.join(OUTPUT_DIR, fileNameWithoutExt + '.html');
            }
            const fullHtmlContent = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + compiledCss + '</style></head><body>' + compiledHtml + '<script>' + compiledJs + '</script></body></html>';
            let existingFileContent = '';
            try {
                existingFileContent = await fs.promises.readFile(outputFilePath, 'utf8');
            } catch {
            }
            if (existingFileContent !== fullHtmlContent) {
                await fs.promises.writeFile(outputFilePath, fullHtmlContent);
            }
        } catch (error) {
            let errorContext = '';
            try {
                const fileLines = await fs.promises.readFile(nsxFilePath, 'utf8'),
                    errorLine = error.line || error instanceof NSXError && error.line || null;
                if (errorLine) {
                    const linesArray = fileLines.split('\n'),
                        startLine = Math.max(0, errorLine - 2),
                        endLine = Math.min(linesArray.length, errorLine + 1);
                    errorContext = '\n' + linesArray.slice(startLine, endLine).map((lineContent, index) => {
                        const currentLineNumber = startLine + index + 1;
                        return (currentLineNumber === errorLine ? '>> ' : '   ') + currentLineNumber + ': ' + lineContent;
                    }).join('\n');
                }
            } catch {
            }
            log('error', 'Compilation failed for ' + path.basename(nsxFilePath) + ' in file: ' + nsxFilePath + ': ' + error.message + errorContext);
            if (error.stack) {
                console.error(error.stack);
            }
            compilationSuccessful = false;
        }
    }
    return compilationSuccessful;
}
const showHelp = () => log('info', '\nNSX Commands:\n  r  - Recompile all .nsx files in ../\n  c  - Clear console\n  q  - Quit the program\n  h  - Show this help menu\n  l  - List output files and attempt to open the output directory (' + OUTPUT_DIR + ')\n  v  - Show NSX version\n');
function listOutputFiles() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        return log('error', 'Output directory does not exist: ' + OUTPUT_DIR);
    }
    try {
        const outputDirectoryItems = fs.readdirSync(OUTPUT_DIR, { 'withFileTypes': true });
        outputDirectoryItems.length ? (log('info', 'Output files:'), outputDirectoryItems.forEach(item => {
            if (item.isDirectory()) {
                const subDirectoryFiles = fs.readdirSync(path.join(OUTPUT_DIR, item.name));
                subDirectoryFiles.forEach(subFile => console.log('- ' + item.name + '/' + subFile));
            } else {
                console.log('- ' + item.name);
            }
        })) : log('info', 'No files found in output directory: ' + OUTPUT_DIR);
        const openCommands = {
                'darwin': 'open "' + OUTPUT_DIR + '"',
                'win32': 'start "" "' + OUTPUT_DIR + '"',
                'linux': 'xdg-open "' + OUTPUT_DIR + '"'
            }, platformCommand = openCommands[process.platform];
        if (!platformCommand) {
            return log('error', 'Unsupported platform for opening directory automatically.');
        }
        log('info', 'Attempting to open directory: ' + OUTPUT_DIR + '...');
        exec(platformCommand, (error, stdout, stderr) => {
            if (error) {
                return log('error', 'Failed to open directory: ' + error.message), log('error', 'stderr: ' + stderr);
            }
            if (stderr) {
                log('info', 'Open command stderr: ' + stderr);
            }
            log('info', 'Directory should be open.');
        });
    } catch (error) {
        log('error', 'Error listing or opening output directory: ' + error.message);
    }
}
const rl = readline.createInterface({
    'input': process.stdin,
    'output': process.stdout,
    'prompt': '> '
});
console.clear();
log('success', 'NSX Started.');
log('info', 'Press \'h\' for help.');
const promptCompiler = () => rl.prompt();
async function handleCompile(isManualRecompile = false) {
    if (!await compileAll()) {
        log('error', isManualRecompile ? 'Manual recompilation failed.' : 'Compilation failed.');
    }
    promptCompiler();
}
handleCompile();
let debounceTimer = null, watchedFiles = new Set();
function watchFileIfNeeded(filePath) {
    if (!watchedFiles.has(filePath)) {
        try {
            fs.watch(filePath, { 'persistent': true }, (eventType) => {
                eventType === 'change' && (clearTimeout(debounceTimer), debounceTimer = setTimeout(() => {
                    handleCompile();
                }, 200));
            });
            watchedFiles.add(filePath);
        } catch {
        }
    }
}
const watchFiles = () => {
    fs.watch(NSX_DIR, { 'persistent': true }, (eventType, filename) => {
        filename && filename.endsWith('.nsx') && (getNsxFiles().forEach(watchFileIfNeeded), clearTimeout(debounceTimer), debounceTimer = setTimeout(() => {
            handleCompile();
        }, 200));
    });
    getNsxFiles().forEach(watchFileIfNeeded);
    setInterval(() => {
        getNsxFiles().forEach(watchFileIfNeeded);
    }, 1000);
};
watchFiles();
const commands = {
    'q': () => {
        rl.close();
        process.exit(0);
    },
    'exit': () => {
        rl.close();
        process.exit(0);
    },
    'h': showHelp,
    'help': showHelp,
    'r': () => {
        log('info', 'Manual recompilation requested...');
        handleCompile(true);
    },
    'recompile': () => {
        log('info', 'Manual recompilation requested...');
        handleCompile(true);
    },
    'c': () => {
        console.clear();
        log('success', 'NSX Running.');
        log('info', 'Watching all .nsx files in ' + NSX_DIR + ' for changes.');
        log('info', 'Press \'h\' for help.');
        promptCompiler();
    },
    'clear': () => {
        console.clear();
        log('success', 'NSX Running.');
        log('info', 'Watching all .nsx files in ' + NSX_DIR + ' for changes.');
        log('info', 'Press \'h\' for help.');
        promptCompiler();
    },
    'l': () => {
        listOutputFiles();
        promptCompiler();
    },
    'list': () => {
        listOutputFiles();
        promptCompiler();
    },
    'v': () => {
        log('info', 'NSX version: ' + VERSION);
        promptCompiler();
    },
    'version': () => {
        log('info', 'NSX version: ' + VERSION);
        promptCompiler();
    }
};
rl.on('line', input => {
    const command = input.trim().toLowerCase();
    if (commands[command]) {
        commands[command]();
    } else {
        log('info', 'Unknown command: "' + input.trim() + '". Press \'h\' for help.');
        promptCompiler();
    }
}).on('close', () => {
    process.exit(0);
});