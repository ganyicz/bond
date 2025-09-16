import { interpolateExpression, interpolateForStatement } from './interpolation';
import {
    extractAttributes,
    ExtractedSourceCode,
    extractMountFunction,
    extractPreMount,
} from '@bond/language-core';
import type { Mapping } from './shared';

export interface GeneratedCode {
    text: string;
    mappings: Mapping[];
}

export function generateImports(extracted: ExtractedSourceCode | undefined): GeneratedCode {
    let generated = '';

    if (extracted) {
        generated = `${extracted.content}\n\n`;
    }

    generated += "import type { Magics } from '@bond/types'\n\n";

    return {
        text: generated,
        mappings: extracted
            ? [
                  {
                      source: extracted.start,
                      generated: 0,
                      length: extracted.length,
                  },
              ]
            : [],
    };
}

export function generateDeclarations(): GeneratedCode {
    let generated = '';

    generated += `type Merge<T extends object[], Acc extends object = {}> =
  T extends [infer First extends object, ...infer Rest extends object[]]
    ? Merge<Rest, Acc & First>
    : Acc;\n`;
    generated += 'declare function __CTX_merge<T extends object[]>(...contexts: T): Merge<T>\n';
    generated +=
        'declare function mount<TProps extends object, TReturn extends object>(callback: (props: TProps) => ThisType<TReturn & Magics<TReturn>> & TReturn): TReturn & { props: TProps } & Magics<TReturn>\n\n';
    generated += 'const __BLADE__ = undefined as any';
    generated += '\n\n';

    return { text: generated, mappings: [] };
}

export function generateContext(
    name: string,
    extracted: ExtractedSourceCode,
    indented: boolean = false,
    merge: string | undefined = undefined,
): GeneratedCode {
    let prefix = `const ${name} = `;
    let suffix = ')\n\n';

    if (merge) {
        prefix += `__CTX_merge(${merge}, (\n`;
        suffix = `)${suffix}`;
    } else {
        prefix += '(\n';
    }

    if (indented) {
        prefix += '\t';
    }

    return {
        text: `${prefix}${extracted.content}\n${suffix}`,
        mappings: [
            {
                source: extracted.start,
                generated: prefix.length,
                length: extracted.length,
            },
        ],
    };
}

