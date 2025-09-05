import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
function bond(options = {}) {
  const {
    viewsPath = "resources/views",
    watchFiles = true
  } = options;
  let server;
  const virtualModuleId = "virtual:bond";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;
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
          } else if (item.name.endsWith(".blade.php")) {
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
  function extractScriptSetup(content) {
    const scriptSetupRegex = /<script\s[^>]*\bsetup\b[^>]*>([\s\S]*?)<\/script>/i;
    const match = scriptSetupRegex.exec(content);
    return match ? match[1].trim() : null;
  }
  function generateComponentName(viewsPath2, filePath) {
    const relativePath = filePath.replace(resolve(viewsPath2), "").replace(/^\//, "").replace(/\.blade\.php$/, "").replace(/\//g, ".");
    return relativePath;
  }
  function extractPropNames(code) {
    const typeMatch = code.match(/props\s*:\s*{([^}]*)}/s);
    if (!typeMatch) return [];
    const propsMatch = typeMatch[1].matchAll(/["']?([a-zA-Z_$][\w$]*)["']?\s*\??:/g);
    return [...propsMatch].map((m) => m[1]);
  }
  function transformMountCalls(code, filename) {
    const componentName = generateComponentName(viewsPath, filename);
    const props = JSON.stringify(extractPropNames(code));
    let modified = "";
    modified += "import { mount } from 'bond';\n\n";
    modified += code.replace("mount(", `mount("${componentName}", ${props}, `);
    return modified;
  }
  function parseBladeRequest(id) {
    const [filename] = id.split("?", 2);
    return { filename };
  }
  function isBladeScriptRequest(id) {
    return id.includes("?bond");
  }
  function handleFileChange(filePath) {
    if (server) {
      const virtualModule = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
      if (virtualModule) {
        server.reloadModule(virtualModule);
      }
      const cleanPath = filePath.replace(/\.blade\.php$/, "");
      const virtualScriptPath = `${cleanPath}.ts?bond`;
      const scriptModule = server.moduleGraph.getModuleById(virtualScriptPath);
      if (scriptModule) {
        server.reloadModule(scriptModule);
      }
      server.ws.send({
        type: "full-reload"
      });
    }
  }
  return {
    name: "vite-blade-script-setup",
    configureServer(devServer) {
      server = devServer;
      if (watchFiles) {
        const bladeFiles = findBladeFiles(resolve(viewsPath));
        for (const filePath of bladeFiles) {
          server.watcher.add(filePath);
        }
        server.watcher.on("change", (filePath) => {
          if (filePath.endsWith(".blade.php")) {
            handleFileChange(filePath);
          }
        });
        server.watcher.on("add", (filePath) => {
          if (filePath.endsWith(".blade.php")) {
            handleFileChange(filePath);
          }
        });
        server.watcher.on("unlink", (filePath) => {
          if (filePath.endsWith(".blade.php")) {
            handleFileChange(filePath);
          }
        });
      }
    },
    buildStart() {
      const bladeFiles = findBladeFiles(resolve(viewsPath));
      for (const filePath of bladeFiles) {
        try {
          const content = readFileSync(filePath, "utf-8");
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
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      if (id === "bond") {
        return resolve(process.cwd(), "vendor/ganyicz/bond/js/bond.js");
      }
      if (isBladeScriptRequest(id)) {
        return id;
      }
      return null;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const bladeFiles = findBladeFiles(resolve(viewsPath));
        const imports = [];
        for (const filePath of bladeFiles) {
          try {
            const content = readFileSync(filePath, "utf-8");
            const script = extractScriptSetup(content);
            if (script) {
              const cleanPath = filePath.replace(/\.blade\.php$/, "");
              const virtualPath = `${cleanPath}.ts?bond`;
              imports.push(`import '${virtualPath}';`);
            }
          } catch (error) {
            console.warn(`[bond] Error processing ${filePath}:`, error.message);
          }
        }
        const moduleContent = imports.length > 0 ? imports.join("\n") : "// No blade script setup blocks found";
        return moduleContent;
      }
      if (isBladeScriptRequest(id)) {
        const { filename } = parseBladeRequest(id);
        try {
          const actualFilename = filename.replace(/\.ts$/, ".blade.php");
          const content = readFileSync(actualFilename, "utf-8");
          const script = extractScriptSetup(content);
          if (script) {
            const transformedScript = transformMountCalls(script, actualFilename);
            return transformedScript;
          } else {
            console.warn(`[bond] No script setup found in ${actualFilename}`);
            return "export {};";
          }
        } catch (error) {
          console.error(`[bond] Error loading blade script ${filename}:`, error.message);
          return "export {};";
        }
      }
      return null;
    },
    transform(_, id) {
      if (id.endsWith(".blade.php") && !isBladeScriptRequest(id)) {
        try {
          const content = readFileSync(id, "utf-8");
          const script = extractScriptSetup(content);
          if (script) {
            const importStatement = `import '${id}.ts?bond';`;
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
    }
  };
}
export {
  bond as default
};
