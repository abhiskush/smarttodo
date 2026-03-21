import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Todo {
	id: string;
	title: string;
	completed: boolean;
	priority: 'Low' | 'Medium' | 'High' | 'Urgent' | 'Critical';
}

export class TodoWebviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'smarttodo.todoView';
	private webview?: vscode.Webview;
	private todos: Todo[] = [];
	
	constructor(private context: vscode.ExtensionContext) {}

	public async resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): Promise<void> {
		const webviewUri = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview');
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [webviewUri]
		};

		this.webview = webviewView.webview;
		await this.loadTodos();
		this.webview.html = this.getHtmlContent();

		this.webview.onDidReceiveMessage(async (message) => {
			await this.handleWebviewMessage(message);
		});
	}

	private async handleWebviewMessage(message: any): Promise<void> {
		switch (message.command) {
			case 'addTodo':
				this.addTodo(message.title, message.priority);
				break;
			case 'editTodo':
				this.editTodo(message.id, message.title, message.priority);
				break;
			case 'deleteTodo':
				this.deleteTodo(message.id);
				break;
			case 'toggleTodo':
				this.toggleTodo(message.id);
				break;
			case 'getTodos':
				this.sendTodosToWebview();
				break;
		}
	}

	private addTodo(title: string, priority: Todo['priority']): void {
		if (this.todos.length >= 500) {
			vscode.window.showErrorMessage('Maximum 500 todos allowed.');
			return;
		}

		const titleTrimmed = title.trim();

		if (!titleTrimmed) {
			vscode.window.showErrorMessage('Todo title cannot be empty.');
			return;
		}

		this.todos.push({
			id: Date.now().toString(),
			title: titleTrimmed,
			completed: false,
			priority
		});

		this.updateTodosAndSync();
	}

	private editTodo(id: string, title: string, priority: Todo['priority']): void {
		const todo = this.todos.find(t => t.id === id);
		if (todo) {
			todo.title = title.trim();
			todo.priority = priority;
			this.updateTodosAndSync();
		}
	}

	private deleteTodo(id: string): void {
		this.todos = this.todos.filter(t => t.id !== id);
		this.updateTodosAndSync();
	}

	private toggleTodo(id: string): void {
		const todo = this.todos.find(t => t.id === id);
		if (todo) {
			todo.completed = !todo.completed;
			this.updateTodosAndSync();
		}
	}

	private updateTodosAndSync(): void {
		this.saveTodos();
		this.sendTodosToWebview();
	}

	private async loadTodos(): Promise<void> {
		const stored = this.context.globalState.get<string>('smarttodo.todos', '[]');
		try {
			this.todos = JSON.parse(stored);
		} catch {
			this.todos = [];
		}
	}

	private saveTodos(): void {
		this.context.globalState.update('smarttodo.todos', JSON.stringify(this.todos));
	}

	private sendTodosToWebview(): void {
		if (this.webview) {
			this.webview.postMessage({
				command: 'updateTodos',
				todos: this.todos
			});
		}
	}

	private getHtmlContent(): string {
		const htmlPath = path.join(this.context.extensionPath, 'src', 'webview', 'index.html');
		let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

		if (!this.webview) {
			return htmlContent;
		}

		// Convert local resource paths to webview URIs
		const webviewRoot = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview');
		const styleUri = this.webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'style.css'));
		const scriptUri = this.webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'script.js'));

		// Update CSP to allow webview resources
		const cspSource = this.webview.cspSource;

		htmlContent = htmlContent
			.replace("style-src 'self'", `style-src ${cspSource}`)
			.replace("script-src 'self'", `script-src ${cspSource}`)
			.replace('{{styleUri}}', styleUri.toString())
			.replace('{{scriptUri}}', scriptUri.toString());

		return htmlContent;
	}
}
