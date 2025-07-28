# Bond for Blade and Alpine.js

This package lets you write modern React/Vue-like components inside Laravel Blade without having to buy-in to a full ecosystem. It uses Alpine.js under the hood and adds a few new features like props, script setup and JSX-like syntax for attributes that mimick the experience of authoring components in modern JavaScript frameworks.

It also comes with a VS Code extension that provides syntax highlighting, autocomplete and error checking. 

## Writing components

A basic component using Bond looks like this:

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

<div {{ $attributes }} modelable={value}>
    <x-button onclick={increment} icon="plus" />
    <input model={value}>
    <x-button onclick={increment} icon="minus" />
</div>
```

Let's break this down:

- The `<script setup>` tag is where you define your component logic. It only runs after Alpine.js has been initialized, so you don't need to wrap it in an alpine:init event listener. It also ensures that the script is only executed once, even if the component is used multiple times on a page.
    - The `mount` function takes another function as a parameter and it must return an object with the component's state and methods.
    - The `props` parameter is used to accept and define data that can be passed from the outside. The definition is done by adding a type annotation to the parameter.
- The `{{ $attributes }}` automatically bind the component's logic to that element.
- The `modelable` directive is used for two-way data binding, this is a [Alpine.js feature](https://alpinejs.dev/directives/modelable).
- You can omit the `x-` prefix on Alpine.js directives for a cleaner syntax (however you can still use it if you prefer). Event handlers like `x-on:click` or `x-on:change` can be written as `onclick` or `onchange` respectively.
