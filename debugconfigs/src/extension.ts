import * as vscode from 'vscode';
import { DebugConfigTreeDataProvider } from './DebugConfigTree';

export function activate(context: vscode.ExtensionContext) {
	// Create and register the tree data provider
	const treeDataProvider = new DebugConfigTreeDataProvider();

	// Register the tree data provider with VS Code
	const treeView = vscode.window.createTreeView('debugConfigs', {
		treeDataProvider: treeDataProvider,
		showCollapseAll: true
	});

	// Add to subscriptions for proper cleanup
	context.subscriptions.push(treeView);

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand('debugConfigs.refresh', () => {
		treeDataProvider.refresh();
	});

	context.subscriptions.push(refreshCommand);
}

export function deactivate() { }