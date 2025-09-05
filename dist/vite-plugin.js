import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import ts from "typescript";
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
  function generateComponentName(filePath) {
    const relativePath = filePath.replace(resolve(viewsPath), "").replace(/^\//, "").replace(/\.blade\.php$/, "").replace(/\//g, ".");
    return relativePath;
  }
  function extractPropNames(typeNode) {
    if (!ts.isTypeLiteralNode(typeNode)) {
      return [];
    }
    const propNames = [];
    for (const member of typeNode.members) {
      if (ts.isPropertySignature(member) && member.name) {
        if (ts.isIdentifier(member.name)) {
          propNames.push(member.name.text);
        }
      }
    }
    return propNames;
  }
  function transformMountCalls(code, filePath) {
    const componentName = generateComponentName(filePath);
    const usesMountFunction = code.includes("mount(");
    const sourceFile = ts.createSourceFile(
      "temp.ts",
      code,
      ts.ScriptTarget.ESNext,
      true
    );
    let hasChanges = false;
    const transformer = (context) => {
      return (rootNode) => {
        function visit(node) {
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "mount") {
            hasChanges = true;
            const callbackArg = node.arguments[0];
            if (ts.isArrowFunction(callbackArg)) {
              let propNames = [];
              if (callbackArg.parameters.length > 0) {
                const firstParam = callbackArg.parameters[0];
                if (firstParam.type) {
                  propNames = extractPropNames(firstParam.type);
                }
              }
              const newCallback = ts.factory.createArrowFunction(
                callbackArg.modifiers,
                callbackArg.typeParameters,
                callbackArg.parameters.map(
                  (param) => ts.factory.createParameterDeclaration(
                    param.modifiers,
                    param.dotDotDotToken,
                    param.name,
                    param.questionToken,
                    void 0,
                    // Remove type annotation
                    param.initializer
                  )
                ),
                callbackArg.type,
                callbackArg.equalsGreaterThanToken,
                callbackArg.body
              );
              return ts.factory.createCallExpression(
                node.expression,
                node.typeArguments,
                [
                  ts.factory.createStringLiteral(componentName),
                  ts.factory.createArrayLiteralExpression(
                    propNames.map((name) => ts.factory.createStringLiteral(name))
                  ),
                  newCallback
                ]
              );
            }
          }
          return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit);
      };
    };
    const result = ts.transform(sourceFile, [transformer]);
    let finalCode = code;
    if (hasChanges) {
      const printer = ts.createPrinter();
      finalCode = printer.printFile(result.transformed[0]);
    }
    result.dispose();
    if (usesMountFunction) {
      const importStatement = "import { mount } from 'bond';\n\n";
      finalCode = importStatement + finalCode;
    }
    return finalCode;
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
