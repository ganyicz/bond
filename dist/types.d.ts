// Taken from https://www.npmjs.com/package/@types/alpinejs

export interface Magics<T> {
    /**
     * Provides access to the element's current Alpine scope
     * This is a flattened Proxy object over the datastack
     * Use to avoid errors from accessing undefined properties
     */
    $data: T
    /**
     * Dispatches a CustomEvent on the current DOM node.
     * Event automatically bubbles up the DOM tree.
     *
     * @param event the event name
     * @param detail an event-dependent value associated with the event
     */
    $dispatch: (event: string, detail?: any) => void;
    /**
     * The current HTMLElement that triggered this expression.
     */
    $el: HTMLInputElement;
    /**
     * Generate a unique ID within the current `x-id` scope.
     * Name is required to allow reuse in related contexts.
     *
     * @param name the name of the id
     * @param key suffix on the end of the generated ID, usually helpful for the purpose of identifying id in a loop
     */
    $id: (name: string, key?: number | string | null) => string;
    /**
     * Triggers callback at the beginning of the next event loop.
     * Use to evaluate AFTER Alpine has made reactive DOM updates.
     *
     * @param callback a callback that will be fired on next tick
     */
    $nextTick: (callback?: () => void) => Promise<void>;
    /**
     * Record of DOM elements marked with `x-ref` inside the component.
     */
    $refs: Record<string, HTMLElement>;
    /**
     * The root element of the current component context.
     * Roots are typically defined by `x-data` directive.
     */
    $root: HTMLElement,
    /**
     * Record of global reactive Alpine stores.
     */
    // $store: Stores;
    /**
     * Evaluate the given callback when the property is changed.
     * Deeply watches for changes on object and array types.
     * Property can be a dot notated nested property.
     *
     * @param property the component property
     * @param callback a callback that will fire when a given property is changed
     */
    $watch: <K extends keyof T | string, V extends K extends keyof T ? T[K] : any>(
        property: K,
        callback: (newValue: V, oldValue: V) => void,
    ) => void;
}
