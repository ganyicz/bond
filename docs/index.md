> ⚠️ **Early Preview:**  
> This package is currently under active development and not yet intended for production use. Feedback and contributions are welcome!

![Banner](https://raw.githubusercontent.com/ganyicz/bond/main/art/banner.png)

Bond lets you write modern React/Vue-like components inside Laravel Blade only using Alpine.js. It adds few new features to mimick the experience of authoring components in modern JavaScript frameworks and it also comes with a VS Code extension that provides syntax highlighting, autocomplete and error checking.

## Installation

To get started, install Bond into your project using Composer:

```bash
composer require ganyicz/bond
```

After installation, create a new javascript file in the 'resources/js' folder named 'bond.js' or 'bond.ts' with the following content:

```
import 'virtual:bond';
```

Bond will compile all scripts extracted from blade files here.

Next, register this file and Bond plugin in your `vite.config.js`

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

Lastly, publish Bond's assets and register them along with the newly created file in your layout:

```bash
php artisan vendor:publish --tag=bond-assets
```

```diff
<head>
+   <script src="{{ asset('vendor/alpine-bond-plugin.js') }}"></script>
-   @vite(['resources/css/app.css', 'resources/js/app.js'])
+   @vite(['resources/css/app.css', 'resources/js/app.js', 'resources/js/bond.js'])
</head>
```

These need to be placed in the <head> tag and the plugin needs to be registered first.

## VS Code Extension

For the best development experience, install the [Bond VS Code extension](https://marketplace.visualstudio.com/items?itemName=ganyicz.bond) which provides syntax highlighting, autocomplete, and error checking for Bond components and Alpine.js attributes.

The code for this extension will be open-sourced later.

## Features

### <script setup>

The `<script setup>` tag allows you to write your Blade components with a clear separation of javascript logic. The code inside will be extracted and bundled into a single file using Vite.

The component will be mounted on the element where you put `{{ $attributes }}`, this will most commonly be your parent element. This step is required to initialize the component and bind it's logic to the DOM element.

> [!IMPORTANT]
> Components with `<script setup>` tag are isolated and do not have access to the outside scope. This is by design to prevent unexpected behavior. If you need to pass data into the component you can use props or slots.

### Props

Props are used to pass reactive data into the component from the outside. They are defined in the `mount` function's callback parameter using a type annotation. This allows you to specify the expected structure of the props and also get type checking and autocompletion in your IDE.

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

The `props` object can be any valid TypeScript structure. You can even import types from other files:

```html
<script setup>
    import { TodoItem } from '@/types'

    mount((props: {
        item: TodoItem
    }) => ({
        ...
    }))
</script>
```

Once defined, you can pass props to it by prefixing the prop name with `x-`:

```html
<x-number-input x-step="outer" />
```

In addition to passing variables, you can also pass static values, like numbers, strings or functions: 

```html
<x-number-input
    x-step="0.1"
    x-format="'9.99'"
    x-onincrement="() => console.log('incremented')"
/>
```

You can pass any Alpine.js variable from the outside scope, including Livewire properties. This is particulary useful when using the `$wire` object, allowing you to write components with optimistic UI updates without triggering a server request.

```html
<x-number-input x-step="$wire.precision">
```

### Slots

Since every Bond component is isolated, using data from outside scope doesn't work by design. This also applies to Blade slots because in the final html structure, the slot content will be a descendant of the Bond component.

This might be unexpected when you have a component like this:

```html
<div x-data="{ message: 'You have exceeded your quota' }">
    <x-alert>
        <span x-text="message"></span> <!-- message is undefined -->
    </x-alert>
</div>
```

To enable the expected behavior, wrap the slot with an element that has an `x-slot` directive. This will reset the scope back to the parent element, allowing you to use Blade slots as expected.

```html
<script setup>
    ...
</script>

<div {{ $attributes }}>
    <div x-slot>{{ $slot }}</div>
</div>
```

> [!IMPORTANT]
> Any attributes on an element with x-slot will already have the outside scope, not just the elements inside that element.
 
### Else statement

Alpine doesn't currently support else statement which makes it difficult to build dynamic templates. Bond adds a _partial_ support for it. The limitation is that the template with `x-else` directive needs to be inside the parent template.

```html
<template x-if="active">
    Your subscription is active
    <template x-else>
        Your subscription has expired
    </template>
</template>
```

This will be later fixed by introducing a [custom syntax for control statements](#control-statement-tags) which will look like this:

```html
<!-- This is NOT yet supported -->

<if {active}>
    Your subscription is active
<else>
    Your subscription has expired
</if>
```

### Imports

Since all `<script setup>` tags will get compiled with Vite, you can use all the features you would normally use in a javascript file. All packages installed in your package.json will be available here. You can import npm modules, local files, types or even raw file contents. 

```html
<script setup>
    import { twMerge } from 'tailwind-merge'
    import { createTodo } from '@/todo'
    import type { TodoItem } from '@/types'
    import check from '@resources/img/icons/check.svg?raw'
</script>
```

### Icons

Using dynamic icons in Alpine.js can be challenging. Usually you would first render all icons and then dynamically show/hide them using `x-show`. With Bond, you can import svgs into your bundle and render them using the `x-html` attribute.

```html
<script setup>
    import check from '@resources/img/icons/check.svg?raw'

    mount(() => ({
        icons: {check}
    }))
</script>

<div {{ $attributes }}>
    <span x-html="icons.check"></span>
</div>
```

This will be replaced by a more streamlined solution in the future versions.

### TypeScript

Bond takes advantage of TypeScript to provide a terse syntax for defining props and also to power the IDE features like autocomplete and error checking. By default Bond doesn't use the `strict` mode, allowing you to only use types where you need them and avoid a lot of boilerplate.

Opting out of TypeScript might become an option in the near future however since the strict mode is turned off by default, you can simply write javascript as you would normally without any extra errors.

Enabling strict mode is currently not possible but will be added soon.

> [!IMPORTANT]
> Typescript syntax is only supported inside `<script setup>` tags. Since Alpine expressions are not bundled, using TypeScript in them would cause a syntax error in the browser. (This might be revisited in near future)

#### Adding types to properties

When a property is not initialized immediately, you can use TypeScript's `as` keyword to add types to your component's state.

```html
<script setup>
    mount(() => ({
        value: null as number | null,
    }))
</script>
```

In this example, the `value` property is explicitly typed as `number | null`, making it clear that it can hold a number. This helps prevent type errors and improves autocompletion in your editor.

### Roadmap

The following features are planned for future versions of Bond but are not yet implemented or finalized. Please provide feedback on these features if you have any suggestions or ideas or create a PR to implement them.

#### Attribute syntax

In future versions of Bond, you will be able to use a JSX-like syntax for attributes. This provides visual separation from regular attributes and consistent syntax with control statements and interpolation. This feature will be optional.

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

This would be the equivalent of writing:

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

Writing control statements in Alpine requires you to wrap your elements in a `<template>` tag. This is verbose and makes for less readable code. In future versions, Bond will come with a custom syntax that will be compiled into standard Alpine.js code.

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

This would simply compile to:

```html
<template x-if="active">
    <template x-else>
    </template>
</template>

<template x-for="account in accounts">
</template>
```

#### Interpolation

One of the most common patterns in frontend frameworks like is dynamically rendering values inside HTML. Bond will support this using a custom `x-template` directive that will parse the inner HTML at runtime and replace variables wrapped in single curly braces `{}` with their values.

```html
<!-- This is NOT yet supported -->

<div x-template>Hello, {name}</div>
```

#### Cross-file Intellisense (VS Code)

In future versions, the Bond VS Code extension will provide autocomplete and type checking for props passed in from outside of the component, ensuring type safety across files.

#### Common error diagnostics (VS Code)

The Bond VS Code extension will include diagnostics for common errors in Alpine.js attributes, such as missing key in a for loop, one root root element per template tag and more.

#### Blade improvements

Although this package is mainly focused on augmenting Alpine.js, there are few Blade-specific features that would be useful in the context of writing complex frontends. Namely, improving the modularity and organization:

**Multiple components per file**

```html
<!-- This is NOT yet supported -->
@export
<div>...</div>
@export('title')
<h3>...</h3>
@export('header)
<div>...</div>
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
