/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Disposable } from 'vscode';
import * as sqlops from 'sqlops';
import * as azureSql from 'azure-arm-sql';
import * as azureResource from 'azure-arm-resource';
import { TokenCredentials } from 'ms-rest';

import { AzureAccountProvider } from './account-provider/azureAccountProvider';
import { AzureAccountSecurityTokenCollection } from './account-provider/interfaces';

export class FireWallProvider implements Disposable {
	constructor(private _provider: AzureAccountProvider) {
		sqlops.resources.registerResourceProvider(
			{
				displayName: 'Azure SQL Resource Provider', // TODO Localize
				id: 'Microsoft.Azure.SQL.ResourceProvider',
				settings: {}
			},
			{
				handleFirewallRule: this.handleFirewallRule,
				createFirewallRule: this.createFirewallRule
			}
		);
	}

	private createFirewallRule(account: sqlops.Account, firewallruleInfo: sqlops.FirewallRuleInfo): Thenable<sqlops.CreateFirewallRuleResponse> {
	}

	private handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<sqlops.HandleFirewallRuleResponse> {
	}

	public dispose() {
	}
}
