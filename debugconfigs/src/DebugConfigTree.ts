
import * as vscode from 'vscode';

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
        this._value = undefined;

        // Update collapsible state to show this item can be expanded
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

        // Update display properties
        this.updateDisplayProperties();
    }



    /**
     * Reset the value to undefined (used when converting to parent node)
     * This is called by the tree data provider when adding children
     */
    resetValue(): void {
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

    constructor(private rootItems: DebugConfigTreeItem[] = []) { }

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
        this.rootItems = newData || [];
        this.refresh();
    }

    /**
     * Add a child to a specific parent node in the tree
     * When children are added, the parent's value is automatically set to undefined (constraint enforcement)
     */
    addChild(parent: DebugConfigTreeItem, child: DebugConfigTreeItem): void {
        parent.addChild(child);

        // Refresh the tree to show the changes
        this.refresh();
    }

    /**
     * Clear the entire tree and make it empty
     */
    clear(): void {
        this.rootItems = [];
        this.refresh();
    }
}
