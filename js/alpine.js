document.addEventListener('alpine:init', () => {
    window.Alpine.plugin(Alpine => {
        Alpine.components = {}

        Alpine.component = function(component, props, callback) {
            Alpine.components[component] = {props, callback}
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

            if (!component) {
                console.warn(`Bond component "${name}" wasn't registered. Did you include 'virtual:bond' import in your app.js?`)
                return
            }
        
            if (component.props) {
                initProps(el, component.props, el._x_refreshXForScope ? el._x_dataStack[1] : {})
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

        function initProps(el, props, ctx) {
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
        }
    })

    window.Alpine.plugin(Alpine => {
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
    })
})
