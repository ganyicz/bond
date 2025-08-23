import { expect, test } from "vitest"
import { interpolateExpression, interpolateForStatement } from "../src/utils/interpolation"
import ts from "typescript"

test('interpolates expressions', () => {
    expect(interpolateExpression('value++', '__CTX.', ts).content).toBe('__CTX.value++')
    expect(interpolateExpression('amount.value++', '__CTX', ts).content).toBe('__CTX.amount.value++')
    expect(interpolateExpression('value + {{ $this->value }}', '__CTX', ts).content).toBe('__CTX.value + __BLADE__')
    expect(interpolateExpression('{{ $this->value }} + value', '__CTX', ts).content).toBe('__BLADE__ + __CTX.value')
    expect(interpolateExpression("'{{ $this->value }}' + value", '__CTX', ts).content).toBe("'__BLADE__' + __CTX.value")
    expect(interpolateExpression('{{ $this->value }} + value + {{ $value }}', '__CTX', ts).content).toBe('__BLADE__ + __CTX.value + __BLADE__')
    expect(interpolateExpression('value + @js($this->value)', '__CTX', ts).content).toBe('__CTX.value + __BLADE__')
    expect(interpolateExpression('() => { value++ }', '__CTX', ts).content).toBe('() => { __CTX.value++ }')
    expect(interpolateExpression('calculate(amount, step)', '__CTX', ts).content).toBe('__CTX.calculate(__CTX.amount, __CTX.step)')
    expect(interpolateExpression('Math.max(value, 10)', '__CTX', ts).content).toBe('Math.max(__CTX.value, 10)')
    expect(interpolateExpression('true && value', '__CTX', ts).content).toBe('true && __CTX.value')
    expect(interpolateExpression('(x) => x + value', '__CTX', ts).content).toBe('(x) => x + __CTX.value')
    expect(interpolateExpression('({ red: value > 500 })', '__CTX', ts).content).toBe('({ red: __CTX.value > 500 })')
    expect(interpolateExpression('{ red: value > 500 }', '__CTX', ts).content).toBe('{ red: __CTX.value > 500 }')
    expect(interpolateExpression('for (const item in items) {}', '__CTX', ts).content).toBe('for (const item in __CTX.items) {}')
    
    const result = interpolateExpression('Math.max(value, {{ $this->max }})', '__CTX', ts)
    
    expect(result.content).toBe('Math.max(__CTX.value, __BLADE__)')
    
    // Offsets are used for mapping between source and generated code (| = start of mapping, > = end of mapping, |> = zero-length mapping))
    // Source: |Math.max(>|value, >|>{{ $this->max }}|)>
    // Generated: |Math.max(>__CTX.|value, >__BLADE__|)> (_CTX. and placeholder are skipped)
    expect(result.mappings).toEqual([
        {
            source: 0,
            generated: 0,
            length: 9,
        },
        {
            source: 9,
            generated: 15,
            length: 7,
        },
        {
            source: 32,
            generated: 31,
            length: 1,
        },
    ])
})

test('adds zero length mappings at the beginning and end', () => {
    const result = interpolateExpression('value + {{ $value }}', '__CTX', ts)

    expect(result.content).toBe('__CTX.value + __BLADE__')

    expect(result.mappings).toEqual([
        {
            source: 0,
            generated: 0,
            length: 0,
            features: { verification: true }
        },
        {
            source: 0,
            generated: 6,
            length: 8,
        },
        {
            source: 20,
            generated: 23,
            length: 0,
            features: { verification: true }
        }
    ])
})

test('doesnt add zero length mappings at start if covered by other mappings', () => {
    const result = interpolateExpression('parseFloat(value)', '__CTX', ts)

    expect(result.content).toBe('parseFloat(__CTX.value)')

    expect(result.mappings).toEqual([
        {
            source: 0,
            generated: 0,
            length: 11,
        },
        {
            source: 11,
            generated: 17,
            length: 6,
        }
    ])
})

test('interpolates for statement', () => {
    const result = interpolateForStatement('item in items', '__CTX', ts)

    expect(result.content).toBe('item in __CTX.items')

    expect(result.mappings).toEqual([
        {
            source: 0,
            generated: 0,
            length: 8,
        },
        {
            source: 8,
            generated: 14,
            length: 5,
        }
    ])
})
