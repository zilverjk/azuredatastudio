/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IAction } from 'vs/base/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { MenuItemAction, ICommandAction } from 'vs/platform/actions/common/actions';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { IDisposable, dispose, toDisposable } from 'vs/base/common/lifecycle';
import { domEvent } from 'vs/base/browser/event';
import { localize } from 'vs/nls';
import { createCSSRule, addClasses, removeClasses } from 'vs/base/browser/dom';
import { AlternativeKeyEmitter } from 'vs/platform/actions/browser/menuItemActionItem';

export interface IMenuItemActionItemOptions {
	label?: boolean;
}

export function createActionItem(action: IAction, options: IMenuItemActionItemOptions, keybindingService: IKeybindingService, notificationService: INotificationService, contextMenuService: IContextMenuService): ActionItem {
	if (action instanceof MenuItemAction) {
		return new MenuItemActionItem(action, options, keybindingService, notificationService, contextMenuService);
	}
	return undefined;
}

const ids = new IdGenerator('sql-menu-item-action-item-icon-');

export class MenuItemActionItem extends ActionItem {

	static readonly ICON_PATH_TO_CSS_RULES: Map<string /* path*/, string /* CSS rule */> = new Map<string, string>();

	private _wantsAltCommand: boolean;
	private _itemClassDispose: IDisposable;
	private readonly _altKey: AlternativeKeyEmitter;

	constructor(
		public _action: MenuItemAction,
		options: IMenuItemActionItemOptions = {},
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@INotificationService protected _notificationService: INotificationService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService
	) {
		super(undefined, _action, { icon: !!(_action.class || _action.item.iconLocation), label: options.label || (!_action.class && !_action.item.iconLocation) });
		this._altKey = AlternativeKeyEmitter.getInstance(_contextMenuService);
	}

	protected get _commandAction(): IAction {
		return this._wantsAltCommand && (<MenuItemAction>this._action).alt || this._action;
	}

	onClick(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();

		const altKey = AlternativeKeyEmitter.getInstance(this._contextMenuService);
		if (altKey.isPressed) {
			altKey.suppressAltKeyUp();
		}

		this.actionRunner.run(this._commandAction)
			.then(undefined, err => this._notificationService.error(err));
	}

	render(container: HTMLElement): void {
		super.render(container);

		this._updateItemClass(this._action.item);

		let mouseOver = false;
		const alternativeKeyEmitter = AlternativeKeyEmitter.getInstance(this._contextMenuService);
		let alternativeKeyDown = alternativeKeyEmitter.isPressed;

		const updateAltState = () => {
			const wantsAltCommand = mouseOver && alternativeKeyDown;
			if (wantsAltCommand !== this._wantsAltCommand) {
				this._wantsAltCommand = wantsAltCommand;
				this._updateLabel();
				this._updateTooltip();
				this._updateClass();
			}
		};

		if (this._action.alt) {
			this._register(this._altKey.event(value => {
				alternativeKeyDown = value;
				updateAltState();
			}));
		}

		this._register(domEvent(container, 'mouseleave')(_ => {
			mouseOver = false;
			updateAltState();
		}));

		this._register(domEvent(container, 'mouseenter')(e => {
			mouseOver = true;
			updateAltState();
		}));
	}

	_updateLabel(): void {
		if (this.options.label) {
			this.label.textContent = this._commandAction.label;
		}
	}

	_updateTooltip(): void {
		const element = this.label;
		const keybinding = this._keybindingService.lookupKeybinding(this._commandAction.id);
		const keybindingLabel = keybinding && keybinding.getLabel();

		element.title = keybindingLabel
			? localize('titleAndKb', "{0} ({1})", this._commandAction.label, keybindingLabel)
			: this._commandAction.label;
	}

	_updateClass(): void {
		if (this.options.icon) {
			if (this._commandAction !== this._action) {
				this._updateItemClass(this._action.alt.item);
			} else if ((<MenuItemAction>this._action).alt) {
				this._updateItemClass(this._action.item);
			}
		}
	}

	_updateItemClass(item: ICommandAction): void {
		dispose(this._itemClassDispose);
		this._itemClassDispose = undefined;

		if (item.iconLocation) {
			let iconClass: string;

			const iconPathMapKey = item.iconLocation.dark.toString();

			if (MenuItemActionItem.ICON_PATH_TO_CSS_RULES.has(iconPathMapKey)) {
				iconClass = MenuItemActionItem.ICON_PATH_TO_CSS_RULES.get(iconPathMapKey);
			} else {
				iconClass = ids.nextId();
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${(item.iconLocation.light || item.iconLocation.dark).toString()}")`);
				createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${item.iconLocation.dark.toString()}")`);
				MenuItemActionItem.ICON_PATH_TO_CSS_RULES.set(iconPathMapKey, iconClass);
			}

			addClasses(this.label, 'icon', iconClass);
			this._itemClassDispose = toDisposable(() => removeClasses(this.label, 'icon', iconClass));
		}
	}

	dispose(): void {
		if (this._itemClassDispose) {
			dispose(this._itemClassDispose);
			this._itemClassDispose = undefined;
		}

		super.dispose();
	}
}
