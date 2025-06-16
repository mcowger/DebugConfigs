import * as vscode from 'vscode';
import { DebugConfigTreeDataProvider, DebugConfigTreeItem } from './DebugConfigTree';
import * as jsonc from 'jsonc-parser';

export function activate(context: vscode.ExtensionContext) {
	// Create and register the tree data provider with workspace state
	const treeDataProvider = new DebugConfigTreeDataProvider([], context.workspaceState);

	// Load any previously saved tree state
	treeDataProvider.loadTreeState();

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

	// Register add root item command
	const addRootItemCommand = vscode.commands.registerCommand('debugConfigs.addRootItem', async () => {
		const label = await vscode.window.showInputBox({
			prompt: 'Enter label for the new root item',
			placeHolder: 'Item label',
			validateInput: (value: string) => {
				if (value.includes('.')) {
					return 'Labels cannot contain dots (.) as they are used for path navigation';
				}
				return undefined;
			}
		});

		if (label) {
			treeDataProvider.addRootItem(label);
		}
	});

	// Register clear tree command
	const clearTreeCommand = vscode.commands.registerCommand('debugConfigs.clearTree', async () => {
		const result = await vscode.window.showWarningMessage(
			'Are you sure you want to clear the entire tree?',
			{ modal: true },
			'Yes', 'No'
		);

		if (result === 'Yes') {
			treeDataProvider.clear();
		}
	});

	// Register add child command
	const addChildCommand = vscode.commands.registerCommand('debugConfigs.addChild', async (item: DebugConfigTreeItem) => {
		const label = await vscode.window.showInputBox({
			prompt: 'Enter label for the new child item',
			placeHolder: 'Child label',
			validateInput: (value: string) => {
				if (value.includes('.')) {
					return 'Labels cannot contain dots (.) as they are used for path navigation';
				}
				return undefined;
			}
		});

		if (!label) {
			return;
		}

		// Ask user if they want to create a leaf node (with value) or parent node (no value)
		const nodeType = await vscode.window.showQuickPick(
			[
				{ label: 'Leaf Node (with value)', value: 'leaf' },
				{ label: 'Parent Node (can have children)', value: 'parent' }
			],
			{
				placeHolder: 'What type of node do you want to create?'
			}
		);

		if (!nodeType) {
			return;
		}

		if (nodeType.value === 'leaf') {
			const value = await vscode.window.showInputBox({
				prompt: `Enter value for "${label}"`,
				placeHolder: 'Value'
			});

			if (value !== undefined) {
				treeDataProvider.addChildToItem(item, label, value);
			}
		} else {
			treeDataProvider.addChildToItem(item, label);
		}
	});

	// Register remove item command
	const removeItemCommand = vscode.commands.registerCommand('debugConfigs.removeItem', async (item: DebugConfigTreeItem) => {
		const result = await vscode.window.showWarningMessage(
			`Are you sure you want to remove "${item.label}"?`,
			{ modal: true },
			'Yes', 'No'
		);

		if (result === 'Yes') {
			treeDataProvider.removeItem(item);
		}
	});

	// Register set value command
	const setValueCommand = vscode.commands.registerCommand('debugConfigs.setValue', async (item: DebugConfigTreeItem) => {
		// Check if this is a parent node with children
		if (item.children && item.children.length > 0) {
			vscode.window.showErrorMessage(`Cannot set value for "${item.label}" because it has children. Remove all children first.`);
			return;
		}

		const currentValue = item.value || '';
		const value = await vscode.window.showInputBox({
			prompt: `Enter value for "${item.label}"`,
			placeHolder: 'Value',
			value: currentValue
		});

		if (value !== undefined) {
			treeDataProvider.setItemValue(item, value);
		}
	});

	// Register variable substitution command
	const replaceCommand = vscode.commands.registerCommand('extension.debugconfigs.replace', (args: { path: string }) => {
		if (!args || !args.path) {
			throw new Error('Path argument is required for debugconfigs.replace command');
		}

		const pathParts = args.path.split('.');
		let currentItems = treeDataProvider.getRootItems();
		let currentItem: DebugConfigTreeItem | undefined;

		// Navigate through the tree using the dotted path
		for (const part of pathParts) {
			currentItem = currentItems.find((item: DebugConfigTreeItem) => {
				const itemLabel = typeof item.label === 'string' ? item.label : item.label?.label || '';
				return itemLabel.toLowerCase() === part.toLowerCase();
			});

			if (!currentItem) {
				throw new Error(`Path "${args.path}" not found: "${part}" does not exist`);
			}

			// If this is not the last part, we need to go deeper
			if (part !== pathParts[pathParts.length - 1]) {
				if (!currentItem.children || currentItem.children.length === 0) {
					throw new Error(`Path "${args.path}" not found: "${part}" has no children`);
				}
				currentItems = currentItem.children;
			}
		}

		// At this point, currentItem should be our target
		if (!currentItem) {
			throw new Error(`Path "${args.path}" not found`);
		}

		// Check if this is a leaf node (has a value)
		if (currentItem.value === undefined) {
			throw new Error(`Path "${args.path}" does not point to a leaf node with a value`);
		}

		return currentItem.value;
	});

	// Register export tree command
	const exportTreeCommand = vscode.commands.registerCommand('debugConfigs.exportTree', async () => {
		// Show save dialog to let user choose where to save the JSON file
		const saveUri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file('debug-config-tree.json'),
			filters: {
				'JSON Files': ['json'],
				'All Files': ['*']
			},
			title: 'Export Tree as JSON'
		});

		if (!saveUri) {
			return; // User cancelled the dialog
		}

		try {
			// Export the tree using the existing method
			await treeDataProvider.exportTreeStateToFile(saveUri.fsPath);

			// Show success message with option to open the file
			const result = await vscode.window.showInformationMessage(
				`Tree exported successfully to ${saveUri.fsPath}`,
				'Open File'
			);

			if (result === 'Open File') {
				// Open the exported file in the editor
				const document = await vscode.workspace.openTextDocument(saveUri);
				await vscode.window.showTextDocument(document);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to export tree: ${error}`);
		}
	});

	// Register import tree command
	const importTreeCommand = vscode.commands.registerCommand('debugConfigs.importTree', async () => {
		// Warn user that existing tree will be cleared
		const confirmResult = await vscode.window.showWarningMessage(
			'Importing will replace the current tree. All existing data will be lost.',
			{ modal: true },
			'Continue', 'Cancel'
		);

		if (confirmResult !== 'Continue') {
			return; // User cancelled
		}

		// Show open dialog to let user choose the JSON file to import
		const openUri = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: {
				'JSON Files': ['json'],
				'All Files': ['*']
			},
			title: 'Import Tree from JSON'
		});

		if (!openUri || openUri.length === 0) {
			return; // User cancelled the dialog
		}

		try {
			// Import the tree using the new method
			await treeDataProvider.importTreeStateFromFile(openUri[0].fsPath);

			// Show success message
			vscode.window.showInformationMessage(
				`Tree imported successfully from ${openUri[0].fsPath}`
			);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to import tree: ${error}`);
		}
	});

	// Register generate commands JSON command
	const generateCommandsCommand = vscode.commands.registerCommand('debugConfigs.generateCommands', async () => {
		try {
			// Generate the commands JSON
			const commands = treeDataProvider.generateCommandsJson();

			if (commands.length === 0) {
				vscode.window.showInformationMessage('No leaf nodes found in the tree. Add some values to generate commands.');
				return;
			}

			// Create JSONC content with comments
			let jsonContent = '[\n';
			for (let i = 0; i < commands.length; i++) {
				const command = commands[i];
				jsonContent += `  // use this: \${input:${command.id}}\n`;
				jsonContent += `  ${JSON.stringify(command, null, 2).replace(/\n/g, '\n  ')}`;
				if (i < commands.length - 1) {
					jsonContent += ',';
				}
				jsonContent += '\n';
			}
			jsonContent += ']';

			const document = await vscode.workspace.openTextDocument({
				content: jsonContent,
				language: 'jsonc'
			});

			// Show the document in the editor
			await vscode.window.showTextDocument(document);

			// Show success message
			vscode.window.showInformationMessage(`Generated ${commands.length} command(s) from tree leaf nodes.`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to generate commands: ${error}`);
		}
	});

	// Register add to launch config command
	const addToLaunchConfigCommand = vscode.commands.registerCommand('debugConfigs.addToLaunchConfig', async () => {
		try {
			// Generate the commands JSON
			const commands = treeDataProvider.generateCommandsJson();
			console.log('commands', commands);
			if (commands.length === 0) {
				vscode.window.showInformationMessage('No leaf nodes found in the tree. Add some values to generate commands.');
				return;
			}

			// Find launch.json and tasks.json files in the workspace
			const launchFiles = await vscode.workspace.findFiles('**/.vscode/launch.json', '**/node_modules/**');
			const taskFiles = await vscode.workspace.findFiles('**/.vscode/tasks.json', '**/node_modules/**');

			const allFiles = [
				...launchFiles.map(file => ({ uri: file, type: 'launch.json' })),
				...taskFiles.map(file => ({ uri: file, type: 'tasks.json' }))
			];

			if (allFiles.length === 0) {
				vscode.window.showErrorMessage('No launch.json or tasks.json files found in the workspace.');
				return;
			}

			// Let user select which file to modify
			let selectedFile: vscode.Uri;
			if (allFiles.length === 1) {
				selectedFile = allFiles[0].uri;
			} else {
				const fileItems = allFiles.map(file => ({
					label: `${vscode.workspace.asRelativePath(file.uri)} (${file.type})`,
					uri: file.uri
				}));

				const selected = await vscode.window.showQuickPick(fileItems, {
					placeHolder: 'Select configuration file to modify'
				});

				if (!selected) {
					return; // User cancelled
				}
				selectedFile = selected.uri;
			}

			// Read and parse the configuration file
			const document = await vscode.workspace.openTextDocument(selectedFile);
			const content = document.getText();

			let config: any;
			try {
				// Parse JSONC while preserving structure
				config = jsonc.parse(content);
			} catch (parseError) {
				vscode.window.showErrorMessage(`Failed to parse configuration file: ${parseError}`);
				return;
			}

			// Get existing input IDs to avoid duplicates
			const existingIds = new Set((config.inputs || []).map((input: any) => input.id));

			// Filter out commands that already exist
			const newCommands = commands.filter(command => !existingIds.has(command.id));

			if (newCommands.length === 0) {
				vscode.window.showInformationMessage('All input commands already exist in the configuration file.');
				return;
			}

			// Use jsonc-parser to make edits while preserving comments
			let updatedContent = content;
			const edits: jsonc.Edit[] = [];

			if (config.inputs) {
				// Inputs array exists - add new commands to it
				for (const command of newCommands) {
					edits.push(...jsonc.modify(updatedContent, ['inputs', -1], command, {
						formattingOptions: {
							insertSpaces: true,
							tabSize: 2
						}
					}));
				}
			} else {
				// No inputs array - create one
				edits.push(...jsonc.modify(updatedContent, ['inputs'], newCommands, {
					formattingOptions: {
						insertSpaces: true,
						tabSize: 2
					}
				}));
			}

			// Apply all edits
			updatedContent = jsonc.applyEdits(updatedContent, edits);

			// Add comments for new inputs manually (jsonc-parser doesn't handle comments in modifications)
			for (const command of newCommands) {
				const commandRegex = new RegExp(`(\\s*)(\\{[^}]*"id"\\s*:\\s*"${command.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\})`, 'g');
				updatedContent = updatedContent.replace(commandRegex, `$1// use this: \${input:${command.id}}\n$1$2`);
			}

			const edit = new vscode.WorkspaceEdit();
			edit.replace(selectedFile, new vscode.Range(0, 0, document.lineCount, 0), updatedContent);

			await vscode.workspace.applyEdit(edit);

			// Show success message
			vscode.window.showInformationMessage(
				`Added ${newCommands.length} input command(s). Remember to save.`
			);

		} catch (error) {
			vscode.window.showErrorMessage(`Failed to add commands to configuration file: ${error}`);
		}
	});

	context.subscriptions.push(
		refreshCommand,
		addRootItemCommand,
		clearTreeCommand,
		addChildCommand,
		removeItemCommand,
		setValueCommand,
		replaceCommand,
		exportTreeCommand,
		importTreeCommand,
		generateCommandsCommand,
		addToLaunchConfigCommand
	);
}

export function deactivate() { }