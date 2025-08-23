import { expect, test } from 'vitest'
import { 
    extractAttributes, 
    extractAttributeExpressions, 
    extractJSXAttributeExpressions, 
    extractPreMount, 
    extractMountFunction, 
    extractScriptSetupContent,
} from '../src/parser'
import * as ts from 'typescript';

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

test('extracts JSX attribute expressions', {skip: true}, () => {
    const extracted = extractJSXAttributeExpressions(
`<div onclick={value++}>
<div onclick={() => { value++ }}>
<div onclick={() => {
    value++
}}>
<div class=({
    'border-red-500': value > 0,
})>
<x-app::div onclick={ value++ }/>
<div onclick={ value++ }>`
        // The following should not be extracted
        +
`<div {{ $attribures }}>
{{-- <div onclick={value}> --}}
<!-- <div onclick={() => { value }}> -->
<div>{value}</div>
</div {value}>
<?php fn () => { value++ } ?>
<script>{value++}</script>
<style>{value++}</style>
` 
    );
    
    expect(extracted[0]).toEqual({
        content: `value++`,
        start: 14,
        end: 21,
        length: 7
    })
    
    expect(extracted[1]).toEqual({
        content: `() => { value++ }`,
        start: 38,
        end: 55,
        length: 17
    })
    
    expect(extracted[2]).toEqual({
        content: 
`() => {
    value++
}`,
        start: 72,
        end: 93,
        length: 21
    })
    
    expect(extracted[3]).toEqual({
        content: 
`({
    'border-red-500': value > 0,
})`,
        start: 107,
        end: 145,
        length: 38
    })
    
    expect(extracted[4]).toEqual({
        content: `value++`,
        start: 169,
        end: 176,
        length: 7
    })
    
    expect(extracted[5]).toEqual({
        content: `value++`,
        start: 196,
        end: 203,
        length: 7
    })
    
    expect(extracted.map(e => e.content)).toEqual([
        `value++`,
        `() => { value++ }`,
        `() => {\n    value++\n}`,
        `({\n    'border-red-500': value > 0,\n})`,
        `value++`,
        `value++`,
    ])
})

test('extracts attribute expressions', () => {
    const extracted = extractAttributeExpressions(
`<div x-init="value++">
<div x-on:click.prevent='() => { value++ }'>
<div x-on:click="() => {
    value++
}">
<div x-bind:class="{
    'border-red-500': value > 0,
}">
<x-app::div x-on:click=" value++ "/>`
        // The following should not be extracted
        +
`<div onclick="value">
{{-- <div onclick="value"> --}}
<!-- <div onclick="() => { value }"> -->
<div>"value"</div>
</div "value">
<?php echo "<div x-on:click='value'>" ?>
<script><div x-on:click="value"></script>
<style><div x-on:click="value"></style>
` 
    );
    
    expect(extracted[0]).toEqual({
        content: `value++`,
        start: 13,
        end: 20,
        length: 7
    })
    
    expect(extracted[1]).toEqual({
        content: `() => { value++ }`,
        start: 48,
        end: 65,
        length: 17
    })
    
    expect(extracted[2]).toEqual({
        content: 
`() => {
    value++
}`,
        start: 85,
        end: 106,
        length: 21
    })
    
    expect(extracted[3]).toEqual({
        content: 
`{
    'border-red-500': value > 0,
}`,
        start: 128,
        end: 164,
        length: 36
    })
    
    expect(extracted[4]).toEqual({
        content: ` value++ `,
        start: 191,
        end: 200,
        length: 9
    })
    
    expect(extracted.map(e => e.content)).toEqual([
        `value++`,
        `() => { value++ }`,
        `() => {\n    value++\n}`,
        `{\n    'border-red-500': value > 0,\n}`,
        ` value++ `,
    ])
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
            nodeRange: [0,134],
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
            nodeRange: [37,127],
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
            nodeRange: [37,127],
        }
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
            nodeRange: [0,59],
        },
    ])
})
