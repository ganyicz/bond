import type { Magics } from '@bond/types/alpine'

type Merge<T extends object[], Acc extends object = {}> =
  T extends [infer First extends object, ...infer Rest extends object[]]
    ? Merge<Rest, Acc & First>
    : Acc;

declare function __CTX_merge<T extends object[]>(...contexts: T): Merge<T>

declare function mount<TProps extends object, TReturn extends object>(callback: (props: TProps) => ThisType<TReturn & Magics<TReturn>> & TReturn): TReturn & { props: TProps } & Magics<TReturn>

const __BLADE__ = undefined as any

const __CTX = (
    mount((props: {
        step: number
    }) => ({
        value: (undefined as unknown) as number,
        increment() { this.value += props.step },
        decrement() { this.value -= props.step },
        calculate(base: number, step: number) { return base + step },
        init() {
            
        }
    }))
)

const __CTX2 = __CTX_merge(__CTX, (
    {items: []}
))

const __EXP = [
	__CTX.value,
	__CTX.increment,
	__CTX.value = __CTX.calculate(__CTX.value, __CTX.props.step),
	({ red: __CTX.value > 500 }),
	__CTX.decrement,
    __CTX2.value + __BLADE__
]

for (const item of __CTX2.items) {
    const __CTX3 = __CTX_merge(__CTX2, {item})
    const __EXP2 = [
        __CTX3.item
    ]
}
