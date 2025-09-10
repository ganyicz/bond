import * as esbuild from 'esbuild';

const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

const options = {
    entryPoints: ['./src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: '../../dist/vite.js',
    sourcemap: !isProduction,
    external: [
        'vite',
        'typescript',
        'fs',
        'magic-string',
    ]
}

if (process.argv.includes('--watch')) {
    const ctx = await esbuild.context(options)
    await ctx.watch()
    console.log('watching...');
} else {
    await esbuild.build(options)
}
