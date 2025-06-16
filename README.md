# Debug Configs Extension

A VS Code extension for managing debug configurations and tasks with hierarchical tree structures and variable substitution support.

## Version

This is an initial but working version. No tests.

## Features

- **Hierarchical Tree Structure**: Organize your debug configurations in a tree structure with folders and leaf nodes
- **Variable Substitution**: Reference tree values in your `launch.json` and `tasks.json` files using dotted notation
- **Persistent Storage**: Tree state is automatically saved and restored between VS Code sessions in the workspace storage.
- **Import/Export**: Save and load tree configurations as JSON files

## Variable Substitution

The extension provides a command `extension.debugconfigs.replace` that allows you to reference leaf node values in your debug configurations using dotted path notation.

### Usage

1. Create a tree structure in the Debug Configs view with folders and leaf nodes
2. Use the variable substitution in your `launch.json` or `tasks.json` files

### Example

If you have a tree structure like:

```
Environment
├── Development
│   ├── port: "3000"
│   └── host: "localhost"
└── Production
    ├── port: "8080"
    └── host: "prod.example.com"
```

You can reference these values in your `launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Development Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "PORT": "${input:devPort}",
        "HOST": "${input:devHost}"
      }
    }
  ],
  "inputs": [
    {
      "id": "devPort",
      "type": "command",
      "command": "extension.debugconfigs.replace",
      "args": {
        "path": "environment.development.port"
      }
    },
    {
      "id": "devHost",
      "type": "command",
      "command": "extension.debugconfigs.replace",
      "args": {
        "path": "environment.development.host"
      }
    }
  ]
}
```

### Path Format

- Use dot notation to navigate through the tree: `folder1.folder2.leafnode`
- Path matching is case-insensitive
- Only leaf nodes (nodes with values) can be referenced
- Parent nodes (folders) cannot be referenced directly
- Nodes with spaces are allowed but should be avoided for readability.
- **Important**: Labels cannot contain dots (.) as they are reserved for path navigation

### Error Handling

The command will throw descriptive errors if:

- The path doesn't exist
- A path segment has no children when expected
- The target is not a leaf node (has no value)
- No path argument is provided

## Tree Management

- **Add Root Item**: Create new top-level folders or leaf nodes
- **Add Child**: Add children to existing folders
- **Set Value**: Set or modify values for leaf nodes
- **Remove Item**: Delete folders or leaf nodes
- **Clear Tree**: Remove all items from the tree

## Generate Input Commands

The extension provides a convenient way to automatically generate the input commands needed for your `launch.json` configurations.

### Usage

1. Build your tree structure with folders and leaf nodes containing values
2. Run the command `debugConfigs.generateCommands` from the Command Palette
3. The extension will generate a JSONC file with all the input commands for your leaf nodes

### Generated Output

For a tree structure like:
```
Environment
├── Development
│   ├── port: "3000"
│   └── host: "localhost"
└── Production
    ├── port: "8080"
    └── host: "prod.example.com"
```

The generated output will be:
```jsonc
[
  // use this: ${input:environment.development.port}
  {
    "id": "environment.development.port",
    "type": "command",
    "command": "extension.debugconfigs.replace",
    "args": {
      "path": "environment.development.port"
    }
  },
  // use this: ${input:environment.development.host}
  {
    "id": "environment.development.host",
    "type": "command",
    "command": "extension.debugconfigs.replace",
    "args": {
      "path": "environment.development.host"
    }
  },
  // use this: ${input:environment.production.port}
  {
    "id": "environment.production.port",
    "type": "command",
    "command": "extension.debugconfigs.replace",
    "args": {
      "path": "environment.production.port"
    }
  },
  // use this: ${input:environment.production.host}
  {
    "id": "environment.production.host",
    "type": "command",
    "command": "extension.debugconfigs.replace",
    "args": {
      "path": "environment.production.host"
    }
  }
]
```

### How to Use Generated Commands

1. Copy the generated input commands from the output file
2. Paste them into the `inputs` array of your `launch.json` file
3. Reference them in your configurations using the syntax shown in the comments (e.g., `${input:environment.development.port}`)

This eliminates the need to manually write input commands and ensures consistency between your tree structure and launch configurations.

### Label Restrictions

- Labels cannot contain dots (.) as they are used for path navigation
- The extension will prevent creating labels with dots and show validation errors
- Importing JSON files with labels containing dots will fail with an error message

## Commands

- `debugConfigs.refresh`: Refresh the tree view
- `debugConfigs.addRootItem`: Add a new root item
- `debugConfigs.clearTree`: Clear the entire tree
- `debugConfigs.addChild`: Add a child to selected item
- `debugConfigs.removeItem`: Remove selected item
- `debugConfigs.setValue`: Set value for selected item
- `extension.debugconfigs.replace`: Variable substitution command
- `debugConfigs.exportTree`: Export tree as JSON
- `debugConfigs.importTree`: Import tree from JSON
- `debugConfigs.generateCommands`: Generate input commands JSON from tree structure

## Installation

2. The Debug Configs view will appear in the Debug panel
3. Start building your configuration tree and using variable substitution

## Contributing

This extension is open source. Feel free to contribute improvements and bug fixes.
