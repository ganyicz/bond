import type ts from 'typescript';
import { allCodeFeatures, type Mapping } from './shared';

export interface InterpolatedExpression {
    content: string;
    mappings: Mapping[];
}

interface Identifier {
    start: number;
    end: number;
    text: string;
}

export function interpolateExpression(
    content: string,
    prefix: string,
    ts: typeof import('typescript'),
    scopeVars?: string[] | undefined,
): InterpolatedExpression {
    const bladePlaceholder = '__BLADE__';
    const normalizedPrefix = prefix.endsWith('.') ? prefix : prefix + '.';

    if (content.length == 0) {
        return {
            content: normalizedPrefix,
            mappings: [
                {
                    generated: normalizedPrefix.length,
                    source: 0,
                    length: 0,
                    features: allCodeFeatures,
                },
            ],
        };
    }

    let processedContent = content;

    const bladeExpressions = extractBladeExpressions(content);

    // Replace blade expressions with __BLADE__ placeholder
    let bladeReplacementOffset = 0;
    for (const expr of bladeExpressions) {
        const start = expr.start + bladeReplacementOffset;
        const end = expr.end + bladeReplacementOffset;

        processedContent =
            processedContent.slice(0, start) + bladePlaceholder + processedContent.slice(end);
        bladeReplacementOffset += bladePlaceholder.length - (end - start);
    }

    const isObjectExpression =
        processedContent.trim().startsWith('{') && processedContent.trim().endsWith('}');

    const sourceFile = ts.createSourceFile(
        'temp.ts',
        isObjectExpression ? `(${processedContent})` : processedContent,
        ts.ScriptTarget.Latest,
        true,
    );

    // Global identifiers that should not be prefixed
    const globals = new Set([
        'Array',
        'Boolean',
        'Date',
        'decodeURI',
        'decodeURIComponent',
        'encodeURI',
        'encodeURIComponent',
        'Error',
        'eval',
        'EvalError',
        'Function',
        'isFinite',
        'isNaN',
        'JSON',
        'Math',
        'Number',
        'Object',
        'parseInt',
        'parseFloat',
        'RangeError',
        'ReferenceError',
        'RegExp',
        'String',
        'SyntaxError',
        'TypeError',
        'URIError',
        'console',
        'Infinity',
        'NaN',
        'undefined',
        'Intl',
        'BigInt',
        'Map',
        'Set',
    ]);

    // Literals that should not be prefixed
    const literals = new Set(['true', 'false', 'null', 'this']);

    // Collect all identifiers (both to prefix and blade placeholders)
    const properties: Identifier[] = [];

    let tsOffset = isObjectExpression ? -1 : 0;
    let bladeExpressionsIndex = 0;

    function walkNode(node: ts.Node, functionScopes: Set<string>[] = []) {
        if (
            ts.isIdentifier(node) ||
            (ts.isStringLiteralLike(node) && node.text.indexOf(bladePlaceholder) !== undefined)
        ) {
            const replacementsCount = node.text.split(bladePlaceholder).length - 1;

            for (let i = 0; i < replacementsCount; i++) {
                tsOffset +=
                    bladeExpressions[bladeExpressionsIndex].text.length - bladePlaceholder.length;
                bladeExpressionsIndex++;
            }
        }
        if (ts.isIdentifier(node)) {
            const text = node.text;
            const isLocal =
                functionScopes.some((scope) => scope.has(text)) ||
                (scopeVars && scopeVars.indexOf(text) !== -1);

            // Check if this identifier is an object property key
            const parent = node.parent;

            const isObjectPropertyKey =
                parent &&
                ((ts.isPropertyAssignment(parent) && parent.name === node) ||
                    (ts.isShorthandPropertyAssignment(parent) && parent.name === node));

            if (
                text !== bladePlaceholder &&
                !globals.has(text) &&
                !literals.has(text) &&
                !isLocal &&
                !isObjectPropertyKey
            ) {
                properties.push({
                    start: node.getStart(sourceFile) + tsOffset,
                    end: node.getEnd() + tsOffset,
                    text,
                });
            }
        } else if (ts.isPropertyAccessExpression(node)) {
            // Only walk the left side of property access (foo.bar -> only walk 'foo')
            walkNode(node.expression, functionScopes);
        } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            // Create new scope for function parameters
            const newScope = new Set<string>();
            for (const param of node.parameters) {
                if (ts.isIdentifier(param.name)) {
                    newScope.add(param.name.text);
                }
            }

            const newScopes = [...functionScopes, newScope];
            if (node.body) {
                walkNode(node.body, newScopes);
            }
        } else if (ts.isVariableDeclaration(node)) {
            // Handle variable declarations in block scope
            if (ts.isIdentifier(node.name)) {
                const currentScope = functionScopes[functionScopes.length - 1];
                if (currentScope) {
                    currentScope.add(node.name.text);
                }
            }
            if (node.initializer) {
                walkNode(node.initializer, functionScopes);
            }
        } else if (ts.isCallExpression(node)) {
            // Handle function calls - prefix the function name and arguments
            walkNode(node.expression, functionScopes);
            for (const arg of node.arguments) {
                walkNode(arg, functionScopes);
            }
        } else {
            // Walk all children
            ts.forEachChild(node, (child) => walkNode(child, functionScopes));
        }
    }

    walkNode(sourceFile);

    // Build result and mappings using unified approach
    const pointers: (Identifier & { type: string })[] = [
        ...properties.map((property) => ({ ...property, type: 'property' })),
        ...bladeExpressions.map((expression) => ({ ...expression, type: 'blade' })),
    ].sort((a, b) => a.start - b.start);

    if (pointers.length == 0) {
        return {
            content: content,
            mappings: [
                {
                    source: 0,
                    generated: 0,
                    length: content.length,
                },
            ],
        };
    }

    let sourcePos = 0;
    let generatedPos = 0;
    let generatedContent = '';

    const mappings: Mapping[] = [];

    let lastMapping: Mapping | undefined;

    const addMapping = (mapping: Mapping) => {
        if (
            lastMapping &&
            lastMapping.source + lastMapping.length === mapping.source &&
            lastMapping.generated + lastMapping.length === mapping.generated
        ) {
            lastMapping.length += mapping.length;
        } else {
            mappings.push(mapping);

            lastMapping = mapping;
        }
    };

    for (let i = 0; i < pointers.length; i++) {
        const pointer = pointers[i];

        if (i == 0 && pointer.start == 0) {
            mappings.push({
                generated: 0,
                source: 0,
                length: 0,
                features: { verification: true },
            });
        }

        if (sourcePos < pointer.start) {
            const sourcePointerPrefix = content.slice(sourcePos, pointer.start);

            addMapping({
                source: sourcePos,
                generated: generatedPos,
                length: sourcePointerPrefix.length,
            });

            generatedContent += sourcePointerPrefix;
            generatedPos += sourcePointerPrefix.length;
        }

        if (pointer.type == 'property') {
            generatedContent += normalizedPrefix;
            generatedPos += normalizedPrefix.length;

            addMapping({
                source: pointer.start,
                generated: generatedPos,
                length: pointer.text.length,
            });

            generatedContent += pointer.text;
            generatedPos += pointer.text.length;
        }

        if (pointer.type == 'blade') {
            generatedContent += bladePlaceholder;
            generatedPos += bladePlaceholder.length;
        }

        sourcePos = pointer.end;
    }

    if (sourcePos < content.length) {
        const contentSuffix = content.slice(sourcePos, content.length);

        addMapping({
            source: sourcePos,
            generated: generatedPos,
            length: contentSuffix.length,
        });

        generatedContent += contentSuffix;
        generatedPos += contentSuffix.length;
    }

    if (lastMapping && lastMapping.source + lastMapping.length !== content.length) {
        mappings.push({
            source: sourcePos,
            generated: generatedPos,
            length: 0,
            features: { verification: true },
        });
    }

    return {
        content: generatedContent,
        mappings: mappings,
    };
}

