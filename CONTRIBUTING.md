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

## Linking as a local dependency

To test the package in a local Laravel project, you can use [composer-link](https://github.com/SanderSander/composer-link). Once you've installed it globally, you can run the following command in the root of your Laravel project:

```bash
composer link ../path/to/bond
```

This will create a symlink to the Bond package in your Laravel project's `vendor` directory, allowing you to test changes locally.
