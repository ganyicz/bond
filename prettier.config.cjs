// Prettier configuration based on widely adopted OSS conventions (Vercel/Next.js, TypeScript, etc.)
// Keep overrides minimal to reduce diff noise and stay close to Prettier defaults.

/** @type {import('prettier').Config} */
module.exports = {
  printWidth: 100,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  bracketSpacing: true,
  endOfLine: 'lf',
};
