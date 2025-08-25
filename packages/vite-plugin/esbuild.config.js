import * as esbuild from 'esbuild';

const options = {
    entryPoints: ['./src/index.js'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: '../../dist/vite.js',
    sourcemap: true,
    external: [
        'vite',
        'typescript',
        'fs'
    ]
}

if (process.argv.includes('--watch')) {
    const ctx = await esbuild.context(options)
    await ctx.watch()
    console.log('watching...');
} else {
    await esbuild.build(options)
}
