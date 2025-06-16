
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tree item class that extends vscode.TreeItem
 * Follows constraint: items can either have a string value (leaf nodes) OR have children (parent nodes), never both
 * If value is defined, it's a leaf node. If value is undefined, it can have children.
 */
export class DebugConfigTreeItem extends vscode.TreeItem {
    private _children?: DebugConfigTreeItem[];

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        private _value?: string,
        children?: DebugConfigTreeItem[]
    ) {
        super(label, collapsibleState);

        this._children = children;
        this.updateDisplayProperties();
    }

    /**
     * Get the value of this tree item
     */
    get value(): string | undefined {
        return this._value;
    }

    /**
     * Set the value of this tree item
     * When a value is set, any existing children are removed (constraint enforcement)
     * @param value A primitive value (string, number, boolean, bigint) that can be stringified
     */
    setValue(value: string | number | boolean | bigint): void {
        // Type check to ensure only primitive types are accepted
        const valueType = typeof value;
        if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean' && valueType !== 'bigint') {
            throw new Error(`Invalid value type: ${valueType}. Only primitive types (string, number, boolean, bigint) are allowed.`);
        }

        this._value = String(value);

        // Enforce constraint: if we have a value, we cannot have children
        if (this._children) {
            this._children = undefined;
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        this.updateDisplayProperties();
    }

    /**
     * Get the children of this tree item
     */
    get children(): DebugConfigTreeItem[] | undefined {
        return this._children;
    }

    /**
     * Add a child to this tree item (internal method)
     * This is called by the tree data provider
     */
    addChild(child: DebugConfigTreeItem): void {
        if (!this._children) {
            this._children = [];
        }
        this._children.push(child);

        // Enforce constraint: if we have children, we cannot have a value
        this.resetValue();

        // Update collapsible state to show this item can be expanded
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }

    /**
     * Remove a child from this tree item
     * @param child The child item to remove
     * @returns true if the child was found and removed, false otherwise
     */
    removeChild(child: DebugConfigTreeItem): boolean {
        if (!this._children || this._children.length === 0) {
            return false;
        }

        const index = this._children.indexOf(child);
        if (index === -1) {
            return false;
        }

        this._children.splice(index, 1);

        // If no children remain, update the collapsible state
        if (this._children.length === 0) {
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
            this._children = undefined;
        }

        // Update display properties
        this.updateDisplayProperties();
        return true;
    }



    /**
     * Reset the value to undefined (used when converting to parent node)
     * This is called internally when adding children
     */
    private resetValue(): void {
        this._value = undefined;
        this.updateDisplayProperties();
    }

    /**
     * Update display properties based on current state
     */
    private updateDisplayProperties(): void {
        // Set contextValue based on whether this is a leaf or parent node
        this.contextValue = this._value !== undefined ? 'leaf' : 'parent';

        // For leaf nodes, show the value in the tree display
        if (this._value !== undefined) {
            this.description = this._value;
            this.tooltip = `${this.label}: ${this._value}`;
        } else {
            // Clear description and tooltip for parent nodes
            this.description = undefined;
            this.tooltip = undefined;
        }
    }
}

/**
 * Tree data provider implementation for debug configurations
 * Implements the minimal required methods for vscode.TreeDataProvider
 */
