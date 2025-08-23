import * as html from 'vscode-html-languageservice';

export interface ExtractedSourceCode {
    content: string;
    start: number;
    end: number;
    length: number;
}

interface ExtractedAttribute {
    name: string,
    depth: number,
    code: ExtractedSourceCode,
    nodeRange: [number, number]
}

const htmlLs = html.getLanguageService();

export function extractScriptSetupContent(code: string): ExtractedSourceCode | null {
    const scriptSetupRegex = /<script\s+setup\b[^>]*>\n*([\s\S]*?)\n*<\/script>/;
    const match = code.match(scriptSetupRegex);
    if (!match) return null;
    
    const content = match[1];
    const matchStart = match.index;
    const contentStart = code.indexOf(content, matchStart);
    const contentEnd = contentStart + content.length
    
    return {
        content: content,
        start: contentStart,
        end: contentEnd,
        length: contentEnd - contentStart,
    };
}

export function extractMountFunction(code: string): ExtractedSourceCode | undefined {
    const scriptSetup = extractScriptSetupContent(code);
    if (!scriptSetup) return undefined;
    
    // Find the mount function call with proper bracket matching
    const mountStartRegex = /(^[^\S\r\n]*mount\s*\()/m;
    const startMatch = scriptSetup.content.match(mountStartRegex);
    if (!startMatch) return undefined;
    
    const mountStartIndex = scriptSetup.content.indexOf(startMatch[0]);
    const contentAfterMount = scriptSetup.content.slice(mountStartIndex);
    
    // Find the matching closing parenthesis
    let parenCount = 0;
    let index = 0;
    let foundStart = false;
    
    for (const char of contentAfterMount) {
        if (char === '(') {
            parenCount++;
            foundStart = true;
        } else if (char === ')') {
            parenCount--;
            if (foundStart && parenCount === 0) {
                break;
            }
        }
        index++;
    }
    
    if (parenCount !== 0) return undefined;
    
    const mountContent = contentAfterMount.slice(0, index + 1);
    const absoluteStart = scriptSetup.start + mountStartIndex;
    const absoluteEnd = absoluteStart + mountContent.length;
    
    return {
        content: mountContent,
        start: absoluteStart,
        end: absoluteEnd,
        length: mountContent.length
    };
}

export function extractPreMount(code: string): ExtractedSourceCode | undefined {
    const scriptSetup = extractScriptSetupContent(code);
    if (!scriptSetup) return undefined;
    
    // Find the mount function call
    const mountRegex = /(^[^\S\r\n]*mount\s*\()/m;
    const mountMatch = scriptSetup.content.match(mountRegex);
    if (!mountMatch) return undefined;
    
    // Get everything before the mount function call
    const mountStart = scriptSetup.content.indexOf(mountMatch[0]);
    const preMountContent = scriptSetup.content.slice(0, mountStart).trimEnd();
    
    if (!preMountContent) return undefined;
    
    const absoluteStart = scriptSetup.start;
    const absoluteEnd = absoluteStart + preMountContent.length;
    
    return {
        content: preMountContent,
        start: absoluteStart,
        end: absoluteEnd,
        length: preMountContent.length
    };
}

export function extractAttributes(code: string): ExtractedAttribute[] {
    const document = htmlLs.parseHTMLDocument(html.TextDocument.create('', 'html', 0, code));
    const roots = document.roots
    const attributes: ExtractedAttribute[] = []
    
    function walkNode(node: html.Node, depth: number = 1) {
        const startTag = code.substring(node.start, node.startTagEnd)
        const scanner = htmlLs.createScanner(startTag)

        let attributeName;

        while (scanner.scan() !== html.TokenType.EOS) {
            const tokenType = scanner.getTokenType()

            if (tokenType === html.TokenType.AttributeName) {
                attributeName = scanner.getTokenText()

                if (!attributeName.startsWith('x-')) continue
            }

            if (attributeName && tokenType === html.TokenType.AttributeValue) {
                const text = scanner.getTokenText()
                if (!text) continue

                const trimmed = text.replace(/^(['"])([\s\S]*)\1$/, '$2');
                if (trimmed.length == text.length) continue

                const start = node.start + scanner.getTokenOffset() + 1
                const end = start + trimmed.length

                attributes.push({
                    name: attributeName,
                    depth,
                    code: {
                        content: trimmed,
                        length: trimmed.length,
                        start,
                        end,
                    },
                    nodeRange: [node.start, node.end],
                })
            }
        }

        for (const child of node.children) {
            walkNode(child, depth + 1)
        }
    }

    for (const root of roots) { 
        walkNode(root)
    }

    return attributes
}

export function extractAttributeExpressions(code: string): ExtractedSourceCode[] {
    let cleanedCode = code;
    
    cleanedCode = cleanedCode.replace(/{{--[\s\S]*?--}}/g, '');
    cleanedCode = cleanedCode.replace(/<!--[\s\S]*?-->/g, '');
    cleanedCode = cleanedCode.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanedCode = cleanedCode.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanedCode = cleanedCode.replace(/<\?php[\s\S]*?\?>/g, '');
    
    const expressions = extractExpressions(cleanedCode, code);
    
    expressions.sort((a, b) => a.start - b.start);
    
    return expressions;
}

export function extractJSXAttributeExpressions(code: string): ExtractedSourceCode[] {
    let cleanedCode = code;
    
    cleanedCode = cleanedCode.replace(/{{--[\s\S]*?--}}/g, '');
    cleanedCode = cleanedCode.replace(/{{[\s\S]*?}}/g, '');
    cleanedCode = cleanedCode.replace(/<!--[\s\S]*?-->/g, '');
    cleanedCode = cleanedCode.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanedCode = cleanedCode.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanedCode = cleanedCode.replace(/<\?php[\s\S]*?\?>/g, '');
    
    const expressions = extractJSXExpressions(cleanedCode, code);
    const expressionObjects = extractJSXExpressionObjects(cleanedCode, code);
    
    const allResults = [
        ...expressions,
        ...expressionObjects,
    ];
    allResults.sort((a, b) => a.start - b.start);
    
    return allResults;
}

function buildAttributeExpressionRegex(useObjectSyntax: boolean): RegExp {
    const tagPattern = '<[\\w\\-:.]+[^>]*\\s+[\\w\\-:.@%]*=\\s*';
    const contentWithBraces = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)';
    const endPattern = '[^>]*>';
    
    const expression = useObjectSyntax 
    ? `\\(\\{${contentWithBraces}\\}\\)` // ({content})
    : `\\{${contentWithBraces}\\}`;      // {content}
    
    return new RegExp(`${tagPattern}(${expression})${endPattern}`, 'g');
}

export function extractExpressions(cleanedCode: string, originalCode: string): ExtractedSourceCode[] {
    const results: ExtractedSourceCode[] = [];
    
    // Match x- attributes with both single and double quoted values, including multiline
    const regex = /<[\w\-:.]+[^>]*\s+(x-[\w\-:.@%]*)\s*=\s*(['"])([\s\S]*?)\2[^>]*>/g;
    
    let match;
    let searchOffset = 0;
    
    while ((match = regex.exec(cleanedCode)) !== null) {
        const fullMatch = match[0]; // entire tag match
        const quoteChar = match[2]; // ' or "
        const innerContent = match[3]; // content inside quotes
        
        // Find the position of this match in original code
        const originalStart = originalCode.indexOf(fullMatch, searchOffset);
        
        // Find the quoted value in the original code  
        const quotedValue = `${quoteChar}${match[3]}${quoteChar}`;
        const quotedStart = originalCode.indexOf(quotedValue, originalStart);
        const contentStart = quotedStart + 1; // +1 to skip opening quote
        const contentEnd = contentStart + innerContent.length;
        
        // For most content, trim it. But for the specific case where content contains
        // only whitespace-padded simple expressions, keep the spaces
        let finalContent = innerContent.trim();
        let actualStart = contentStart;
        let actualEnd = contentEnd;
        
        // Special case: if content is just spaces around a simple expression, 
        // keep the original with spaces
        if (innerContent !== innerContent.trim() && 
            innerContent.trim().length < 20 && 
            !innerContent.includes('\n')) {
            // This is likely a simple padded expression like " value++ "
            finalContent = innerContent;
        } else if (finalContent !== innerContent) {
            // Find the trimmed content position within the original content
            const trimStart = innerContent.indexOf(finalContent);
            actualStart = contentStart + trimStart;
            actualEnd = actualStart + finalContent.length;
        }
        
        results.push({
            content: finalContent,
            start: actualStart,
            end: actualEnd,
            length: finalContent.length
        });
        
        searchOffset = originalStart + fullMatch.length;
    }
    
    return results;
}

export function extractJSXExpressions(cleanedCode: string, originalCode: string): ExtractedSourceCode[] {
    const results: ExtractedSourceCode[] = [];
    const regex = buildAttributeExpressionRegex(false); // {expression} patterns
    
    let match;
    let searchOffset = 0;
    
    while ((match = regex.exec(cleanedCode)) !== null) {
        const fullMatch = match[1]; // {...}
        const innerContent = match[2]; // content
        
        const originalStart = originalCode.indexOf(fullMatch, searchOffset);
        const trimmedInner = innerContent.trim();
        const trimmedStart = originalCode.indexOf(trimmedInner, originalStart + 1);
        
        results.push({
            content: trimmedInner,
            start: trimmedStart,
            end: trimmedStart + trimmedInner.length,
            length: trimmedInner.length
        });
        
        searchOffset = originalStart + fullMatch.length;
    }
    
    return results;
}

export function extractJSXExpressionObjects(cleanedCode: string, originalCode: string): ExtractedSourceCode[] {
    const results: ExtractedSourceCode[] = [];
    const regex = buildAttributeExpressionRegex(true); // ({object}) patterns
    
    let match;
    let searchOffset = 0;
    
    while ((match = regex.exec(cleanedCode)) !== null) {
        const fullMatch = match[1]; // ({...})
        
        const originalStart = originalCode.indexOf(fullMatch, searchOffset);
        
        results.push({
            content: fullMatch,
            start: originalStart,
            end: originalStart + fullMatch.length,
            length: fullMatch.length
        });
        
        searchOffset = originalStart + fullMatch.length;
    }
    
    return results;
}
