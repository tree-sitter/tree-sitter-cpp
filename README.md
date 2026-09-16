# tree-sitter-cpp

[![CI][ci]](https://github.com/tree-sitter/tree-sitter-cpp/actions/workflows/ci.yml)
[![discord][discord]](https://discord.gg/w7nTvsVJhm)
[![matrix][matrix]](https://matrix.to/#/#tree-sitter-chat:matrix.org)
[![crates][crates]](https://crates.io/crates/tree-sitter-cpp)
[![npm][npm]](https://www.npmjs.com/package/tree-sitter-cpp)
[![pypi][pypi]](https://pypi.org/project/tree-sitter-cpp)

C++ grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter).

## Local module-grammar prototype

This working copy uses the experimental module grammar DSL in `grammar.mjs`.
It requires matching `tree-sitter`, `tree-sitter-c`, and `tree-sitter-cpp`
checkouts on `prototype/module-grammar-dsl`, with the prototype changes present.
These prototype branches are experimental and are not released packages.
Arrange all three checkouts as siblings:

```text
workspace/
  tree-sitter/
  tree-sitter-c/
  tree-sitter-cpp/
```

With Node.js, npm, Rust/Cargo, and a C/C++ toolchain installed:

```sh
cd workspace/tree-sitter-c
npm install --ignore-scripts
cd ../tree-sitter-cpp
npm install --ignore-scripts
npm run generate -- --js-runtime native
npm run test:corpus
npm run lint
```

The local `tree-sitter-c` dependency supplies both `grammar.mjs` and the shared
`grammar-helpers.mjs` module. The local CLI development dependency
(`file:../tree-sitter/crates/cli/npm`) supplies the prototype DSL types.
`--ignore-scripts` skips the CLI's release-binary downloader and native binding
builds. Development commands use `scripts/tree-sitter.mjs` to run
`cargo run --manifest-path ../tree-sitter/Cargo.toml -p tree-sitter-cli --`
instead of a downloaded binary. Cargo builds the CLI on first use.
For non-sibling checkouts, `TREE_SITTER_DIR` overrides the wrapper's CLI checkout
path; npm's local dependencies still require the sibling layout.
Other CLI commands can be run with `npm run tree-sitter -- <command>`.

The grammar imports the C module and shared helpers and exports `rule()` bindings.
Matching names in the C grammar selected by `extends` are replaced implicitly;
zero-argument builders can call `C.<rule_name>.body()` to extend that C rule's
body explicitly. Scanner tokens use `rule()` and are designated solely by the
configuration's `externals` array. Its default
configuration selects `translation_unit` as the entry rule. The reserved
JavaScript name `this` is declared as `this_` in the same export chain. The DSL
strips that trailing underscore when assigning the grammar name.
The package remains CommonJS for its native Node bindings; only the grammar
and development wrapper are ES modules.

`npm test` still runs the native Node binding tests. After installing with scripts
disabled, run `npm rebuild node-addon-api tree-sitter` and `npm run install`
before `npm test`. The Node runtime development and peer dependencies use
`tree-sitter` 0.25 for the regenerated parser's ABI 15 support.

The existing hosted workflows use released tooling and do not provision all
three local prototype checkouts. They cannot validate this grammar syntax or
install the local dependencies as-is; use the local commands above until CI
builds the matching prototypes. CMake and Makefile builds still consume generated
`src/grammar.json` and C sources; regenerate them with the prototype CLI before
building bindings.

## References

- [Hyperlinked C++ BNF Grammar](http://www.nongnu.org/hcb/)
- [EBNF Syntax: C++](http://www.externsoft.ch/download/cpp-iso.html)

[ci]: https://img.shields.io/github/actions/workflow/status/tree-sitter/tree-sitter-cpp/ci.yml?logo=github&label=CI
[discord]: https://img.shields.io/discord/1063097320771698699?logo=discord&label=discord
[matrix]: https://img.shields.io/matrix/tree-sitter-chat%3Amatrix.org?logo=matrix&label=matrix
[npm]: https://img.shields.io/npm/v/tree-sitter-cpp?logo=npm
[crates]: https://img.shields.io/crates/v/tree-sitter-cpp?logo=rust
[pypi]: https://img.shields.io/pypi/v/tree-sitter-cpp?logo=pypi&logoColor=ffd242
