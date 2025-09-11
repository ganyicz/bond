# CONTRIBUTING

Please review these guidelines before submitting a pull request.

## Local setup

Install dependencies for the package you want to work on:

```bash
cd packages/vite-plugin && npm install
```

## Building the Vite Plugin

To build the **Vite Plugin** at `packages/vite-plugin` you first need to build the `packages/language-core` by running:

```bash
cd packages/language-core && npm run build
```

The dist file needs to be commited to the repository, so please make sure to run the build command after making changes to the source code. This is a temporary measure for until the individual packages are published to npm. It's easier to keep the built files as a part of the Laravel package during beta development.

## Installation (beta)

To test the package in a local Laravel project, you can use [composer-link](https://github.com/SanderSander/composer-link). Once you've installed it globally, you can run the following command in the root of your Laravel project:

```bash
composer link ../path/to/bond
```

This will create a symlink to the Bond package in your Laravel project's `vendor` directory, allowing you to test changes locally.

After linking the package, add the following dependency to your `package.json`:

```
"@bond/alpine-plugin": "file:./vendor/ganyicz/bond/packages/alpine-plugin"
```

Next, update your `app.js` file to register the Alpine plugin and compiled Bond scripts:

```js
import { Livewire, Alpine } from '../../vendor/ganyicz/bond/dist/livewire.esm';
import Bond from '@bond/alpine-plugin';
import 'virtual:bond';

window.Alpine = Alpine

Alpine.plugin(Bond)

Livewire.start()
```

_The beta version is currently using a custom build of Livewire. This is due to a pending PR in Alpine.js which is bundled with Livewire. Once that PR is merged and released, we can switch back to the official Livewire package._

Finally, update your `vite.config.js` to register the Vite plugin:

```diff
+ import bond from './vendor/ganyicz/bond/dist/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
+       bond(),
    ],
    ...
});
```
