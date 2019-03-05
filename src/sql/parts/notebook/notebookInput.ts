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
import { parseTree } from 'vs/base/common/json';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;


export class NotebookEditorModel extends EditorModel {
	private dirty: boolean;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	private _providerId: string;
	private _providers: string[];
	private _connectionProfileId: string;
	private _standardKernels: IStandardKernelWithProvider[];
	private _defaultKernel: azdata.nb.IKernelSpec;
	constructor(public readonly notebookUri: URI,
		private _isTrusted: boolean = false,
		private textEditorModel: TextFileEditorModel,
		@INotebookService private notebookService: INotebookService
	) {
		super();
		this._standardKernels = [];
		this._register(this.notebookService.onNotebookEditorAdd(notebook => {
			if (notebook.id === this.notebookUri.toString()) {
				// Hook to content change events
				this._register(notebook.model.contentChanged(e => this.updateModel()));
				this._register(notebook.model.kernelChanged(e => this.updateModel()));
			}
		}));
	}

	public get contentString(): string {
		let model = this.textEditorModel.textEditorModel;
		return model.getValue();
	}


	save(options: ISaveOptions): TPromise<void> {
		options.force = false;
		this.updateModel();
		return this.textEditorModel.save(options);
	}

	isDirty(): boolean {
		return this.textEditorModel.isDirty();
	}

	private updateModel(): void {
		let notebookModel = this.getNotebookModel();
		if (notebookModel && this.textEditorModel && this.textEditorModel.textEditorModel) {
			let content = JSON.stringify(notebookModel.toJSON(), undefined, '    ');
			this.textEditorModel.textEditorModel.setValue(content);
		}
	}

	isModelCreated(): boolean {
		return this.getNotebookModel() !== undefined;
	}

	private getNotebookModel(): INotebookModel {
		let editor = this.notebookService.listNotebookEditors().find(n => n.id === this.notebookUri.toString());
		if (editor) {
			return editor.model;
		}
		return undefined;
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

	public getName(): string {
		if (!this._title) {
			this._title = resources.basenameOrAuthority(this._model.notebookUri);
		}
		return this._title;
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
		if(this._model && this._model.isModelCreated()){
			return TPromise.as(this._model);
		}else{
		const textEditorModelReference = await this.textModelService.createModelReference(this.resource);
		const textEditorModel = await textEditorModelReference.object.load();
		this._model = this.instantiationService.createInstance(NotebookEditorModel, this.resource, false, textEditorModel);
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
