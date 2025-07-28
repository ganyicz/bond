# Bond for Blade and Alpine.js

This package lets you write modern React/Vue-like components inside Laravel Blade without having to buy-in to a full ecosystem like Vue or React. It uses Alpine.js under the hood and adds a few new features like props, script setup and JSX-like syntax for attributes to mimick the experience of writing components in modern frontend frameworks.

# Writing components

A basic Blade component that uses Bond looks like this:

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
    <x-button onclick={increment} icon="minus" />
</div>
```
