import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEMP_DIR = 'temp';
const LIVEWIRE_DIR = join(TEMP_DIR, 'livewire');
const ALPINE_DIR = join(TEMP_DIR, 'alpine');

async function getLatestLivewireRelease() {
    console.log('Fetching latest Livewire release...');
    const response = await fetch('https://api.github.com/repos/livewire/livewire/releases/latest');
    const data = await response.json();
    return data.tag_name;
}

function cleanupTemp() {
    if (existsSync(TEMP_DIR)) {
        rmSync(TEMP_DIR, { recursive: true, force: true });
    }
}

function setupDirectories() {
    cleanupTemp();
    mkdirSync(TEMP_DIR, { recursive: true });
}

function cloneRepositories(livewireTag) {
    console.log(`Cloning Livewire ${livewireTag}...`);
    execSync(`git clone --depth 1 --branch ${livewireTag} https://github.com/livewire/livewire.git ${LIVEWIRE_DIR}`, { stdio: 'inherit' });
    
    console.log('Cloning Alpine.js fork...');
    execSync(`git clone --depth 1 https://github.com/ganyicz/alpine.git ${ALPINE_DIR}`, { stdio: 'inherit' });
}

function buildAlpine() {
    console.log('Building Alpine.js fork...');
    execSync('npm install', { cwd: ALPINE_DIR, stdio: 'inherit' });
    execSync('npm run build', { cwd: ALPINE_DIR, stdio: 'inherit' });
}

function updateLivewirePackageJson() {
    console.log('Updating Livewire package.json...');
    const packageJsonPath = join(LIVEWIRE_DIR, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Replace alpinejs dependency with path to our fork
    packageJson.dependencies.alpinejs = `file:../alpine/packages/alpinejs`;
    
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function buildLivewire() {
    console.log('Installing Livewire dependencies...');
    execSync('npm install', { cwd: LIVEWIRE_DIR, stdio: 'inherit' });
    
    console.log('Building Livewire...');
    execSync('npm run build', { cwd: LIVEWIRE_DIR, stdio: 'inherit' });
}

function copyBuiltFiles() {
    console.log('Copying built files to dist...');
    const livewireDistDir = join(LIVEWIRE_DIR, 'dist');
    const outputDistDir = join('../', 'dist');
    
    // Copy all files from Livewire dist to our dist
    execSync(`cp ${livewireDistDir}/livewire.esm.js ${outputDistDir}`, { stdio: 'inherit' });
    execSync(`cp ${livewireDistDir}/livewire.esm.js.map ${outputDistDir}`, { stdio: 'inherit' });
}

async function main() {
    try {
        const livewireTag = await getLatestLivewireRelease();
        
        setupDirectories();
        cloneRepositories(livewireTag);
        buildAlpine();
        updateLivewirePackageJson();
        buildLivewire();
        copyBuiltFiles();
        cleanupTemp();
        
        console.log('✅ Livewire build completed successfully!');
    } catch (error) {
        cleanupTemp();
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

main();
