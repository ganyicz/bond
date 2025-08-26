import { expect, test } from 'vitest'
import { 
    extractAttributes, 
    extractPreMount, 
    extractMountFunction, 
    extractScriptSetupContent,
} from '../src/parser'

test('extracts script setup block', () => {
    const extracted = extractScriptSetupContent(
`<script setup>
    mount(() => ({}))
</script>
`
    );
    
    expect(extracted).toEqual({
        content: '    mount(() => ({}))',
        start: 15,
        end: 36,
        length: 21
    })
})

test('extracts mount function', () => {
    const extracted = extractMountFunction(
`<script setup>
    import { Number } from 'types'
    
    mount((props: {
        step: number
    }) => ({
        values: [],
        init() {
            this.values.push({})
        }
    }))
</script>
    `)

    expect(extracted).toEqual({
        content:
`    mount((props: {
        step: number
    }) => ({
        values: [],
        init() {
            this.values.push({})
        }
    }))`,
        start: 55,
        length: 141,
        end: 196
    })
})

test('extracts code above mount', () => {
        const extracted = extractPreMount(
`<script setup>
    import { Number } from 'types'
    import { Value } from 'other-types'

    interace Props {
        step: Number
    }
    
    mount((props: {
        step: Number
    }) => ({
        value: 0,
    }))
</script>
    `)

    expect(extracted).toEqual({
        content:
`    import { Number } from 'types'
    import { Value } from 'other-types'

    interace Props {
        step: Number
    }`,
        start: 15,
        length: 123,
        end: 138
    })
})

test('extracts HTML attributes', () => {
    const attributes = extractAttributes(
`<div x-data="{disabled: false}">
    <div x-show="disabled" x-on:click="() => {
         console.log('test')
    }">
    </div>
</div>`
    )

    expect(attributes).toEqual([
        {
            depth: 1,
            name: 'x-data',
            code: {
                content: '{disabled: false}',
                start: 13,
                end: 30,
                length: 17,
            },
            line: 1,
            nodeRange: [0,134],
            startTagRange: [0,32],
        },
        {
            depth: 2,
            name: 'x-show',
            code: {
                content: 'disabled',
                start: 50,
                end: 58,
                length: 8,
            },
            line: 2,
            nodeRange: [37,127],
            startTagRange: [37,116],
        },
        {
            depth: 2,
            name: 'x-on:click',
            code: {
                content: 
`() => {
         console.log('test')
    }`,
                start: 72,
                end: 114,
                length: 42,
            },
            line: 2,
            nodeRange: [37,127],
            startTagRange: [37,116],
        }
    ])
})

test('extracts HTML attributes from inside template', () => {
    const attributes = extractAttributes(
`<template>
    <div x-on:click="value++"></div>
</template>`
    )

    expect(attributes).toEqual([
        {
            depth: 2,
            name: 'x-on:click',
            code: {
                content: 'value++',
                start: 32,
                end: 39,
                length: 7,
            },
            line: 2,
            nodeRange: [15,47],
            startTagRange: [15,41],
        },
    ])
})


test('extracts HTML attributes with blade', {skip: true}, () => {
    const attributes = extractAttributes(
`<div
    {{ $attributes->class([]) }}
    x-on:click="value++"
></div>`
    )

    expect(attributes).toEqual([
        {
            depth: 1,
            name: 'x-on:click',
            code: {
                content: 'value++',
                start: 43,
                end: 50,
                length: 7,
            },
            line: 3,
            nodeRange: [0,59],
            startTagRange: [0,52],
        },
    ])
})
