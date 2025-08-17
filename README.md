![Banner](https://raw.githubusercontent.com/ganyicz/bond/main/art/banner.png)

> ⚠️ **Early Preview:**  
> This package is currently under active development and not yet intended for production use. Feedback and contributions are welcome!

Bond brings modern component authoring to Laravel Blade using Alpine.js. It introduces a few features inspired by React and Vue, making it easier to write structured, maintainable components. Bond also ships with a VS Code extension that adds syntax highlighting, autocomplete, and error checking.

## Installation

Install Bond into your project using Composer:

```bash
composer require ganyicz/bond
```

Next, create a new JavaScript file in `resources/js` called `bond.js` (or `bond.ts`) with the following content:

```
import 'virtual:bond';
```

Bond will compile all scripts extracted from your Blade files into this file.

Next, update your vite.config.js to register Bond:

```diff
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
+ import bond from './vendor/ganyicz/bond/js/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
+               'resources/js/bond.js',
            ],
            refresh: true,
        }),
        tailwindcss(),
+       bond(),
    ],
    ...
});
```

Finally, publish Bond’s assets:

```bash
php artisan vendor:publish --tag=bond-assets
```

And register them in your layout:

```diff
<head>
+   <script src="{{ asset('vendor/alpine-bond-plugin.js') }}"></script>
+   @vite([..., 'resources/js/bond.js'])
</head>
```

These must be placed in the <head> tag, with the plugin script registered first.

## VS Code Extension

For the best development experience, install the [Bond VS Code extension](https://marketplace.visualstudio.com/items?itemName=ganyicz.bond-vscode-extension). It provides syntax highlighting, autocomplete, and error checking for both Bond components and Alpine.js attributes. The extension will be open-sourced in a future release.

## Features

### <script setup>

The `<script setup>` tag separates your JavaScript logic from your Blade template. Bond extracts and bundles this code into a single file using Vite. The component will be mounted on the element where you place `{{ $attributes }}`.

```html
<script setup>
    mount((props: {
        ...
    }) => ({
        ...
    }))
</script>

<div {{ $attributes }}>
    ...
</div>
```

> [!IMPORTANT]
> Components using <script setup> are isolated from the outside scope. To pass data in, use props or slots.

### Props

Props let you pass reactive data from outside into your component. Define them in the callback parameter of the mount function with a type annotation:

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

Once defined, pass props using the `x-` prefix:

```html
<x-number-input x-step="outer" />
```

Props can be static values:

```html
<x-number-input
    x-step="0.1"
    x-format="'9.99'"
    x-onincrement="() => console.log('incremented')"
/>
```

And also Livewire properties:

```html
<x-number-input x-step="$wire.precision">
```

### Slots

Bond components are isolated, which means Blade slots do not have access to the parent scope by default:

```html
<div x-data="{ message: 'You have exceeded your quota' }">
    <x-alert>
        <span x-text="message"></span> <!-- message is undefined -->
    </x-alert>
</div>
```

To make slot content behave as expected, wrap it with an element that has the x-slot directive. This resets the scope to the parent:

```html
<div {{ $attributes }}>
    <div x-slot>{{ $slot }}</div>
</div>
```

> [!IMPORTANT]
> Attributes applied to an element with x-slot also use the outside scope, not just its children.
 
### Else statement

Alpine does not support else statements out of the box. Bond adds a _partial_ support for it. The limitation is that the template with `x-else` directive must be inside the parent template.

```html
<template x-if="active">
    Your subscription is active
    <template x-else>
        Your subscription has expired
    </template>
</template>
```

A simpler custom syntax for control statements is planned:

```html
<!-- This is NOT yet supported -->

<if {active}>
    Your subscription is active
<else>
    Your subscription has expired
</if>
```

### Imports

Since Bond compiles <script setup> tags with Vite, you can use any import supported in a JavaScript file:

```html
<script setup>
    import { twMerge } from 'tailwind-merge'
    import { createTodo } from '@/todo'
    import type { TodoItem } from '@/types'
    import check from '@resources/img/icons/check.svg?raw'
</script>
```

### Icons

Dynamic icons in Alpine usually require rendering all icons and toggling with `x-show`.

With Bond, you can import SVGs and render them dynamically with `x-html`:

```html
<script setup>
    import check from '@resources/img/icons/check.svg?raw'
    import circle from '@resources/img/icons/circle.svg?raw'

    mount(() => ({
        icons: {check, circle}
    }))
</script>

<div {{ $attributes }}>
    <span x-html="todo.done ? icons.check : icons.circle"></span>
</div>
```

### TypeScript

Bond uses TypeScript to provide a terse syntax for props and also to power the IDE features.

By default, strict mode is disabled. This avoids unnecessary boilerplate and allows you to use types only where needed. Enabling strict mode is planned in future releases along with the option to opt out of TypeScript entirely.

> [!IMPORTANT]
> TypeScript syntax is only supported inside <script setup>. Alpine expressions are not bundled, so using TypeScript in them will cause runtime errors.

#### Adding types to properties

If a property is not initialized immediately, use the `as` keyword:

```html
<script setup>
    mount(() => ({
        value: null as number | null,
    }))
</script>
```

Here, `value` is explicitly typed as `number`, providing type safety and autocompletion in the IDE.

### Roadmap

> [!WARNING]
> The following features are planned but not yet implemented. Feedback and contributions are encouraged.

#### Attribute syntax

Bond will support a JSX-like syntax for attributes. This makes it easier to visually distinguish between HTML/Blade attributes and reactive bindings. This syntax will be optional.

```html
<!-- This is NOT yet supported -->

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

The example above would be compiled to:

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

#### Control statement tags

Alpine requires wrapping conditional or loop logic in `<template>` tags, which can be verbose. Bond will introduce a cleaner syntax that will also enable real `else` statements. 

The syntax below was designed to be visually distinct from Blade directives and its HTML-like structure will be easy to compile to Alpine.js code.

```html
<!-- This is NOT yet supported -->

<if {active}>
    Your subscription is active
<else>
    Your subscription has expired
</if>

<for {account in accounts}>
    ...
</for>
```

Compiled output:

```html
<template x-if="active">
    Your subscription is active
    <template x-else>
        Your subscription has expired
    </template>
</template>

<template x-for="account in accounts">
</template>
```

#### Interpolation

Bond will add support for inline template interpolation. This lets you write expressions directly in HTML with curly braces, similar to Vue or React:

```html
<!-- This is NOT yet supported -->

<div x-template>Hello, {name}</div>
```

At runtime, `{name}` will be replaced with the actual value.

#### Cross-file Intellisense (VS Code)

The Bond VS Code extension will provide autocomplete and type checking for props on the outside of the component, ensuring type safety across files.

#### Common error diagnostics (VS Code)

The Bond VS Code extension will include diagnostics for common errors in Alpine.js attributes, such as missing key in a for loop, one root element per template tag and more.

#### Blade improvements

While Bond primarily augments Alpine.js, several Blade-specific enhancements would be beneficial to improve modularity and organization.

**Multiple components per file**

```html
<!-- This is NOT yet supported -->
@export
<div>This is (x-summary)</div>
@export('title')
<h3>This is (x-summary.title)</h3>
@export('header')
<div>This is (x-summary.header)</div>
@endexport
```

**Imports and aliases**

```html
<!-- This is NOT yet supported -->
@import('app::checkout.summary', 'summary')

<x-summary>
    <x-summary.header>
        <x-summary.title>Summary</x-summary.title>
    </x-summary.header>
</x-summary>
```

```html
<!-- This is NOT yet supported -->
@import('app::checkout.summary')

<x-header>
    <x-title>Summary</x-title>
</x-header>
```