export function interpolateForStatement(
    content: string,
    prefix: string,
    ts: typeof import('typescript'),
    scopeVars?: string[],
): InterpolatedExpression {
    const forPrefix = 'for (const ';
    const forSuffix = ') {}';

    const interpolated = interpolateExpression(
        forPrefix + content + forSuffix,
        prefix,
        ts,
        scopeVars,
    );

    const mappings = interpolated.mappings;

    for (let i = 0; i < mappings.length; i++) {
        const mapping = mappings[i];

        if (i == 0) {
            mapping.length -= forPrefix.length;
        } else if (i == mappings.length - 1) {
            mapping.generated -= forPrefix.length;
            mapping.source -= forPrefix.length;
            mapping.length -= forSuffix.length;
        } else {
            mapping.generated -= forPrefix.length;
            mapping.source -= forPrefix.length;
        }
    }

    return {
        content: interpolated.content.slice(forPrefix.length, -forSuffix.length),
        mappings,
    };
}

function extractBladeExpressions(content: string): Identifier[] {
    const bladeReplacements: Identifier[] = [];

    let match;

    // Find blade expressions {{ ... }}
    const exprRegex = /\{\{[\s\S]*?\}\}/g;
    while ((match = exprRegex.exec(content)) !== null) {
        bladeReplacements.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
        });
    }

    // Find blade directives @js(...) or @json(...)
    const directiveRegex = /@(js|json)\(([\s\S]*?)\)/g;
    while ((match = directiveRegex.exec(content)) !== null) {
        bladeReplacements.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
        });
    }

    // Sort by position (reverse order for replacement)
    bladeReplacements.sort((a, b) => a.start - b.start);

    return bladeReplacements;
}
