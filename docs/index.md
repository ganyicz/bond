# Bond for Blade and Alpine.js

This package lets you write modern React/Vue-like components inside Laravel Blade. It uses Alpine.js under the hood and adds a few new features that mimick the experience of authoring components in modern JavaScript frameworks. It also comes with a VS Code extension that provides syntax highlighting, autocomplete and error checking. [See it in action](https://x.com/ganyicz/status/1949237986521981302).

## Basic example

```html
<script setup>
    mount((props: {
        step: ?number
    }) => ({
        value: 0,
        increment() { this.value += props.step || 1 },
        decrement() { this.value -= props.step || 1 },
    }))
</script>

<div {{ $attributes }} modelable={value}>
    <x-button onclick={increment} icon="plus" />
    <input model={value}>
    <x-button onclick={decrement} icon="minus" />
</div>
```

## When should you use this?

Whenever you need a frontend-heavy component that should be reusable or abstracted into its own file, Bond is a great choice. You can use it on its own, but it works especially well in combination with Livewire, making it easy to build optimistic UIs that update instantly, without making a server round-trip.

```html
<x-number-input model={$wire.amount} step={$wire.precision} />

<select model={$wire.precision}>
    <option value="0.1">0.1</option>
    <option value="0.01">0.01</option>
    <option value="0.001">0.001</option>
</select>

<button onclick={$wire.commit()}>Save</button>
```

In this example, when the user selects a precision from the dropdown, the `step` property inside the number input is automatically updated, without making a server request. The server update is deferred until you explicitly call `$wire.commit()` or any other Livewire method.

## Features

### <script setup>

The `<script setup>` tag allows you to write your Blade components with a clear separation of logic and template. Similar to Vue, it is a syntactic sugar that provides a number of advantages:

- Automatically imports Bond functions like `mount`
- Defers the execution of the script until Alpine.js is initialized
- Ensures the script is only executed once, even if the component is used multiple times on a page
- Isolates the scope of the component, preventing leakage of variables defined outside the component
- Binds the state and methods to where the `{{ $attributes }}` are placed, so you don't need to use `x-data` to intiliaze the component

### JSX-like attribute syntax

With Bond, you can use a JSX-like syntax for attributes. This provides a visual separation for attributes containing JavaScript expressions and allows you to use Alpine.js directives with a cleaner syntax. This is optional and you can still use the standard Alpine.js syntax if you prefer.

```html
<input
    model={value}
    onchange={() => console.log($el.value)}
    disabled={value < 0}
    class=({
        'bg-gray-200': value < 0,
        'bg-blue-500': value >= 0
    })
>
```

This is the equivalent of writing:

```html
<input
    x-model="value"
    x-on:change="() => console.log($el.value)"
    x-bind:disabled="value < 0"
    x-bind:class="{
        'bg-gray-200': value < 0,
        'bg-blue-500': value >= 0
    }"
>
```

### Props

Props are used to pass reactive data into the component from the outside. They are defined in the `mount` function's parameter using a type annotation. This allows you to specify the expected structure of the props and provides type checking and autocompletion in your IDE.

You can pass any Alpine.js variable from the outside scope, including Livewire properties. This is particulary useful when using the `$wire` object, allowing you to write components with optimistic UI updates without triggering a server request, defering the request until the user submits the form for example.

```html
<script setup>
    mount((props: {
        step: number,
        min?: number,
        max?: number
    }) => ({
        ...
    }))
</script>
```

Once defined, you can pass props to it using the JSX-like syntax:

```html
<x-number-input step={$wire.precision} />
```

Or using the standard Alpine.js syntax, by prefixing the prop name with `x-`:

```html
<x-number-input x-step="$wire.precision" />
```

In addition to passing variables, you can also pass static values, like numbers, strings or functions: 

```html
<x-number-input
    step={0.1}
    format={'9.99'}
    onincrement={() => console.log('incremented')}
/>
```

### TypeScript

Bond takes advantage of TypeScript to provide a terse syntax for defining props and also to power the IDE features like autocomplete and error checking. By default Bond doesn't use the `strict` mode, allowing you to only use types where you need them, avoiding the notorious boilerplate usually associated with TypeScript. You can opt out of using TypeScript entirely by using the `props` method inside the `<script setup>` tag, however you will loose some of the IDE features.

```html
<script setup>
    props(['step', 'min', 'max'])

    mount(props => ({
        value: 0,
        increment() { this.value += props.step },
        decrement() { this.value -= props.step },
    }))
</script>
```
