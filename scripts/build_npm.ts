import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/jsonbinding.ts"],
  testPattern: "EXCLUDE_tESTS",
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "@adllang/jsonbinding",
    version: "0.2.3",
    description: "A typescript library for JSON serialization",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/adl-lang/ts-jsonbinding.git",
    },
    bugs: {
      url: "https://github.com/adl-lang/ts-jsonbinding/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE.txt", "npm/LICENSE.txt");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
