/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, ConfirmResult, ITextEditorModel } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import URI from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import * as sqlops from 'sqlops';
import { JSONVisitor, visit, parseTree, getNodeValue } from 'vs/base/common/json';

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
import { ITextModel, IIdentifiedSingleEditOperation, ICursorStateComputer, ITextBufferFactory, ITextModelCreationOptions } from 'vs/editor/common/model';
import { Selection } from 'vs/editor/common/core/selection';
import { TextModel } from 'vs/editor/common/model/textModel';
import { assign } from 'vs/base/common/objects';
import { IRange, Range } from 'vs/editor/common/core/range';
import { Position, IPosition } from 'vs/editor/common/core/position';
import { LanguageIdentifier } from 'vs/editor/common/modes';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { IModeService } from 'vs/editor/common/services/modeService';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;

interface IUpdateObject {
	pushEditOperations(editOperations: IIdentifiedSingleEditOperation[]): void;
	applyEdits(operations: IIdentifiedSingleEditOperation[]): void;
}
/*
export class NoteBookCellInput extends EditorInput {
	public static ID = 'NoteBookCell';

	constructor(private model: NoteBookCellEditorModel) {
		super();
	}

	getTypeId(): string {
		return NoteBookCellInput.ID;
	}

	resolve(): TPromise<NoteBookCellEditorModel> {
		return TPromise.as(this.model);
	}
}

export class NoteBookCellEditorModel extends EditorModel implements ITextEditorModel {

	constructor(private textModel: ITextModel) {
		super();
	}

	get textEditorModel(): ITextModel {
		return this.textModel;
	}
}
*/
/**
 * Repesents the model for
 */
export class NoteBookCellModel extends TextModel {
	constructor(private updateObj: IUpdateObject, source: string | ITextBufferFactory, creationOptions: ITextModelCreationOptions, languageIdentifier: LanguageIdentifier, associatedResource?: URI) {
		super(source, creationOptions, languageIdentifier, associatedResource);
	}

	/**
	 * Edit the model without adding the edits to the undo stack.
	 * This can have dire consequences on the undo stack! See @pushEditOperations for the preferred way.
	 * @param operations The edit operations.
	 * @return The inverse edit operations, that, when applied, will bring the model back to the previous state.
	 */
	applyEdits(operations: IIdentifiedSingleEditOperation[]): IIdentifiedSingleEditOperation[] {
		this.updateObj.applyEdits(operations);
		return super.applyEdits(operations);
	}

	/**
	 * Push edit operations, basically editing the model. This is the preferred way
	 * of editing the model. The edit operations will land on the undo stack.
	 * @param beforeCursorState The cursor state before the edit operaions. This cursor state will be returned when `undo` or `redo` are invoked.
	 * @param editOperations The edit operations.
	 * @param cursorStateComputer A callback that can compute the resulting cursors state after the edit operations have been executed.
	 * @return The cursor state returned by the `cursorStateComputer`.
	 */
	pushEditOperations(beforeCursorState: Selection[], editOperations: IIdentifiedSingleEditOperation[], cursorStateComputer: ICursorStateComputer): Selection[] {
		this.updateObj.pushEditOperations(editOperations);
		return super.pushEditOperations(beforeCursorState, editOperations, cursorStateComputer);
	}
}

export class NotebookEditorModel extends EditorModel {
	private inputs: NoteBookCellModel[];

	constructor(
		private textEditorModel: TextFileEditorModel,
		@IModeService private modeService: IModeService
	) {
		super();
	}

	private parse() {
		this.inputs = [];
		let model = this.textEditorModel.textEditorModel;
		let tree = parseTree(model.getValue());
		tree.children.find(v => v.children[0].value === 'cells').children[1].children.map(c => {
			let sourceNode = c.children.find(v => v.children[0].value === 'source');
			let languageNode = c.children.find(v => v.children[0].value === 'metadata').children[1].children.find(v => v.children[0].value === 'language');
			let offsetPosition = model.getPositionAt(sourceNode.children[1].offset);
			// account for quote
			let shiftoffset = sourceNode.children[1].offset + 1;
			let textModel = new NoteBookCellModel({
				applyEdits: (operations: IIdentifiedSingleEditOperation[]) => {
					this.textEditorModel.textEditorModel.applyEdits(operations.map(v => {
						let startoffset = textModel.getOffsetAt(v.range.getStartPosition());
						let endOffset = textModel.getOffsetAt(v.range.getEndPosition());
						let startPosition = model.getPositionAt(shiftoffset + startoffset);
						let endPosition = model.getPositionAt(shiftoffset + endOffset);
						v.range = Range.fromPositions(startPosition, endPosition);
						return v;
					}));
				},
				pushEditOperations: (editOperations: IIdentifiedSingleEditOperation[]) => {
					this.textEditorModel.textEditorModel.pushEditOperations([], editOperations.map(v => {
						let startoffset = textModel.getOffsetAt(v.range.getStartPosition());
						let endOffset = textModel.getOffsetAt(v.range.getEndPosition());
						let startPosition = model.getPositionAt(shiftoffset + startoffset);
						let endPosition = model.getPositionAt(shiftoffset + endOffset);
						v.range = Range.fromPositions(startPosition, endPosition);
						return v;
					}), () => []);
				}
			}, sourceNode.children[1].value, TextModel.DEFAULT_CREATION_OPTIONS, this.modeService.getLanguageIdentifier(languageNode.children[1].value));
			this.inputs.push(textModel);
		});
	}

	save(options: ISaveOptions): TPromise<void> {
		return this.textEditorModel.save(options);
	}

	isDirty(): boolean {
		return this.textEditorModel.isDirty();
	}

	get textEditorInputs(): NoteBookCellModel[] {
		if (!this.inputs) {
			this.parse();
		}
		return this.inputs;
	}
}

export class NotebookInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.notebookInput';

	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;

	private model: NotebookEditorModel;
	private resource: URI;

	constructor(
		resource: URI,
		@ITextModelService private textModelService: ITextModelService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super();
		this.resource = resource;
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
			return this.textModelService.createModelReference(this.resource).then(model => {
				return model.object.load();
			}).then(model => {
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
