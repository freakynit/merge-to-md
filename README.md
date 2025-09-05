# merge-to-md

A simple Node.js CLI tool that recursively merges text/code files from a folder into a single Markdown file suitable for feeding as context to an LLM.

## Features

* Recursively processes all files in the input folder.
* Allows excluding files/folders using **comma-separated regex patterns**.
* Skips binary files.
* Wraps each file’s contents in Markdown code fences (with language detection based on file extension).
* Inserts a clear header block before each file’s content.
* Supports dry-run mode (see which files would be included without writing output).
* Supports limiting recursion depth.
* Optionally follows symbolic links.
* Outputs a single `context.md` file (or a user-specified path).

## Installation

1. Install globally using npm and then use it:
    ```bash
    npm i -g merge-to-md
    ```
2. Or, use `npx`. See [Usage](#usage) below.

## Usage

1. When globally installed using npm:
    ```bash
    merge-to-md --input <folder> [--exclude "pat1,pat2"] [--output <file>] [options]
    ```
2. When using npx:
    ```bash
    npx merge-to-md --input <folder> [--exclude "pat1,pat2"] [--output <file>] [options]
    ```

### Options

| Flag(s)                | Argument        | Description                                                                                   | Required | Default              | Example                                |
|-------------------------|-----------------|-----------------------------------------------------------------------------------------------|----------|----------------------|----------------------------------------|
| `-i, --input`           | `<folder>`      | Path to the folder you want to process.                                                       | ✅        | —                    | —                                      |
| `-e, --exclude`         | `<patterns>`    | Comma-separated list of regex patterns to exclude. Matches against relative/absolute paths.   | ❌        | —                    | `--exclude "node_modules,\\.git,\\.log$"` |
| `-o, --output`          | `<file>`        | Output path for the merged file.                                                              | ❌        | `./context.md`       | —                                      |
| `-d, --dry-run`         | —               | Runs without writing output. Prints the list of files that would be included.                 | ❌        | `false`              | —                                      |
| `-m, --max-depth`       | `<n>`           | Maximum recursion depth.                                                                      | ❌        | `Infinity`           | `--max-depth 2`                        |
| `-l, --follow-symlinks` | —               | Follow symbolic links when traversing directories.                                            | ❌        | `false`              | —                                      |
| `-h, --help`            | —               | Show usage info.                                                                              | ❌        | —                    | —                                      |


## Examples

```bash
# Merge all files under ./src, excluding node_modules and .git, into ./context.md
merge-to-md -i ./src -e "node_modules,\\.git" -o ./context.md
# Or, "npx merge-to-md ..."

# Merge docs folder and skip *.log files
merge-to-md --input ./docs --exclude "\\.log$"

# Dry-run: preview which files would be included, without writing output
merge-to-md -i ./src --dry-run

# Limit recursion depth to 1 (only process ./src and its immediate files)
merge-to-md -i ./src --max-depth 1

# Follow symlinks when traversing (useful for monorepos or linked packages)
merge-to-md -i ./project --follow-symlinks

# Combine multiple options
merge-to-md -i ./src -e "node_modules,\\.git" -m 3 -l -o merged.md
```

## Output Format

Each file in the merged output is prefixed like this:

````

================================================
FILE: /absolute/path/to/the/file.js
================================================

```javascript
// File content here
```

````

## File Type Detection

The script attempts to detect the programming language from the file extension and use the correct Markdown code block fence (e.g., ` ```js`, ` ```python`). Unknown types fall back to plain triple backticks.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