export function* generate(
    content: string,
    ts: typeof import('typescript'),
): Generator<GeneratedCode> {
    yield {
        text: '/// <reference types="vite/client" />\n\n',
        mappings: [],
    };
    yield generateImports(extractPreMount(content));
    yield generateDeclarations();

    interface Context {
        name: string;
        depth: number;
        range: [number, number];
    }

    let contexts: Context[] = [];

    let contextCounter = 1;

    const addContext = (depth: number, range: [number, number]): Context => {
        const context = {
            name: `__CTX${contextCounter}`,
            depth,
            range,
        };

        contexts.push(context);

        contextCounter++;

        return context;
    };

    interface Scope {
        depth: number;
        type: 'for' | 'data' | 'exp';
        context: Context;
        variables?: string[];
    }

    let scopes: Scope[] = [];
    let currentScope: Scope | undefined;
    let expressionBlockCounter = 1;

    const addScope = (scope: Scope) => {
        scopes.push(scope);
        currentScope = scope;
    };

    const popScope = () => {
        scopes.pop();
        currentScope = scopes[scopes.length - 1];
    };

    const closeExpressions = function* (scope: Scope): Generator<GeneratedCode> {
        if (scope.type === 'exp') {
            yield { text: ']\n\n', mappings: [] };

            popScope();
        }
    };

    const closeScope = function* (scope: Scope): Generator<GeneratedCode> {
        yield* closeExpressions(scope);

        if (scope.type === 'for') {
            yield { text: '}\n\n', mappings: [] };

            popScope();
        }

        if (scope.type === 'data') {
            popScope();
        }
    };

    const resetScope = function* (
        depth: number,
        range: [number, number],
    ): Generator<GeneratedCode> {
        while (
            currentScope &&
            (currentScope.context.depth > depth ||
                currentScope.context.range[0] > range[0] ||
                currentScope.context.range[1] < range[1])
        ) {
            yield* closeScope(currentScope);
        }
    };

    const getScopeVars = function (): string[] {
        return scopes.filter((s) => s.type === 'for').flatMap((s) => s.variables || []);
    };

    const mount = extractMountFunction(content);

    if (mount) {
        const context = addContext(0, [0, content.length]);

        yield generateContext(context.name, mount);

        addScope({
            depth: 0,
            type: 'data',
            context,
        });
    }

    const attributes = extractAttributes(content);

    for (let i = 0; i < attributes.length; i++) {
        const attribute = attributes[i];

        yield* resetScope(attribute.depth, attribute.nodeRange);

        if (attribute.name === 'x-data') {
            if (currentScope) closeExpressions(currentScope);

            const context = addContext(attribute.depth, attribute.nodeRange);

            yield generateContext(context.name, attribute.code, true, currentScope?.context.name);

            addScope({
                depth: attribute.depth,
                type: 'data',
                context,
            });
        } else if (attribute.name === 'x-for') {
            if (!currentScope) continue;

            yield* closeExpressions(currentScope);

            const currentContext = currentScope?.context;
            const scopeVars = getScopeVars();
            const interpolated = interpolateForStatement(
                attribute.code.content,
                currentContext.name,
                ts,
                scopeVars,
            );

            const prefix = 'for (const ';
            const suffix = ') {';

            yield {
                text: `${prefix}${interpolated.content}${suffix}\n\n`,
                mappings: interpolated.mappings.map((m) => ({
                    ...m,
                    source: attribute.code.start + m.source,
                    generated: prefix.length + m.generated,
                })),
            };

            // Parse the left side of the for expression to extract all variables (item, index, collection)
            const forRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
            const forIteratorRE = /,([^,}\]]*)(?:,([^,}\]]*))?$/;

            const match = attribute.code.content.match(forRE);
            if (!match) continue;

            let item = match[1].trim();
            const iteratorMatch = item.match(forIteratorRE);

            let loopVars = [];
            if (iteratorMatch) {
                const itemVar = item.replace(forIteratorRE, '').trim();
                const indexVar = iteratorMatch[1].trim();
                const collectionVar = iteratorMatch[2] ? iteratorMatch[2].trim() : undefined;

                const vars = [itemVar];
                if (indexVar) vars.push(indexVar);
                if (collectionVar) vars.push(collectionVar);
                loopVars = vars;
            } else {
                loopVars = [item];
            }

            addScope({
                depth: attribute.depth,
                type: 'for',
                context: currentContext,
                variables: loopVars,
            });

            const prevContext = currentContext;
            const newContext = addContext(currentContext.depth, currentContext.range);

            yield {
                text: `const ${newContext.name} = __CTX_merge(${prevContext.name}, {${loopVars.join(',')}})\n\n`,
                mappings: [],
            };

            addScope({
                depth: newContext.depth,
                type: 'data',
                context: newContext,
            });
        } else if (attribute.name.startsWith('x-')) {
            if (!currentScope) continue;

            const currentContext = currentScope.context;

            if (currentScope.type !== 'exp') {
                yield { text: `const __EXP${expressionBlockCounter} = [\n`, mappings: [] };

                expressionBlockCounter++;

                addScope({
                    depth: attribute.depth,
                    type: 'exp',
                    context: currentContext,
                });
            }

            const scopeVars = getScopeVars();

            if (attribute.name === 'x-ref') {
                const prefix = "\t'";
                yield {
                    text: `${prefix}${attribute.code.content}',\n`,
                    mappings: [
                        {
                            source: attribute.code.start,
                            generated: prefix.length,
                            length: attribute.code.length,
                        },
                    ],
                };
                continue;
            }

            const prefix = '\t';
            const interpolated = interpolateExpression(
                attribute.code.content,
                currentContext.name,
                ts,
                scopeVars,
            );

            yield {
                text: `${prefix}${interpolated.content},\n`,
                mappings: interpolated.mappings.map((m) => ({
                    ...m,
                    source: attribute.code.start + m.source,
                    generated: prefix.length + m.generated,
                })),
            };
        }
    }

    yield* resetScope(0, [0, content.length]);
}
