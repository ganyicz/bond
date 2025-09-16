import { CodeMapping, VirtualCode } from '@volar/language-core';
import type ts from 'typescript';
import { signal, computed } from 'alien-signals';
import { allCodeFeatures } from './utils/shared';
import { generate } from './utils/codegen';

export class BondVirtualCode implements VirtualCode {
    id = 'main';
    languageId = 'blade';
    mappings = [];

    private _snapshot = signal<ts.IScriptSnapshot>(undefined!);

    private _embeddedCodes = computed((): VirtualCode[] => {
        const snapshot = this._snapshot();
        const content = snapshot.getText(0, snapshot.getLength());
        const generated = generate(content, this.ts);

        let code = '';
        let mappings: CodeMapping[] = [];

        for (const part of generated) {
            mappings.push(
                ...part.mappings.map((m) => ({
                    sourceOffsets: [m.source],
                    generatedOffsets: [code.length + m.generated],
                    lengths: [m.length],
                    data: m.features || allCodeFeatures,
                })),
            );

            code += part.text;
        }

        return [
            {
                id: 'script',
                languageId: 'typescript',
                mappings,
                snapshot: {
                    getText: (start, end) => code.substring(start, end),
                    getLength: () => code.length,
                    getChangeRange: () => {},
                },
            },
        ];
    });

    get snapshot() {
        return this._snapshot();
    }
    get embeddedCodes() {
        return this._embeddedCodes();
    }

    constructor(
        public initSnapshot: ts.IScriptSnapshot,
        public ts: typeof import('typescript'),
    ) {
        this._snapshot(initSnapshot);
    }

    update(newSnapshot: ts.IScriptSnapshot) {
        this._snapshot(newSnapshot);
    }
}
