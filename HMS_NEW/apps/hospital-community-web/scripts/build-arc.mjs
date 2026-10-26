import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";
const configs = [
  ["lightbox-gallery", "HospitalLightboxViewer"],
  ["date-reel", "DateReel"],
  ["team-showcase", "TeamShowcase"],
];
for (const [slug, name] of configs) {
  const base = new URL(`../src/vendor/pro/${slug}/`, import.meta.url);
  const entry = new URL(
    slug === "availability-picker" ? "src/index.js" : "src/app-entry.js",
    base,
  );
  const result = await build({
    entryPoints: [entry.pathname],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "browser",
    target: "es2022",
    external: ["react", "react-dom", "react/jsx-runtime"],
    legalComments: "inline",
  });
  let body = result.outputFiles[0].text
    .replace(/require\("react\/jsx-runtime"\)/g, "HostJSX")
    .replace(/require\("react-dom"\)/g, "HostReactDOM")
    .replace(/require\("react"\)/g, "HostReact");
  if (/\brequire\(["']/.test(body))
    throw new Error("Unresolved dependency: " + slug);
  const bridge = `import * as HostReact from 'react';import * as HostJSX from 'react/jsx-runtime';import * as HostReactDOM from 'react-dom';const module={exports:{}};const PortableAssetBase=globalThis.location?.origin+'/';const __assetUrl=value=>value;\n`;
  writeFileSync(
    new URL("dist/app.js", base),
    bridge +
      body +
      `\nconst Public${name}=module.exports.${name}; export {Public${name} as ${name}};\n`,
  );
  // Keep rules belonging to reachable CSS-module classes, rather than shipping the entire captured documentation stylesheet.
  const classes = new Set(
    [...body.matchAll(/["']([\w-]+__[\w-]+)["']/g)].map((match) => match[1]),
  );
  const css = postcss.parse(
    readFileSync(new URL("dist/styles.css", base), "utf8"),
  );
  css.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name))
      return;
    if (![...classes].some((name) => rule.selector.includes(name)))
      rule.remove();
  });
  css.walkAtRules((rule) => {
    if (rule.name === "font-face" || (rule.nodes && rule.nodes.length === 0))
      rule.remove();
  });
  writeFileSync(new URL("dist/app.css", base), css.toString());
  console.log("Built local Arc Pro adapter:", name);
}
