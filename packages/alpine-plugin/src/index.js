export default function Bond(Alpine) {
    Alpine.components = {}
    Alpine.expressions = {}

    Alpine.component = function(component, props, callback) {
        Alpine.components[component] = {props, callback}
    }

    Alpine.expressions = function(component, expressions) {
        Alpine.expressions[component] = expressions
    }

    Alpine.directive('slot', (el, { expression }, { evaluate }) => {
        const parent = Alpine.findClosest(el, element => element._x_bond)
        const scope = Alpine.closestRoot(parent.parentNode)

        if (scope) {
            el._x_dataStack = scope._x_dataStack
        }
    }).before('init')

    Alpine.directive('component', (el, { expression }, { evaluate }) => {
        const name = expression
        const context = el._x_dataStack[0]
        const component = Alpine.components[name]

        if (component.props) {
            initProps(Alpine, el, component.props, el._x_refreshXForScope ? el._x_dataStack[1] : {})
        }

        const data = component.callback
            ? component.callback.apply(context, [el._x_props])
            : {}

        Object.defineProperties(context, Object.getOwnPropertyDescriptors(data))

        context.props = el._x_props

        el._x_dataStack = el._x_dataStack.slice(0, 1)
        el._x_bond = true

        data['init'] && evaluate(data['init'])
    }).before('init')

    Alpine.directive('exp', (el, {value, modifiers, expression}) => {
        const component = expression.split(':')[0]
        const index = parseInt(modifiers[0])
        const exp = Alpine.expressions[component][index]
        const expValue = exp.name !== 'x-ref' ? `${exp.value}/*bond:${expression}*/` : exp.value

        Alpine.bind(el, {[exp.name]: expValue})

        Alpine.mutateDom(() => {
            el.setAttribute(exp.name, modifiers[1] == 'prop' ? expValue : exp.value)
            el.removeAttribute(`${Alpine.prefixed('exp')}.${modifiers.join('.')}`)
        })
    }).before('ignore')

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
}

function initProps(Alpine, el, props, ctx) {
    el._x_props = Alpine.reactive({})

    for (const prop of props) {
        const attribute = Alpine.prefixed(prop)

        if (! el.hasAttribute(attribute)) {
            el._x_props[prop] = null;

            continue;
        }

        const expression = el.getAttribute(attribute) || prop

        const evaluate = Alpine.evaluateLater(el.parentNode, expression);

        const getter = () => {
            let value;
            
            Alpine.dontAutoEvaluateFunctions(() => {
                evaluate(i => value = i, {scope: ctx})
            })

            return value
        }

        Alpine.effect(() => {
            const value = getter()
            
            el._x_props[prop] = value

            JSON.stringify(value)
        })
    }

    Alpine.setErrorHandler((error, el, expression = undefined) => {
        const match = expression?.match(/([\s\S]*?)\/\*(bond:[^*]+)\*\/\s*$/);
        const bondExpression = match ? getBondExpression(match[2]) : undefined

        if (bondExpression) {
            const debug = bondExpression.debug
            const underline = ' '.repeat(debug.start) + '^'.repeat(bondExpression.value.length)
            const excerpt = `${debug.node}\n${underline}`
            const location = `at ${debug.file}:${debug.line}`

            const tsFileMatch = error.stack.match(/(resources\/views.*\.ts.*)\n/)
            if (tsFileMatch) {
                const clone = structuredClone(error)
                clone.stack = error.stack.substring(0, tsFileMatch.index + tsFileMatch[1].length).replace('Proxy.', '')

                console.warn(
                    `Bond Expression Error:\n\n%c${excerpt}%c\n${location}\n\nCause:`,
                    'font-family: monospace; white-space: pre; font-variant-ligatures: none',
                    '',
                    clone
                )
            } else {
                const clone = structuredClone(error)
                clone.stack = ''

                console.warn(
                    `Bond Expression Error:\n\n%c${excerpt}%c\n${location}\n\nCause:`,
                    'font-family: monospace; white-space: pre; font-variant-ligatures: none',
                    '',
                    clone
                )   
            }
        } else {
            error = Object.assign( 
                error ?? { message: 'No error message given.' }, 
                { el, expression }
            )
            
            console.warn(`Alpine Expression Error: ${error.message}\n\n${ expression ? 'Expression: \"' + match[1] + '\"\n\n' : '' }`, el)
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
