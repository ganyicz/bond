import * as parse5 from 'parse5';

export interface ExtractedSourceCode {
    content: string;
    start: number;
    end: number;
    length: number;
}

export interface ExtractedAttribute {
    name: string;
    depth: number;
    line: number;
    code: ExtractedSourceCode;
    nodeRange: [number, number];
    startTagRange: [number, number];
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
    const contentEnd = contentStart + content.length;

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
        length: mountContent.length,
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
        length: preMountContent.length,
    };
}

export function extractAttributes(code: string): ExtractedAttribute[] {
    const attributes: ExtractedAttribute[] = [];

    // Parse with location info - use parseFragment for HTML snippets
    const html = parse5.parseFragment(code, {
        sourceCodeLocationInfo: true,
    });

    function walkNode(node: any, depth: number = 1) {
        if (node.nodeName && node.nodeName !== '#text' && node.attrs) {
            const nodeLoc = node.sourceCodeLocation;
            const tagLoc = nodeLoc.startTag;

            for (const attr of node.attrs) {
                if (!attr.name.startsWith('x-')) continue;
                if (!attr.value) continue;

                const attrLoc = nodeLoc.attrs[attr.name];

                let valueStartOffset = attrLoc.startOffset + attr.name.length;
                valueStartOffset += code
                    .substring(valueStartOffset, attrLoc.endOffset)
                    .indexOf(attr.value);
                if (valueStartOffset == -1) continue;

                attributes.push({
                    name: attr.name,
                    depth,
                    line: attrLoc.startLine,
                    code: {
                        content: attr.value,
                        start: valueStartOffset,
                        end: valueStartOffset + attr.value.length,
                        length: attr.value.length,
                    },
                    nodeRange: [nodeLoc.startOffset, nodeLoc.endOffset],
                    startTagRange: [tagLoc.startOffset, tagLoc.endOffset],
                });
            }
        }

        const children = node.content ? node.content.childNodes : node.childNodes;

        if (children) {
            for (const child of children) {
                walkNode(child, depth + 1);
            }
        }
    }

    walkNode(html, 0);

    return attributes;
}
