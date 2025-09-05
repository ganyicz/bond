import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

export default function bond(options = {}) {
  const {
    viewsPath = 'resources/views',
    watchFiles = true,
  } = options;

  let server;
  const virtualModuleId = 'virtual:bond';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  /**
   * Find all .blade.php files recursively  
   */
  function findBladeFiles(dir) {
    if (!existsSync(dir)) {
      return [];
    }

    const files = [];
    
    function traverse(currentDir) {
      try {
        const items = readdirSync(currentDir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = join(currentDir, item.name);
          
          if (item.isDirectory()) {
            traverse(fullPath);
          } else if (item.name.endsWith('.blade.php')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`[bond] Cannot read directory ${currentDir}:`, error.message);
      }
    }
    
    traverse(dir);
    return files;
  }


  /**
   * Extract <script setup> content from blade file (only first one)
   */
  function extractScriptSetup(content) {
    const scriptSetupRegex = /<script\s[^>]*\bsetup\b[^>]*>([\s\S]*?)<\/script>/i;
    const match = scriptSetupRegex.exec(content);
    
    return match ? match[1].trim() : null;
  }

  /**
   * Generate component name from file path
   */
  function generateComponentName(viewsPath, filePath) {
    const relativePath = filePath
      .replace(resolve(viewsPath), '')
      .replace(/^\//, '')
      .replace(/\.blade\.php$/, '')
      .replace(/\//g, '.');
    
    return relativePath;
  }

  function extractPropNames(code) {
    const typeMatch = code.match(/props\s*:\s*{([^}]*)}/s);
    if (!typeMatch) return [];

    const propsMatch = typeMatch[1].matchAll(/["']?([a-zA-Z_$][\w$]*)["']?\s*\??:/g);
    return [...propsMatch].map(m => m[1]);
  }

  function transformMountCalls(code, filename) {
    const componentName = generateComponentName(viewsPath, filename);
    const props = JSON.stringify(extractPropNames(code))

    let modified = ''

    modified += "import { mount } from 'bond';\n\n"
    modified += code.replace('mount(', `mount("${componentName}", ${props}, `)
    
    return modified
  }

  /**
   * Parse blade script request
   */
  function parseBladeRequest(id) {
    const [filename] = id.split('?', 2);
    return { filename };
  }

  /**
   * Check if this is a blade script request
   */
  function isBladeScriptRequest(id) {
    return id.includes('?bond');
  }


  /**
   * Handle file changes for blade files
   */
  function handleFileChange(filePath) {
    if (server) {
      // Invalidate the main virtual module
      const virtualModule = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
      if (virtualModule) {
        server.reloadModule(virtualModule);
      }
      
      // Find and invalidate the corresponding virtual .ts?bond module
      const cleanPath = filePath.replace(/\.blade\.php$/, '');
      const virtualScriptPath = `${cleanPath}.ts?bond`;
      
      const scriptModule = server.moduleGraph.getModuleById(virtualScriptPath);
      if (scriptModule) {
        server.reloadModule(scriptModule);
      }
      
      // Force a full reload as fallback
      server.ws.send({
        type: 'full-reload'
      });
    }
  }

  return {
    name: 'vite-blade-script-setup',
    
    configureServer(devServer) {
      server = devServer;
      
      // Setup file watching using Vite's internal watcher during dev
      if (watchFiles) {
        const bladeFiles = findBladeFiles(resolve(viewsPath));
        
        for (const filePath of bladeFiles) {
          // Add each blade file to Vite's watcher
          server.watcher.add(filePath);
        }
        
        // Listen to file changes
        server.watcher.on('change', (filePath) => {
          if (filePath.endsWith('.blade.php')) {
            handleFileChange(filePath)
          }
        });
        server.watcher.on('add', (filePath) => {
          if (filePath.endsWith('.blade.php')) {
            handleFileChange(filePath);
          }
        });
        server.watcher.on('unlink', (filePath) => {
          if (filePath.endsWith('.blade.php')) {
            handleFileChange(filePath);
          }
        });
      }
    },

    buildStart() {
      // During build, automatically discover and add blade files to the build
      const bladeFiles = findBladeFiles(resolve(viewsPath));
      
      for (const filePath of bladeFiles) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const script = extractScriptSetup(content);
          
          if (script) {
            this.addWatchFile(filePath);
          }
        } catch (error) {
          console.warn(`[bond] Error processing ${filePath}:`, error.message);
        }
      }
    },

    resolveId(id) {
      // Handle the main virtual module
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      
      // Handle bond module alias
      if (id === 'bond') {
        return resolve(process.cwd(), 'vendor/ganyicz/bond/js/bond.js');
      }
      
      // Handle blade script requests similar to Vue's approach
      if (isBladeScriptRequest(id)) {
        return id; // Return as-is, we'll handle it in load
      }
      return null;
    },

    load(id) {
      // Handle the main virtual module that imports all blade scripts
      if (id === resolvedVirtualModuleId) {
        const bladeFiles = findBladeFiles(resolve(viewsPath));
        const imports = [];
        
        for (const filePath of bladeFiles) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            const script = extractScriptSetup(content);
            
            if (script) {
              // Create a .ts virtual file so Vite handles TypeScript transformation
              // Remove .blade.php and add .ts extension
              const cleanPath = filePath.replace(/\.blade\.php$/, '');
              const virtualPath = `${cleanPath}.ts?bond`;
              imports.push(`import '${virtualPath}';`);
            }
          } catch (error) {
            console.warn(`[bond] Error processing ${filePath}:`, error.message);
          }
        }
        
        const moduleContent = imports.length > 0 
          ? imports.join('\n') 
          : '// No blade script setup blocks found';
        
        return moduleContent;
      }
      
      // Handle blade script requests
      if (isBladeScriptRequest(id)) {
        const { filename } = parseBladeRequest(id);
        
        try {
          // Remove the .ts extension and add back .blade.php to get the actual file
          const actualFilename = filename.replace(/\.ts$/, '.blade.php');
          
          const content = readFileSync(actualFilename, 'utf-8');
          const script = extractScriptSetup(content);
          
          if (script) {
            // Transform mount() calls before returning
            const transformedScript = transformMountCalls(script, actualFilename);
            return transformedScript;
          } else {
            console.warn(`[bond] No script setup found in ${actualFilename}`);
            return 'export {};'; // Empty module
          }
        } catch (error) {
          console.error(`[bond] Error loading blade script ${filename}:`, error.message);
          return 'export {};'; // Empty module fallback
        }
      }

      return null;
    },

    transform(_, id) {
      // Transform main blade files to import their script setup content
      if (id.endsWith('.blade.php') && !isBladeScriptRequest(id)) {
        try {
          const content = readFileSync(id, 'utf-8');
          const script = extractScriptSetup(content);
          
          if (script) {
            // Generate import for the script setup block
            const importStatement = `import '${id}.ts?bond';`;
            
            // Return the import as the module content
            return {
              code: importStatement,
              map: null
            };
          }
        } catch (error) {
          console.warn(`[bond] Error transforming blade file ${id}:`, error.message);
        }
      }

      return null;
    },


  };
}
