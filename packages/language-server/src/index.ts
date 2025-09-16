import {
    createConnection,
    createServer,
    createTypeScriptProject,
    loadTsdkByPath,
} from '@volar/language-server/node';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import { createBondLanguagePlugin } from './languagePlugin';
import path from 'path';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
    const tsdk = loadTsdkByPath(params.initializationOptions.typescript.tsdk, params.locale);

    return server.initialize(
        params,
        createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
            languagePlugins: [createBondLanguagePlugin(tsdk.typescript)],
            setup({ project }) {
                const { languageServiceHost } = project.typescript!;

                const getScriptFileNames =
                    languageServiceHost.getScriptFileNames.bind(languageServiceHost);

                languageServiceHost.getScriptFileNames = () => {
                    return [
                        ...getScriptFileNames(),
                        path.resolve('./vendor/ganyicz/bond/dist/types.d.ts'),
                    ];
                };
            },
        })),
        [...createTypeScriptServices(tsdk.typescript)],
    );
});

connection.onInitialized(() => {
    server.initialized();
    server.fileWatcher.watchFiles(['**/*.ts', '**/*.js']);
});

connection.onShutdown(server.shutdown);
