# Bond for Blade and Alpine.js

This package lets you write modern React/Vue-like components inside Laravel Blade. It uses Alpine.js under the hood and adds a few new features that mimick the experience of authoring components in modern JavaScript frameworks. It also comes with a VS Code extension that provides syntax highlighting, autocomplete and error checking. 

## Basic example

```html
<script setup>
    mount((props: {
        step: number
    }) => ({
        value: 0,
        increment() { this.value += props.step },
        decrement() { this.value -= props.step },
    }))
</script>

<div {{ $attributes }}>
    <x-button onclick={increment} icon="plus" />
    <input model={value}>
    <x-button onclick={decrement} icon="minus" />
</div>
```

<!--
Let's break this down:

- The `<script setup>` tag is where you define your component logic. It only runs after Alpine.js has been initialized, so you don't need to wrap it in an alpine:init event listener. It also ensures that the script is only executed once, even if the component is used multiple times on a page.
    - The `mount` function takes another function as a parameter and it must return an object with the component's state and methods.
    - The `props` parameter is used to accept and define data that can be passed from the outside. The definition is done by adding a type annotation to the parameter.
- The `{{ $attributes }}` automatically bind the component's logic to that element.
- The `modelable` directive is used for two-way data binding, this is a [Alpine.js feature](https://alpinejs.dev/directives/modelable).
- You can omit the `x-` prefix on Alpine.js directives for a cleaner syntax (however you can still use it if you prefer). Event handlers like `x-on:click` or `x-on:change` can be written as `onclick` or `onchange` respectively.
-->

## Features

### <script setup>

The `<script setup>` tag allows you to write your Blade components with a clear separation of logic and template. Similar to Vue, it is a syntactic sugar that provides a number of advantages:

- Automatically imports Bond functions like `mount`
- Defers the execution of the script until Alpine.js is initialized
- Ensures the script is only executed once, even if the component is used multiple times on a page
- Isolates the scope of the component, preventing leakage of variables defined outside the component
- Binds the state and methods to where the `{{ $attributes }}` are placed, so you don't need to use `x-data` to intiliaze the component

### JSX-like attribute syntax

With Bond, you can use a JSX-like syntax for attributes. This provides a visual separation for attributes containing JavaScript expressions and allows you to use Alpine.js directives with a cleaner syntax.

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

In addition to passing variables, you can also pass static values, like numbers, strings 

```html
<x-number-input
    step={0.1}
    format={'9.99'}
    onIncrement={() => console.log('incremented')}
/>
