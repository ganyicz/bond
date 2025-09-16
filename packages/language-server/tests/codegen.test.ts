import ts from 'typescript';

import { generate } from '../src/utils/codegen';
import { expect, test } from 'vitest';

test('generates code from input', () => {
    const generated = [
        ...generate(
            `<div x-data="{disabled: false}">
    <div x-show="disabled"></div>
</div>`,
            ts,
        ),
    ];
});

test('generates for statement', () => {
    const generated = [
        ...generate(
            `<div x-data="{}">
    <div x-for="item in items">
        <div x-show="item.completed"></div>
    </div>
    <div>
        <div x-show="item.completed"></div>
    </div>
</div>`,
            ts,
        ),
    ];
});

test('handles scopes', () => {
    const generated = [
        ...generate(
            `<script setup>
    mount(() => ({
        items: [{
            completed: false,
        }]
    }))
</script>

<div x-data="{display: false}">
    <div x-data="{disabled: true}">
        <div x-for="item of items">
            
        </div>
    </div>
</div>
`,
            ts,
        ),
    ];

    debugger;
});
