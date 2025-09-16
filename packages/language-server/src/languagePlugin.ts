import { forEachEmbeddedCode, LanguagePlugin } from '@volar/language-core';
import type { TypeScriptExtraServiceScript } from '@volar/typescript';
import type ts from 'typescript';
import { URI } from 'vscode-uri';
import { BondVirtualCode } from './virtualCode';

export function createBondLanguagePlugin(ts: typeof import('typescript')): LanguagePlugin<URI> {
    return {
        getLanguageId(uri) {
            if (uri.path.endsWith('.blade.php')) {
                return 'blade';
            }
        },
        createVirtualCode(_uri, languageId, snapshot) {
            if (languageId === 'blade') {
                return new BondVirtualCode(snapshot, ts);
            }
        },
        typescript: {
            extraFileExtensions: [
                {
                    extension: 'blade',
                    isMixedContent: true,
                    scriptKind: 7 satisfies ts.ScriptKind.Deferred,
                },
            ],
            getServiceScript() {
                return undefined;
            },
            getExtraServiceScripts(fileName, root) {
                const scripts: TypeScriptExtraServiceScript[] = [];
                for (const code of forEachEmbeddedCode(root)) {
                    if (code.languageId === 'javascript') {
                        scripts.push({
                            fileName: fileName + '.' + code.id + '.js',
                            code,
                            extension: '.js',
                            scriptKind: 1 satisfies ts.ScriptKind.JS,
                        });
                    } else if (code.languageId === 'typescript') {
                        scripts.push({
                            fileName: fileName + '.' + code.id + '.ts',
                            code,
                            extension: '.ts',
                            scriptKind: 3 satisfies ts.ScriptKind.TS,
                        });
                    }
                }
                return scripts;
            },
            resolveLanguageServiceHost(host) {
                return {
                    ...host,
                    getCompilationSettings() {
                        return {
                            ...host.getCompilationSettings(),
                            noImplicitThis: true,
                            noImplicitAny: false,
                            paths: {
                                '@/*': ['./resources/js/*'],
                                '@resources/*': ['./resources/*'],
                                '@bond/*': ['./vendor/ganyicz/bond/dist/*'],
                            },
                            rootDir: './',
                        };
                    },
                };
            },
        },
    };
}