export class DebugConfigTreeDataProvider implements vscode.TreeDataProvider<DebugConfigTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DebugConfigTreeItem | undefined | null | void> = new vscode.EventEmitter<DebugConfigTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DebugConfigTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private static readonly TREE_STATE_KEY = 'debugConfigTreeState';

    constructor(
        private rootItems: DebugConfigTreeItem[] = [],
        private workspaceState?: vscode.Memento
    ) { }

    /**
     * Required method: Returns the UI representation of the element
     */
    getTreeItem(element: DebugConfigTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Required method: Returns children for the given element or root items if no element provided
     */
    getChildren(element?: DebugConfigTreeItem): Thenable<DebugConfigTreeItem[] | null> {
        try {
            if (!element) {
                // Return root level items
                return Promise.resolve(this.rootItems.length > 0 ? this.rootItems : null);
            } else {
                // Return children of the given element, or null if no children
                return Promise.resolve(element.children && element.children.length > 0 ? element.children : null);
            }
        } catch (error) {
            console.error('Error getting tree children:', error);
            return Promise.resolve(null);
        }
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Update the root items and refresh the tree
     */
    updateData(newData: DebugConfigTreeItem[]): void {
        this.rootItems = newData;
        this.refresh();
        this.saveTreeState();
    }

    /**
     * Add a child to a specific parent node in the tree
     * When children are added, the parent's value is automatically set to undefined (constraint enforcement)
     */
    addChild(parent: DebugConfigTreeItem, child: DebugConfigTreeItem): void {
        parent.addChild(child);

        // Refresh the tree to show the changes
        this.refresh();
        this.saveTreeState();
    }

    /**
     * Remove a child from a specific parent node in the tree
     * @param parent The parent node to remove the child from
     * @param child The child node to remove
     * @returns true if the child was found and removed, false otherwise
     */
    removeChild(parent: DebugConfigTreeItem, child: DebugConfigTreeItem): boolean {
        const removed = parent.removeChild(child);

        if (removed) {
            // Refresh the tree to show the changes
            this.refresh();
            this.saveTreeState();
        }

        return removed;
    }

    /**
     * Remove a root item from the tree
     * @param item The root item to remove
     * @returns true if the item was found and removed, false otherwise
     */
    removeRootItem(item: DebugConfigTreeItem): boolean {
        const index = this.rootItems.indexOf(item);
        if (index === -1) {
            return false;
        }

        this.rootItems.splice(index, 1);

        // Refresh the tree to show the changes
        this.refresh();
        this.saveTreeState();

        return true;
    }

    /**
     * Clear the entire tree and make it empty
     */
    clear(): void {
        this.rootItems = [];
        this.refresh();
        this.saveTreeState();
    }

    /**
     * Save the current tree state to workspace state as JSON
     */
    async saveTreeState(): Promise<void> {
        if (!this.workspaceState) {
            console.warn('Workspace state not available for saving tree state');
            return;
        }

        try {
            const treeStateJson = this.serializeTreeItems(this.rootItems);
            await this.workspaceState.update(DebugConfigTreeDataProvider.TREE_STATE_KEY, treeStateJson);
        } catch (error) {
            console.error('Failed to save tree state:', error);
        }
    }

    /**
     * Load the tree state from workspace state JSON
     */
    async loadTreeState(): Promise<void> {
        if (!this.workspaceState) {
            console.warn('Workspace state not available for loading tree state');
            return;
        }

        try {
            const treeStateJson = this.workspaceState.get<any[]>(DebugConfigTreeDataProvider.TREE_STATE_KEY);
            if (treeStateJson) {
                this.rootItems = this.deserializeTreeItems(treeStateJson);
                this.refresh();
            }
        } catch (error) {
            console.error('Failed to load tree state:', error);
        }
    }

    /**
     * Serialize tree items to JSON-compatible format
     */
    private serializeTreeItems(items: DebugConfigTreeItem[]): any[] {
        return items.map(item => ({
            label: item.label,
            value: item.value,
            collapsibleState: item.collapsibleState,
            children: item.children ? this.serializeTreeItems(item.children) : undefined
        }));
    }

    /**
     * Deserialize JSON data back to tree items
     */
    private deserializeTreeItems(data: any[]): DebugConfigTreeItem[] {
        return data.map(itemData => {
            const children = itemData.children ? this.deserializeTreeItems(itemData.children) : undefined;
            return new DebugConfigTreeItem(
                itemData.label,
                itemData.collapsibleState,
                itemData.value,
                children
            );
        });
    }

    /**
     * Export the current tree state to a file as JSON
     * @param filePath The absolute path where the JSON file should be written
     */
    async exportTreeStateToFile(filePath: string): Promise<void> {
        try {
            // Ensure the directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Serialize the current tree state
            const treeStateJson = this.serializeTreeItems(this.rootItems);

            // Create the export data with metadata
            const exportData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                treeState: treeStateJson
            };

            // Write to file with pretty formatting
            const jsonString = JSON.stringify(exportData, null, 2);
            fs.writeFileSync(filePath, jsonString, 'utf8');

        } catch (error) {
            console.error('Failed to export tree state to file:', error);
            throw error;
        }
    }
}
