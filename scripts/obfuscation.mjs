import JavaScriptObfuscator from 'javascript-obfuscator';
export function protectJavaScript(code, target = 'node') {
  return JavaScriptObfuscator.obfuscate(code, {
    target, compact: true, identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
    stringArray: true, stringArrayThreshold: 0.8, stringArrayEncoding: ['base64'],
    controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.3,
    splitStrings: true, splitStringsChunkLength: 12, sourceMap: false,
  }).getObfuscatedCode();
}
