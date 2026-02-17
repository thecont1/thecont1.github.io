---
title: "vscode"
description: "Visual Studio Code"
metaDescription: "Visual Studio Code: Microsoft's open-source code editor built with TypeScript and Electron. 163k+ stars on GitHub."
status: "published"
repoUrl: "https://github.com/microsoft/vscode"
repoOwner: "microsoft"
repoName: "vscode"
language: "TypeScript"
stars: 163000
forks: 28900
license: "MIT"
homepage: "https://code.visualstudio.com"
date: 2024-01-01
lastUpdated: 2024-01-01
tags:
  - "typescript"
  - "electron"
  - "editor"
  - "ide"
topics:
  - "vscode"
  - "editor"
  - "typescript"
  - "electron"
dependencies:
  - "electron"
  - "monaco-editor"
devDependencies:
  - "@types/node"
  - "typescript"
apiData:
  fetchedAt: 2024-01-01
  readme: "cached"
  fileTree:
    - "src"
    - "extensions"
    - "build"
    - "test"
  languages:
    TypeScript: 15234567
    JavaScript: 2345678
    CSS: 567890
author: "Siddharth Kaneria"
---

## Repository Overview

⭐ 163,000 stars • 🍴 28,900 forks • 📝 TypeScript • 📄 MIT

**Repository:** [microsoft/vscode](https://github.com/microsoft/vscode)
**Homepage:** [https://code.visualstudio.com](https://code.visualstudio.com)
**Last Updated:** January 1, 2024

## Tech Stack

### Dependencies
- electron
- monaco-editor

### Development Dependencies
- @types/node
- typescript

## Project Structure

```
📁 src/
📁 extensions/
📁 build/
📁 test/
```

## Languages

- **TypeScript**: 85.2%
- **JavaScript**: 13.1%
- **CSS**: 1.7%

## README

# Visual Studio Code - Open Source ("Code - OSS")

[![Feature Requests](https://img.shields.io/github/issues/Microsoft/vscode/feature-request.svg)](https://github.com/Microsoft/vscode/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
[![Bugs](https://img.shields.io/github/issues/Microsoft/vscode/bug.svg)](https://github.com/Microsoft/vscode/issues?utf8=✓&q=is%3Aissue+is%3Aopen+label%3Abug)
[![Gitter](https://img.shields.io/badge/chat-on%20gitter-yellow.svg)](https://gitter.im/Microsoft/vscode)

The Repository of [Visual Studio Code](https://code.visualstudio.com) is where we (Microsoft) develop the [Visual Studio Code](https://code.visualstudio.com) product together with the community. Not only do we work on code and issues here, we also publish our [roadmap](https://github.com/microsoft/vscode/wiki/Roadmap), [monthly iteration plans](https://github.com/microsoft/vscode/wiki/Iteration-Plans), and our [endgame plans](https://github.com/microsoft/vscode/wiki/Running-the-Endgame). This source code is available to everyone under the standard [MIT license](https://github.com/microsoft/vscode/blob/main/LICENSE.txt).

## Contributing

There are many ways in which you can participate in this project, for example:

* [Submit bugs and feature requests](https://github.com/microsoft/vscode/issues), and help us verify as they are checked in
* Review [source code changes](https://github.com/microsoft/vscode/pulls)
* Review the [documentation](https://github.com/microsoft/vscode-docs) and make pull requests for anything from typos to additional and new content

If you are interested in fixing issues and contributing directly to the code base, please see the document [How to Contribute](https://github.com/Microsoft/vscode/wiki/How-to-Contribute), which covers the following:

* [How to build and run from source](https://github.com/Microsoft/vscode/wiki/How-to-Contribute)
* [The development workflow, including debugging and running tests](https://github.com/Microsoft/vscode/wiki/How-to-Contribute#debugging)
* [Coding guidelines](https://github.com/Microsoft/vscode/wiki/Coding-Guidelines)
* [Submitting pull requests](https://github.com/Microsoft/vscode/wiki/How-to-Contribute#pull-requests)
* [Finding an issue to work on](https://github.com/Microsoft/vscode/wiki/How-to-Contribute#where-to-contribute)
* [Contributing to translations](https://aka.ms/vscodeloc)

## Feedback

* Ask a question on [Stack Overflow](https://stackoverflow.com/questions/tagged/vscode)
* [Request a new feature](CONTRIBUTING.md)
* Upvote [popular feature requests](https://github.com/Microsoft/vscode/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
* [File an issue](https://github.com/Microsoft/vscode/issues)
* Connect with the extension author community on [GitHub Discussions](https://github.com/Microsoft/vscode-discussions/discussions) or [Slack](https://aka.ms/vscode-dev-community)
* Follow [@code](https://twitter.com/code) and let us know what you think!

## Related Projects

Many of the core components and extensions to VS Code live in their own repositories on GitHub. For example, the [node debug adapter](https://github.com/microsoft/vscode-node-debug) and the [mono debug adapter](https://github.com/microsoft/vscode-mono-debug) repositories are separate from each other.

For a complete list, please visit the [Related Projects](https://github.com/Microsoft/vscode/wiki/Related-Projects) page on our [wiki](https://github.com/Microsoft/vscode/wiki).

## Bundled Extensions

VS Code includes a set of built-in extensions located in the [extensions](extensions) folder, including grammars and snippets for many languages. Extensions that provide rich language support (code completion, Go to Definition, etc.) for a language have the suffix `language-features`. For example, the `json` extension provides coloring for `JSON` files and `json-language-features` provides rich language support for `JSON` files.

## Development Container

This repository includes a Visual Studio Code Dev Containers / GitHub Codespaces development container.

- For [Dev Containers](https://aka.ms/vscode-remote/download/containers), use the **Dev Containers: Clone Repository in Container Volume...** command which creates a Docker volume for better disk I/O on macOS and Windows.
- For Codespaces, install the [GitHub Codespaces](https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces) extension in VS Code, and use the **Codespaces: Create New Codespace** command.

Docker / the Codespace should have at least **4 Cores and 6 GB of RAM (8 GB recommended)** to run full build. See the [development container README](https://github.com/Microsoft/vscode/blob/main/.devcontainer/README.md) for more information.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MIT](LICENSE.txt) License.