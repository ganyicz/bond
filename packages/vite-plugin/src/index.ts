import {
    extractAttributes,
    extractMountFunction,
    extractScriptSetupContent,
    hasScriptSetup,
} from '@bond/language-core';
import * as fs from 'node:fs';
import MagicString from 'magic-string';
import { resolve, join } from 'node:path';
import { Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import ts from 'typescript';

interface PluginConfig {
    defaultViewsPath?: string;
    viewsPrefix?: string;
}

export default function bond(options: PluginConfig = {}): Plugin {
    const { defaultViewsPath = 'resources/views/components', viewsPrefix = 'resources/views' } =
        options;

    let server: ViteDevServer;
    let config: ResolvedConfig;
    const virtualModuleId = 'virtual:bond';
    const resolvedVirtualModuleId = `\0${virtualModuleId}`;

    return {
        name: 'vite-bond-plugin',

        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },

        configureServer(devServer) {
            server = devServer;

            const _handleFileChange = function (_path: string) {
                // TODO: Implement file change handling
            };

            server.watcher.on('add', (_path) => {
                // TODO: Implement file add handling
            });

            server.watcher.on('unlink', (path) => {
                const root = process.cwd();

                if (path.startsWith(resolve(root, viewsPrefix))) {
                    const importPath = path
                        .substring(root.length + 1)
                        .replace('.blade.php', '.ts?bond');
                    const scriptModule = server.moduleGraph.getModuleById(importPath);

                    if (scriptModule) {
                        server.reloadModule(scriptModule);
                    }
                }
            });

            server.watcher.on('change', (path) => {
                const root = process.cwd();

                if (path.startsWith(resolve(root, viewsPrefix))) {
                    const importPath = path
                        .substring(root.length + 1)
                        .replace('.blade.php', '.ts?bond');
                    const scriptModule = server.moduleGraph.getModuleById(importPath);

                    if (scriptModule) {
                        server.reloadModule(scriptModule);
                    }
                }
            });
        },

        resolveId(id) {
            if (id.startsWith(virtualModuleId)) {
                return `\0${id}`;
            }

            if (id.endsWith('.ts?bond')) {
                return id;
            }
        },

        load(id) {
            if (id.startsWith(resolvedVirtualModuleId)) {
                const path = id.slice(resolvedVirtualModuleId.length + 1) || defaultViewsPath;
                const filePaths = findBladeFilePaths(path);

                let imports: string[] = [];

                for (const filePath of filePaths) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    if (!hasScriptSetup(content)) continue;

                    const importPath = filePath.replace('.blade.php', '.ts?bond');

                    imports.push(`import '${importPath}'`);
                }

                return imports.join('\n');
            }

            if (id.endsWith('.ts?bond')) {
                const filePath = id.replace('\0', '').substring(0, id.lastIndexOf('/'));
                const fileName = id
                    .substring(id.lastIndexOf('/') + 1)
                    .replace('.ts?bond', '.blade.php');
                const fullPath = join(filePath, fileName);

                const code = fs.readFileSync(fullPath, 'utf-8');
                const script = extractScriptSetupContent(code);
                const mount = extractMountFunction(code);
                if (!script || !mount) return null;

                const ms = new MagicString(code);

                ms.remove(0, script.start);
                ms.remove(script.end, code.length);
                ms.prepend(`import { mount, expressions } from '@bond/alpine-plugin'\n`);

                const componentName = fullPath
                    .replace(`${viewsPrefix}/`, '')
                    .replace('.blade.php', '')
                    .replaceAll('/', '.');
                const props = getProps(mount.content);
                ms.replace(/mount\(/, `mount('${componentName}', ${JSON.stringify(props)}, `);

                const expressions = extractAttributes(code).map((attr) =>
                    JSON.stringify({
                        name: attr.name,
                        value: attr.code.content,
                        debug: {
                            node: stripIndentation(code.substring(...attr.startTagRange)),
                            start: attr.code.start - attr.startTagRange[0],
                            file: fullPath,
                            line: attr.line,
                        },
                    }),
                );

                ms.append(`\n\nexpressions('${componentName}', [\n${expressions.join(',\n')}\n])`);

                return {
                    code: ms.toString(),
                    map: config.mode !== 'production' ? ms.generateMap({ source: fileName }) : null,
                };
            }
        },
    };
}

function findBladeFilePaths(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files = fs.readdirSync(dir, { withFileTypes: true });

    let results: string[] = [];

    for (const file of files) {
        const filePath = join(dir, file.name);

        if (file.isDirectory()) {
            results = results.concat(findBladeFilePaths(filePath));
        } else {
            if (file.name.endsWith('.blade.php')) {
                results.push(filePath);
            }
        }
    }

    return results;
}

function getProps(code: string): string[] {
    const sourceFile = ts.createSourceFile('temp.ts', code, ts.ScriptTarget.ESNext, true);
    const expression = sourceFile.statements[0].getChildAt(0);
    if (!isMountCall(expression)) return [];

    const callback = expression.arguments[0];
    if (!ts.isArrowFunction(callback)) return [];

    const firstParameterType = callback.parameters[0]?.type;

    if (firstParameterType && ts.isTypeLiteralNode(firstParameterType)) {
        const props: string[] = [];

        for (const member of firstParameterType.members) {
            if (ts.isPropertySignature(member) && member.name) {
                if (ts.isIdentifier(member.name)) {
                    props.push(member.name.text);
                }
            }
        }

        return props;
    }

    return [];
}

function isMountCall(node: ts.Node): node is ts.CallExpression {
    return (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'mount'
    );
}

function stripIndentation(code: string): string {
    const trailingLines = code.substring(code.indexOf('\n'));
    const whitespace = trailingLines.match(/^[ \t]*(?=\S)/gm);
    const minIndent = whitespace?.reduce((r, a) => Math.min(r, a.length), Infinity);
    if (!minIndent) return code;

    const regex = new RegExp(`^[ \\t]{${minIndent}}`, 'gm');

    return code.replace(regex, '');
}
