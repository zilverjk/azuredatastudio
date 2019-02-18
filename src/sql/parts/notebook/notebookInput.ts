/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, ConfirmResult } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import URI from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import * as sqlops from 'sqlops';
import { JSONVisitor, visit, parseTree } from 'vs/base/common/json';

import { IStandardKernelWithProvider } from 'sql/parts/notebook/notebookUtils';
import { INotebookService, INotebookEditor } from 'sql/workbench/services/notebook/common/notebookService';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import Severity from 'vs/base/common/severity';
import { FileEditorInput } from 'vs/workbench/parts/files/common/editors/fileEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextFileService, ISaveOptions } from 'vs/workbench/services/textfile/common/textfiles';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IHashService } from 'vs/workbench/services/hash/common/hashService';
import { IUriDisplayService } from 'vs/platform/uriDisplay/common/uriDisplay';
import { INotebookModel } from 'sql/parts/notebook/models/modelInterfaces';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { ITextModel } from 'vs/editor/common/model';
import { TextModel } from 'vs/editor/common/model/textModel';
import { assign } from 'vs/base/common/objects';
import { IRange } from 'vs/editor/common/core/range';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;

export interface JSONFile {
	range: IRange;
	key: string;
	keyRange: IRange;
	value: any;
	valueRange: IRange;
}

/**
 * Repesents the model for
 */
export class NoteBookCellModel extends TextModel {

}

export class NotebookEditorModel extends EditorModel {
	private models: ITextModel[];

	constructor(
		private textEditorModel: TextFileEditorModel
	) {
		super();
		this.parse();
	}

	private parse() {
		let model = this.textEditorModel.textEditorModel;
		let tree = parseTree(model.getValue());
	}

	save(options: ISaveOptions): TPromise<void> {
		return this.textEditorModel.save(options);
	}

	isDirty(): boolean {
		return this.textEditorModel.isDirty();
	}

	get textEditorModels(): ITextModel[] {
		if (!this.models) {
			this.parse();
		}
		return this.models;
	}
}

export class NotebookInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.notebookInput';

	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;

	private model: NotebookEditorModel;
	private fileEditorInput: FileEditorInput;
	private resource: URI;

	constructor(
		resource: URI,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super();
		this.resource = resource;
		this.fileEditorInput = this.instantiationService.createInstance(FileEditorInput, resource, undefined);
	}

	public getTypeId(): string {
		return NotebookInput.ID;
	}

	getResource(): URI {
		return this.resource;
	}

	resolve(): TPromise<NotebookEditorModel> {
		if (this.model) {
			return TPromise.as(this.model);
		} else {
			return this.fileEditorInput.resolve().then(model => {
				this.model = this.instantiationService.createInstance(NotebookEditorModel, model);
				return this.model;
			});
		}
	}

	public dispose(): void {
		this._disposeContainer();
		super.dispose();
	}

	private _disposeContainer() {
		if (!this._parentContainer) {
			return;
		}

		let parentNode = this._parentContainer.parentNode;
		if (parentNode) {
			parentNode.removeChild(this._parentContainer);
			this._parentContainer = null;
		}
	}

	set container(container: HTMLElement) {
		this._disposeContainer();
		this._parentContainer = container;
	}

	get container(): HTMLElement {
		return this._parentContainer;
	}
}
