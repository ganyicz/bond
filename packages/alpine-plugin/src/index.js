export default function Bond(Alpine) {
    Alpine.components = {}
    Alpine.expressions = {}

    Alpine.component = function(component, props, callback) {
        Alpine.components[component] = {props, callback}
    }

    Alpine.expressions = function(component, expressions) {
        Alpine.expressions[component] = expressions
    }

    Alpine.interceptInit(el => {
        const expAttributes = Array.from(el.attributes)
            .filter(i => i.name.startsWith(Alpine.prefixed('exp')))

        for (const attr of expAttributes) {
            const expression = attr.value
            const modifiers = attr.name.split('.').slice(1)

            const component = expression.split(':')[0]
            const index = parseInt(modifiers[0])
            const prop = modifiers[1] == 'prop'
            const exp = Alpine.expressions[component][index]
            const expAttr = prop ? 'x-prop:' + exp.name.substr(2) : exp.name
            const expValue = exp.name !== 'x-ref' ? `${exp.value}/*bond:${expression}*/` : exp.value

            Alpine.mutateDom(() => {
                el.setAttribute(expAttr, expValue)
                el.removeAttribute(`${Alpine.prefixed('exp')}.${modifiers.join('.')}`)
            })
        }
    })

    Alpine.directive('prop', (el, { value, expression }, { effect }) => {
        const data = el._x_dataStack[0]

        data.props ??= {}

        const target = el.parentNode
        const extra = el._x_refreshXForScope ? el._x_dataStack[1] : {}

        const evaluate = Alpine.evaluateLater(target, expression)

        effect(() => evaluate(i => data.props[value] = i, { scope: extra }))
    }).before('bind')

    Alpine.directive('slot', (el, { expression }, { evaluate }) => {
        const parent = Alpine.findClosest(el, element => element._x_bond)
        const scope = Alpine.closestRoot(parent.parentNode)

        if (scope) {
            el._x_dataStack = scope._x_dataStack
        }
    }).before('bind')

    Alpine.directive('component', (el, { expression }, { evaluate }) => {
        const name = expression
        const component = Alpine.components[name]
        
        const ctx = el._x_dataStack[0]
        const data = component.callback?.apply(ctx, [ctx.props]) || {}

        Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(data))

        el._x_dataStack = [ctx]
        el._x_bond = true

        data['init'] && evaluate(data['init'])
    }).before('bind')

    // [x-else] support
    Alpine.directive('if', (el, { expression }, { effect, cleanup }) => {
        if (el.tagName.toLowerCase() !== 'template') warn('x-if can only be used on a <template> tag', el)

        let evaluate = Alpine.evaluateLater(el, expression)

        let clone = (template) => {
            let clone = template.content.cloneNode(true).firstElementChild

            Alpine.addScopeToNode(clone, {}, el)

            Alpine.mutateDom(() => {
                el.after(clone)

                // These nodes will be "inited" as morph walks the tree...
                Alpine.skipDuringClone(() => Alpine.initTree(clone))()
            })

            el._x_currentIfEl = clone

            el._x_undoIf = () => {
                Alpine.mutateDom(() => {
                    Alpine.destroyTree(clone)

                    clone.remove()
                })

                delete el._x_currentIfEl
            }
        }

        let undo = () => {
            if (el._x_undoIf) {
                el._x_undoIf()
                delete el._x_undoIf
            }
        }

        let show = () => {
            if (el._x_showsElse) {
                el._x_showsElse = false

                undo()
            }

            if (el._x_currentIfEl) return el._x_currentIfEl

            clone(el)
        }

        let showElse = () => {
            if (el._x_currentIfEl) return el._x_currentIfEl

            const elseEl = el.content.querySelector('template[x-else]')

            elseEl && clone(elseEl)

            el._x_showsElse = true
        }

        let hide = () => {
            undo()

            showElse()
        }

        effect(() => evaluate(value => {
            value ? show() : hide()
        }))

        cleanup(() => {
            el._x_undoIf && el._x_undoIf()
        })
    }).before('if')

    Alpine.setErrorHandler((error, el, expression = undefined) => {
        const expressionMatch = expression?.match(/([\s\S]*?)\/\*(bond:[^*]+)\*\/\s*$/);
        const bondExpression = expressionMatch ? getBondExpression(expressionMatch[2]) : undefined

        if (bondExpression) {
            const debug = bondExpression.debug
            const underline = ' '.repeat(debug.start) + '^'.repeat(bondExpression.value.length)
            const excerpt = `${debug.node}\n${underline}`
            const location = `at ${debug.file}:${debug.line}`

            const tsFileMatch = error.stack.match(/(resources\/views.*\.ts.*)\n/)
            if (tsFileMatch) {
                const errorClone = structuredClone(error)
                errorClone.stack = error.stack.substring(0, tsFileMatch.index + tsFileMatch[1].length).replace('Proxy.', '')

                console.warn(
                    `Bond Expression Error:\n\n%c${excerpt}%c\n${location}\n\nCause:`,
                    'font-family: monospace; white-space: pre; font-variant-ligatures: none',
                    '',
                    errorClone
                )
            } else {
                console.warn(
                    `Bond Expression Error:\n\n%c${excerpt}%c\n${location}\n\nCause:`,
                    'font-family: monospace; white-space: pre; font-variant-ligatures: none',
                    '',
                    error
                )   
            }
        } else {
            error = Object.assign( 
                error ?? { message: 'No error message given.' }, 
                { el, expression } )

            console.warn(`Alpine Expression Error: ${error.message}\n\n${ expression ? 'Expression: \"' + expression + '\"\n\n' : '' }`, el)
        }
        
        setTimeout( () => { throw error }, 0 )
    })
}

function getBondExpression(expression) {
    if (! expression.startsWith('bond:')) return undefined
    if (! Alpine.expressions) return undefined

    const [file, index] = expression.split(':').splice(1, 2)
    
    return Alpine.expressions[file]?.[index]
}

export function mount(component, props, callback) {
    document.addEventListener('alpine:init', () => {
        window.Alpine.component(component, props, callback)
    })
}

export function expressions(component, expressions) {
    document.addEventListener('alpine:init', () => {
        window.Alpine.expressions(component, expressions)
    })
}
