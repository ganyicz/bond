import * as htmlparser2 from 'htmlparser2';

export interface ExtractedSourceCode {
    content: string;
    start: number;
    end: number;
    length: number;
}

interface ExtractedAttribute {
    name: string,
    depth: number,
    line: number,
    code: ExtractedSourceCode,
    nodeRange: [number, number]
}

export function hasScriptSetup(code: string): boolean {
    return /<script\s+setup\b[^>]*>/.test(code);
}

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
    const attributes: ExtractedAttribute[] = [];
    
    const dom = htmlparser2.parseDocument(code, {
        withStartIndices: true,
        withEndIndices: true,
    });

    let lines = [0];
    let currentLine = 0
    
    for (let i = 0; i < code.length; i++) {
        if (code[i] === '\n') {
            lines.push(i + 1);
        }
    }
    
    function walkNode(node: any, depth: number = 1) {
        if (node.type === 'tag' && node.attribs) {
            for (const [attrName] of Object.entries(node.attribs)) {
                if (!attrName.startsWith('x-')) continue;
                
                const nodeStart = node.startIndex ?? 0;
                const nodeEnd = (node.endIndex ?? code.length - 1) + 1; // Convert from inclusive to exclusive
                const tagSource = code.substring(nodeStart, nodeEnd);
                
                const escapedAttrName = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const attrPattern = new RegExp(`${escapedAttrName}\\s*=\\s*(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`);
                const match = attrPattern.exec(tagSource);
                
                if (match) {
                    const valueContent = match[2];
                    const attrStart = nodeStart + match.index + match[0].indexOf(valueContent);
                    const attrEnd = attrStart + valueContent.length;

                    for (let i = currentLine; i < lines.length; i++) {
                        if (lines[i] <= attrStart) {
                            currentLine++;
                        } else {
                            break;
                        }
                    }
                    
                    attributes.push({
                        name: attrName,
                        depth,
                        line: currentLine,
                        code: {
                            content: valueContent,
                            start: attrStart,
                            end: attrEnd,
                            length: valueContent.length,
                        },
                        nodeRange: [nodeStart, nodeEnd],
                    });
                }
            }
        }
        
        if (node.children) {
            for (const child of node.children) {
                walkNode(child, depth + 1);
            }
        }
    }
    
    // Walk through all root nodes
    if (dom.children) {
        for (const root of dom.children) {
            walkNode(root);
        }
    }
    
    return attributes;
}
