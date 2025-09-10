# CONTRIBUTING

Contributions are welcome, and are accepted via pull requests.
Please review these guidelines before submitting any pull requests.

For major changes, please open an issue first describing what you want to add/change.

## Process

1. Fork the project
2. Create a new branch
3. Code, test, commit and push
4. Open a pull request detailing your changes

## Guidelines

* Please ensure the coding style running `TBD`
* Send a coherent commit history, making sure each individual commit in your pull request is meaningful.
* You may need to [rebase](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) to avoid merge conflicts.
* Please remember that we follow [SemVer](http://semver.org/).

## Setup

Clone your fork, then install the dependencies:
```bash
composer install && npm install
```

You also need to install the dependencies for each package under `packages` with NPM:

```bash
npm run packages:install
```

## Building the Vite Plugin

To build the **Vite Plugin** at `packages/vite-plugin` you first need to build the **Parser** at `packages/language-core`, the following command will build the **Parser** and then the **Vite Plugin**:

```bash
npm run packages:build
```

You can build the **Vite Plugin** in Production mode with:

```bash
npm run packages:build:prod
```

## Lint

Lint your code:
`TBD`

## Tests

Run all tests: `TBD`
