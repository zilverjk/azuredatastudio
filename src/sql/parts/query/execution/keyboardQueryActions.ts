/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';

import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TPromise } from 'vs/base/common/winjs.base';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';

import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { QueryInput } from 'sql/parts/query/common/queryInput';

export function isConnected(editor: QueryEditor, connectionManagementService: IConnectionManagementService): boolean {
	if (!editor || !editor.input) {
		return false;
	}
	return connectionManagementService.isConnected(editor.input.uri);
}

/**
 * Refresh the IntelliSense cache
 */
export class RefreshIntellisenseKeyboardAction extends Action {
	public static ID = 'refreshIntellisenseKeyboardAction';
	public static LABEL = nls.localize('refreshIntellisenseKeyboardAction', 'Refresh IntelliSense Cache');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeEditor;
		if (editor instanceof QueryInput) {
			editor.rebuildIntelliSenseCache();
		}
		return TPromise.as(null);
	}
}

/**
 * Hide the query results
 */
export class ToggleQueryResultsKeyboardAction extends Action {
	public static ID = 'toggleQueryResultsKeyboardAction';
	public static LABEL = nls.localize('toggleQueryResultsKeyboardAction', 'Toggle Query Results');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor instanceof QueryEditor) {
			editor.toggleResultsEditorVisibility();
		}
		return TPromise.as(null);
	}
}

/**
 * Action class that parses the query string in the current SQL text document.
 */
export class ParseSyntaxAction extends Action {

	public static ID = 'parseQueryAction';
	public static LABEL = nls.localize('parseSyntaxLabel', 'Parse Query');

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IEditorService private _editorService: IEditorService,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor instanceof QueryEditor) {
			if (this.isConnected(editor)) {
				let control = editor.getControl() as ICodeEditor;
				let text = control.getModel().getValueInRange(control.getSelection());
				if (text === '') {
					text = control.getValue();
				}
				this._queryManagementService.parseSyntax(editor.input.uri, text).then(result => {
					if (result && result.parseable) {
						this._notificationService.notify({
							severity: Severity.Info,
							message: nls.localize('queryActions.parseSyntaxSuccess', 'Commands completed successfully')
						});
					} else if (result && result.errors.length > 0) {
						let errorMessage = nls.localize('queryActions.parseSyntaxFailure', 'Command failed: ');
						this._notificationService.error(`${errorMessage}${result.errors[0]}`);
					}
				});
			} else {
				this._notificationService.notify({
					severity: Severity.Error,
					message: nls.localize('queryActions.notConnected', 'Please connect to a server')
				});
			}
		}

		return TPromise.as(null);
	}

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	private isConnected(editor: QueryEditor): boolean {
		if (!editor || !editor.input) {
			return false;
		}
		return this._connectionManagementService.isConnected(editor.input.uri);
	}
}
