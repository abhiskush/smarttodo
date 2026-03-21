import * as vscode from 'vscode';
import { TodoWebviewProvider } from './webviewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('SmartTodo extension is now active');

	// Register the webview provider
	const provider = new TodoWebviewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer(
			TodoWebviewProvider.viewType,
			{
				async deserializeWebviewPanel(
					webviewPanel: vscode.WebviewPanel,
					state: any
				) {
					// Restore the webview panel
					provider.resolveWebviewView(
						webviewPanel as any,
						{} as any,
						new vscode.CancellationTokenSource().token
					);
				}
			}
		)
	);

	// Register the command to open the todo panel
	const disposable = vscode.commands.registerCommand('smarttodo.openPanel', () => {
		const column = vscode.ViewColumn.One;
		const webviewUri = vscode.Uri.joinPath(context.extensionUri, 'src', 'webview');
		const panel = vscode.window.createWebviewPanel(
			TodoWebviewProvider.viewType,
			'SmartTodo',
			column,
			{
				enableScripts: true,
				localResourceRoots: [webviewUri]
			}
		);

		// Create a temporary provider instance for this panel
		const tempProvider = new TodoWebviewProvider(context);
		tempProvider.resolveWebviewView(
			panel as any,
			{} as any,
			new vscode.CancellationTokenSource().token
		);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
