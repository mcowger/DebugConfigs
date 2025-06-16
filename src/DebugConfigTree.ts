
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
     * Add a new root item to the tree
     * @param label The label for the new root item
     */
    addRootItem(label: string): void {
        // Validate that label doesn't contain dots
        if (label.includes('.')) {
            throw new Error(`Invalid label "${label}": Labels cannot contain dots (.) as they are used for path navigation`);
        }

        const newItem = new DebugConfigTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None
        );
        this.rootItems.push(newItem);
        this.refresh();
        this.saveTreeState();
    }

    /**
     * Add a child to a specific item in the tree
     * @param parent The parent item to add the child to
     * @param childLabel The label for the new child item
     * @param childValue Optional value for the new child item (creates leaf node if provided)
     */
    addChildToItem(parent: DebugConfigTreeItem, childLabel: string, childValue?: string): void {
        // Validate that label doesn't contain dots
        if (childLabel.includes('.')) {
            throw new Error(`Invalid label "${childLabel}": Labels cannot contain dots (.) as they are used for path navigation`);
        }

        const newChild = new DebugConfigTreeItem(
            childLabel,
            vscode.TreeItemCollapsibleState.None,
            childValue
        );
        parent.addChild(newChild);
        this.refresh();
        this.saveTreeState();
    }

    /**
     * Remove an item from the tree (works for both root items and child items)
     * @param item The item to remove
     */
    removeItem(item: DebugConfigTreeItem): void {
        // First try to remove from root items
        if (this.removeRootItem(item)) {
            return;
        }

        // If not found in root, search through all items to find the parent
        this.removeItemRecursively(this.rootItems, item);
    }

    /**
     * Set the value of a specific item
     * @param item The item to set the value for
     * @param value The value to set
     */
    setItemValue(item: DebugConfigTreeItem, value: string): void {
        item.setValue(value);
        this.refresh();
        this.saveTreeState();
    }

    /**
     * Get the root items of the tree
     * @returns Array of root items
     */
    getRootItems(): DebugConfigTreeItem[] {
        return this.rootItems;
    }

    /**
     * Recursively search for and remove an item from the tree
     * @param items The array of items to search through
     * @param itemToRemove The item to remove
     * @returns true if the item was found and removed, false otherwise
     */
    private removeItemRecursively(items: DebugConfigTreeItem[], itemToRemove: DebugConfigTreeItem): boolean {
        for (const item of items) {
            if (item.children) {
                // Check if the item to remove is a direct child
                if (item.removeChild(itemToRemove)) {
                    this.refresh();
                    this.saveTreeState();
                    return true;
                }

                // Recursively search in children
                if (this.removeItemRecursively(item.children, itemToRemove)) {
                    return true;
                }
            }
        }
        return false;
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
            // Validate that labels don't contain dots
            if (itemData.label && typeof itemData.label === 'string' && itemData.label.includes('.')) {
                throw new Error(`Invalid label "${itemData.label}": Labels cannot contain dots (.) as they are used for path navigation`);
            }

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

    /**
     * Import tree state from a JSON file and replace the current tree
     * @param filePath The absolute path to the JSON file to import
     */
    async importTreeStateFromFile(filePath: string): Promise<void> {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Read and parse the JSON file
            const jsonString = fs.readFileSync(filePath, 'utf8');
            const importData = JSON.parse(jsonString);

            // Validate the import data structure
            if (!importData || typeof importData !== 'object') {
                throw new Error('Invalid JSON format: Expected an object');
            }

            // Handle both new format (with metadata) and legacy format (direct tree state)
            let treeStateJson: any[];
            if (importData.treeState && Array.isArray(importData.treeState)) {
                // New format with metadata
                treeStateJson = importData.treeState;
            } else if (Array.isArray(importData)) {
                // Legacy format - direct tree state array
                treeStateJson = importData;
            } else {
                throw new Error('Invalid JSON format: Expected tree state data');
            }

            // Deserialize the tree items
            const newRootItems = this.deserializeTreeItems(treeStateJson);

            // Replace the current tree with the imported data
            this.rootItems = newRootItems;
            this.refresh();
            this.saveTreeState();

        } catch (error) {
            console.error('Failed to import tree state from file:', error);
            throw error;
        }
    }
}
