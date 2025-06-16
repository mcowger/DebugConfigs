# GitHub Actions for DebugConfigs VS Code Extension

This directory contains GitHub Actions workflows for automatically building, testing, and releasing the DebugConfigs VS Code extension.

## Workflows

### `build-and-release.yml`

This workflow:

1. **Triggers on**:
   - Push to `master` or `main` branch
   - Pull requests to `master` or `main` branch

2. **Build and Test Job**:
   - Runs on Ubuntu latest
   - Sets up Node.js 18
   - Installs dependencies
   - Runs linting
   - Compiles TypeScript
   - Runs tests (with xvfb for Linux GUI testing)

3. **Package and Release Job** (only on push to master/main):
   - Runs after successful build and test
   - Compiles the extension
   - Packages it as a `.vsix` file using `vsce`
   - Checks if a release with the current version already exists
   - Creates a GitHub release with the `.vsix` file attached (if version doesn't exist)

## Release Process

The release process is fully automated:

1. Update the version in `package.json`
2. Commit and push to the `master` branch
3. GitHub Actions will automatically:
   - Build and test the extension
   - Package it as a `.vsix` file
   - Create a GitHub release with the version tag
   - Attach the `.vsix` file to the release

## Manual Commands

You can also build the extension locally:

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
npm run package

# Publish to VS Code Marketplace (requires authentication)
npm run publish
```

## Requirements

- The workflow requires the `GITHUB_TOKEN` secret, which is automatically provided by GitHub Actions
- For publishing to the VS Code Marketplace, you would need to add a `VSCE_PAT` secret with your Personal Access Token
