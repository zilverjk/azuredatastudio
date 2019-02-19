/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./newCell';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, SimpleChange, OnChanges } from '@angular/core';
import { CellView } from 'sql/parts/notebook/cellViews/interfaces';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { localize } from 'vs/nls';
import { CellType } from 'sql/parts/notebook/models/contracts';
import { WorkbenchThemeService } from 'vs/workbench/services/themes/electron-browser/workbenchThemeService';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';


export const NEWCELL_SELECTOR: string = 'new-cell-component';

@Component({
	selector: NEWCELL_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./newCell.component.html'))
})

export class NewCellComponent extends CellView implements OnInit, OnChanges {
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	private _model: NotebookModel;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
		//@Inject(WorkbenchThemeService) private _themeService: WorkbenchThemeService
	) {
		super();
	}

	ngOnInit() {
		if (this.cellModel) {
			this._register(this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			}));
		}
		// this._register(this._themeService.onDidColorThemeChange(this.updateTheme, this));
		// this.updateTheme(this._themeService.getColorTheme());
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
	}

	get model(): NotebookModel {
		return this._model;
	}

	get addCode(): string {
		return localize('addCode', '{ } Add Code');
	}

	get addText(): string {
		return localize('addText', 'Add Text');
	}

	public addCell(cellType: string, event?: Event): void {
		if (event) {
			event.stopPropagation();
		}
		let type: CellType = <CellType>cellType;
		if (!type) {
			type = 'code';
		}
		this._model.addCell(<CellType>cellType);
	}

	public changeBackground(mouseEnter: boolean, event?: Event): void {
		if (event) {
			let element = event.srcElement as HTMLElement;
			if (mouseEnter) {
				element.style.background = 'linear-gradient(180deg, #00B0EC 0%, #0078D4 100%)';
				element.style.backgroundColor = null;
				element.style.color = 'white';
			} else {
				element.style.background = null;
				element.style.backgroundColor = 'white';
				element.style.color = 'black';
			}
		}
	}

	private updateTheme(theme: IColorTheme): void {
		// let outputElement = <HTMLElement>this.output.nativeElement;
		// outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public layout() {
	}
}
