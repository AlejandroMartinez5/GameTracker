const fs = require("node:fs");
const path = require("node:path");
const { Module, createRequire } = require("node:module");

function loadWithMocks(relativePath, mocks) {
  const filename = path.resolve(__dirname, "../src", relativePath);
  const nativeRequire = createRequire(filename);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.require = (request) => Object.hasOwn(mocks, request)
    ? mocks[request]
    : nativeRequire(request);
  loaded._compile(fs.readFileSync(filename, "utf8"), filename);
  return loaded.exports;
}

module.exports = { loadWithMocks };
