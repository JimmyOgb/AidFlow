const fs = require("fs");
const path = require("path");

const files = [
  path.join(__dirname, "..", "node_modules", "genlayer-js", "dist", "index.js"),
  path.join(__dirname, "..", "node_modules", "genlayer-js", "dist", "index.cjs"),
];

for (const f of files) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, "utf8");
    if (content.includes('ret[""] = method;') && !content.includes('ret["method"] = method;')) {
      content = content.replace(
        'ret[""] = method;',
        'ret["method"] = method;\n    ret[""] = method;'
      );
      fs.writeFileSync(f, content, "utf8");
      console.log("[patch-genlayer] Applied method key patch to", path.basename(f));
    }
  }
}
