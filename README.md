![Banner](https://raw.githubusercontent.com/ganyicz/bond/main/art/banner.png)

> ⚠️ **Alpha release:**  
> This package is currently under active development and not yet intended for production use; It is best to try on a fresh Laravel project. Feedback and contributions are welcome! [Learn more about the goals and the current development here](https://github.com/ganyicz/bond/issues/3)

Bond brings modern component authoring to Laravel Blade and Alpine.js. It introduces a few features inspired by React and Vue, making it easier to write structured, maintainable components. Bond also ships with a VS Code extension that adds syntax highlighting, autocomplete, and error checking.

## Installation

Install Bond into your project using Composer:

```bash
composer require ganyicz/bond
```

Next, add the following lines to your `resources/js/app.js` file. Bond will compile all scripts extracted from your Blade files here.

```js
import '../../vendor/ganyicz/bond/js/alpine';
import 'virtual:bond';
```

Finally, update your `vite.config.js` to register Bond:

```diff
import {
    defineConfig
} from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from "@tailwindcss/vite";
+ import bond from './vendor/ganyicz/bond/dist/vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
+       bond(),
    ],
    server: {
        cors: true,
    },
});
```

If you're using Alpine.js CDN, make sure it's registered _after_ your `app.js` file.

```diff
<head>
    <!-- This needs to be first -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])

    <!-- Alpine CDN goes here -->
    <script src="//unpkg.com/alpinejs" defer></script> 
</head>
```

If you're using Livewire, you don't need to worry about this, as Livewire automatically loads Alpine.js for you. Just make sure your `app.js` file is registered somwhere in the `<head>` tag.

## VS Code Extension

For the best development experience, install the [Bond VS Code extension](https://marketplace.visualstudio.com/items?itemName=ganyicz.bond-vscode-extension). It provides syntax highlighting, autocomplete, and error checking for both Bond components and Alpine.js attributes. The extension will be open-sourced in a future release.

Make sure to also install the official [Laravel extension](https://marketplace.visualstudio.com/items?itemName=laravel.vscode-laravel).

Bond will only load in files with language mode set to `Blade`.

## Quick guide

Make sure you are familiar with both [Alpine.js](https://alpinejs.dev/start-here) and [Laravel Blade](https://laravel.com/docs/12.x/blade), as Bond builds on top of these technologies and supports all their features.

When ready, start your Vite development server:

```bash
npm run dev
```

### Creating a new component

Bond is intended to be used within Blade components. Create one in `resources/views/components`. You can use the following Artisan command:

```bash
php artisan make:view components.alert
```

Then add a `<script setup>` tag and `{{ $attributes }}` as described below.

### `<script setup>`

This is where you'll define props, state, and functions for this component. Bond’s Vite plugin will scan all Blade files within your `resources/views` directory, extract code from `<script setup>` tags and bundle it into a single JavaScript file. The script tags will never actually be rendered on the page. 

```html
<script setup>
    mount((props: {
        //
    }) => ({
        //
    }))
</script>
```

> [!IMPORTANT]
> Since the code will get extracted into a JavaScript file, you cannot use Blade within the script tag.

The component gets automatically mounted on the element where you place your `{{ $attributes }}`. In the background, Bond just adds directives like `x-data` and `x-component` to your attributes to identify and initialize the component.

```html
<div {{ $attributes }}> <!-- This will be the root -->
    ...
</div>
```

> [!IMPORTANT]
> Components using `<script setup>` are isolated from the outer scope by design. To pass data in, use props or slots.

### Defining props

Props let you pass reactive data from outside into your component. Define them in the callback parameter of the mount function with a type annotation:

```html
<script setup>
    mount((props: {
        message: string,
    }) => ({
        init() {
            console.log(props.message)
        }
    }))
</script>
```

Props can be accessed inside the `mount` function and in the template using the `props.` prefix.

```html
<span x-text="props.message"></span>
```

### Passing props

Once defined, any Alpine or Livewire variable can be passed in as a prop using the `x-` prefix:

```html
<x-alert
    x-message="errors[0]"
    x-open="$wire.open"
/>
```

All props are two-way bound by default. The `message` inside the component will reactively update when the outer variable changes and vice versa. (This behavior might change in future releases.)

You can also pass static values like numbers, strings, or functions.

```html
<x-number-input
    x-step="0.1"
    x-format="'9.99'"
    x-onincrement="() => console.log('incremented')"
/>
```

> [!CAUTION]
> Prop names cannot conflict with Alpine.js directives. For example, you cannot use `on`, `model`, or `text`. For the full list of reserved names, see the list of directives in [Alpine.js docs](https://alpinejs.dev/start-here).

### Defining data

To define data and functions on your component, use the object returned from the `mount` function callback. When referencing data within that object, you must use the `this` keyword. In the template, you can access data directly without any prefix.

```html
<script setup>
    mount((props: {
        message: string,
    }) => ({
        uppercase: false,
        toggle() {
            this.uppercase = !this.uppercase
        },
        get formattedMessage() {
            return this.uppercase
                ? props.message.toUpperCase()
                : props.message
        },
    }))
</script>

<div {{ $attributes }}>
    <button x-on:click="toggle">Toggle</button>
    <span x-text="formattedMessage"></span>
</div>
```

### Using components

After you've defined your component, you can use it in your Blade templates like this:

```html
<div x-data="{ errors: ['You have exceeded your quota'] }">
    <x-alert x-message="errors[0]" />
</div>
```

While this is a simple example, you can use these patterns to build complex components with multiple props, two-way data binding, integrate with Livewire and more.

### Slots

Bond components are isolated, which also applies to slots. Any content you pass into a slot will NOT have access to the parent scope by default.

Let's use the example from before, but instead of passing the message as a prop, we will use a slot.

```html
<!-- This will throw an error -->

<div x-data="{ errors: ['You have exceeded your quota'] }">
    <x-alert>
        <span x-text="errors[0]"></span> <!-- errors is undefined -->
    </x-alert>
</div>
```

The `errors` variable will not be accessible.

To make the slot behave as expected, wrap it in an element with an `x-slot` directive inside your component.

```html
<div {{ $attributes }}>
    <div x-slot>{{ $slot }}</div>
</div>
```

> [!IMPORTANT]
> Directives used on an element with `x-slot` will also use the outer scope, not just its children.

### Imports

Since Bond compiles `<script setup>` tags with Vite, you can use any import supported in a JavaScript/TypeScript file:

```html
<script setup>
    // NPM module
    import { twMerge } from 'tailwind-merge'

    // Local file
    import { createTodo } from '@/todo'

    // Raw file content
    import check from '@resources/img/icons/check.svg?raw'

    // Types
    import type { TodoItem } from '@/types'
    
    mount(...)
</script>
```

The `@` alias points to `resources/js` by default. You can [customize the aliases](https://laravel.com/docs/12.x/vite#aliases) in your `vite.config.js` file, however this will not reflect in the VS Code extension at the moment and only the default alias will work in your IDE.

Make sure to always import types using the `import type` syntax to avoid issues.

### Else statement

Alpine does not support else statements out of the box. Bond adds _partial_ support for it. The limitation is that the template with the `x-else` directive must be inside the parent template.

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

This will likely be revisited in the next release with a more structured approach to icons.

### TypeScript

Bond uses TypeScript to provide a terse syntax for props and also to power the IDE features. However, it disables the `strict` mode by default. This means you are not forced to use types. You can write regular JavaScript without getting type errors, but still get autocomplete and type hints in your IDE.

Options for both enabling `strict` mode and fully opting out of TypeScript will be available in the future.

#### Adding types to properties

If a property is not initialized immediately, use the `as` keyword to define its type:

```html
<script setup>
    mount(() => ({
        value: null as number | null,
    }))
</script>
```

> [!IMPORTANT]
> TypeScript syntax is only supported inside `<script setup>`. Alpine expressions are not bundled, and using types in them will cause runtime errors.

## Roadmap

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

The syntax below was designed to be visually distinct from Blade directives and its HTML-like structure will be easy to compile into Alpine.js code.

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

`{name}` will be replaced with the actual value at runtime.

#### Cross-file IntelliSense (VS Code)

The Bond VS Code extension will provide autocomplete and type checking for props on the outside of the component, ensuring type safety across files.

#### Common error diagnostics (VS Code)

The Bond VS Code extension will include diagnostics for common errors in Alpine.js attributes, such as a missing key in a `x-for` loop, one root element per `<template>` tag, and more.

#### Blade enhancements 

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
