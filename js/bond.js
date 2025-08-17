export function mount(component, props, callback) {
    document.addEventListener('alpine:init', () => {
        window.Alpine.component(component, props, callback)
    })
}
