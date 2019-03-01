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
import { URI } from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import * as azdata from 'azdata';

import { IStandardKernelWithProvider } from 'sql/parts/notebook/notebookUtils';
import { INotebookService, INotebookEditor } from 'sql/workbench/services/notebook/common/notebookService';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import Severity from 'vs/base/common/severity';
import { FileEditorInput } from 'vs/workbench/parts/files/common/editors/fileEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextFileService, ISaveOptions } from 'vs/workbench/services/textfile/common/textfiles';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IHashService } from 'vs/workbench/services/hash/common/hashService';
import { INotebookModel, ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { ITextModel, IIdentifiedSingleEditOperation, ICursorStateComputer, ITextBufferFactory, ITextModelCreationOptions } from 'vs/editor/common/model';
import { IRange, Range } from 'vs/editor/common/core/range';
import { CellModel } from 'sql/parts/notebook/models/cell';
import { EditOperation } from 'vs/editor/common/core/editOperation';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;


export class NotebookEditorModel extends EditorModel {
	private inputs: CellModel[];
	private dirty: boolean;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	private _providerId: string;
	private _standardKernels: IStandardKernelWithProvider[];
	private _defaultKernel: azdata.nb.IKernelSpec;
	constructor(public readonly notebookUri: URI,
		private readonly handle: number,
		private _isTrusted: boolean = false,
		private textEditorModel: TextFileEditorModel,
		provider?: string,
		private _providers?: string[],
		private _connectionProfileId?: string,
	) {
		super();
		this._providerId = provider;
		this._standardKernels = [];

	}

	private parse() {
		this.inputs = [];
		if(!this.textEditorModel || !this.textEditorModel.textEditorModel)
		{
			return;
		}
		let model = this.textEditorModel.textEditorModel;
		let tree = parseTree(model.getValue());
		if(!tree || !tree.children)
		{
			return;
		}
		let cellNode = tree.children.find(v => v.children[0].value === 'cells');
		if(!cellNode)
		{
			return;
		}
		cellNode.children[1].children.map(c => {
			let sourceNode = c.children.find(v => v.children[0].value === 'source');
			let cellTypeNode = c.children.find(v => v.children[0].value === 'cell_type');
			let offSetNumber: number = sourceNode.children[1]? sourceNode.children[1].offset : 0;
			let sourceLength: number = sourceNode.children[1]? sourceNode.children[1].length : 0;
			let startPosition = model.getPositionAt(offSetNumber);
			let endPosition = model.getPositionAt(offSetNumber + sourceLength);

			let cellModel = new CellModel(undefined, undefined, undefined, (val: string) => {
				//let insertString = '"' + val.replace(/[\n\r]/g, '\\n') + '"';
				let insertString = '"' + val + '"';
				let editOperation = EditOperation.replace(Range.fromPositions(startPosition, endPosition), insertString);
				model.applyEdits([editOperation]);
				endPosition = model.getPositionAt(sourceNode.children[1].offset + insertString.length);
			});
			cellModel.cellType = cellTypeNode.children[1].value;
			cellModel.source = sourceNode.children[1].value;
			this.inputs.push(cellModel);
		});
	}

	save(options: ISaveOptions): TPromise<void> {
		options.force = false;
		return this.textEditorModel.save(options);
	}

	isDirty(): boolean {
		return this.textEditorModel.isDirty();
	}

	get textEditorInputs(): CellModel[] {
		if ((!this.inputs || this.inputs.length === 0) && (this.textEditorModel) ) {
			this.parse();
		}
		return this.inputs;
	}
	public get providerId(): string {
		return this._providerId;
	}

	public set providerId(value: string) {
		this._providerId = value;
	}

	public get providers(): string[] {
		return this._providers;
	}

	public set providers(value: string[]) {
		this._providers = value;
	}

	public get connectionProfileId(): string {
		return this._connectionProfileId;
	}

	public get standardKernels(): IStandardKernelWithProvider[] {
		return this._standardKernels;
	}

	public set standardKernels(value: IStandardKernelWithProvider[]) {
		value.forEach(kernel => {
			this._standardKernels.push({
				connectionProviderIds: kernel.connectionProviderIds,
				name: kernel.name,
				notebookProvider: kernel.notebookProvider
			});
		});
	}

	public get defaultKernel(): azdata.nb.IKernelSpec {
		return this._defaultKernel;
	}

	public set defaultKernel(kernel: azdata.nb.IKernelSpec) {
		this._defaultKernel = kernel;
	}

	get isTrusted(): boolean {
		return this._isTrusted;
	}

	get onDidChangeDirty(): Event<void> {
		return this._onDidChangeDirty.event;
	}


}

export class NotebookInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.notebookInput';

	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;
	private readonly _layoutChanged: Emitter<void> = this._register(new Emitter<void>());

	constructor(private _title: string,
		private resource: URI,
		private _model: NotebookEditorModel,
		@ITextModelService private textModelService: ITextModelService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super();
		this.resource = resource;
	}

	public get notebookUri(): URI {
		return this._model.notebookUri;
	}

	public get providerId(): string {
		return this._model.providerId;
	}

	public get providers(): string[] {
		return this._model.providers;
	}

	public get connectionProfileId(): string {
		return this._model.connectionProfileId;
	}

	public get standardKernels(): IStandardKernelWithProvider[] {
		return this._model.standardKernels;
	}

	public get defaultKernel(): azdata.nb.IKernelSpec {
		return this._model.defaultKernel;
	}

	get layoutChanged(): Event<void> {
		return this._layoutChanged.event;
	}

	doChangeLayout(): any {
		this._layoutChanged.fire();
	}

	public getTypeId(): string {
		return NotebookInput.ID;
	}

	getResource(): URI {
		return this.resource;
	}

	async resolve(): TPromise<NotebookEditorModel> {
		if(this._model && this._model.textEditorInputs && this._model.textEditorInputs.length > 0){
			return TPromise.as(this._model);
		}else{
		const model = await this.textModelService.createModelReference(this.resource);
		const model_1 = await model.object.load();
		this._model = this.instantiationService.createInstance(NotebookEditorModel, this.resource, false, model_1, undefined, undefined, undefined);
		return this._model;
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
