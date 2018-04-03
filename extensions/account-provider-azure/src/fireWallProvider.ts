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

import { AzureAccountSecurityTokenCollection } from './account-provider/interfaces';
import { AzureAccountProviderService } from './account-provider/azureAccountProviderService';

const SqlAzureFirewallBlockedErrorNumber = 40615;

export class FireWallProvider implements Disposable {
	constructor(private _provider: AzureAccountProviderService) {
		sqlops.resources.registerResourceProvider(
			{
				displayName: 'Azure SQL Resource Provider', // TODO Localize
				id: 'Microsoft.Azure.SQL.ResourceProvider',
				settings: {}
			},
			{
				handleFirewallRule: (code, msg, id) => this.handleFirewallRule(code, msg, id),
				createFirewallRule: (account, info) => this.createFirewallRule(account, info)
			}
		);
	}

	private async createFirewallRule(account: sqlops.Account, firewallruleInfo: sqlops.FirewallRuleInfo): Promise<sqlops.CreateFirewallRuleResponse> {
		let tokens = await this._provider._accountProviders['azurePublicCloud'].getSecurityToken(account);
		let creds: TokenCredentials;
		Object.keys(tokens).forEach(e => {
			if (!creds && tokens[e].tokenType === 'Bearer') {
				creds = new TokenCredentials(tokens[e].token);
			}
		});
		if (!creds) {
			return { result: false, errorMessage: 'somethingwentwrong' };
		}
		let subclient = new azureResource.SubscriptionClient(creds);
		let subs = await subclient.subscriptions.list();
		for (let i = 0; i < subs.length; i++) {
			let e = subs[i];
			let sqlclient = new azureSql.SqlManagementClient(creds, e.subscriptionId);
			let resourceClient = new azureResource.ResourceManagementClient(creds, e.subscriptionId);
			let groups = await resourceClient.resourceGroups.list();
			for (let j = 0; j < groups.length; j++) {
				let group = groups[j];
				let servers = await sqlclient.servers.listByResourceGroup(group.name);
				let server = servers.find(server => server.fullyQualifiedDomainName === firewallruleInfo.serverName);
				if (server) {
					try {
						let result = await sqlclient.firewallRules.createOrUpdate(group.name, server.name, 'mssql', { startIpAddress: firewallruleInfo.startIpAddress, endIpAddress: firewallruleInfo.endIpAddress });
						return { result: true, errorMessage: undefined };
					} catch (e) {
						return { result: true, errorMessage: undefined };
					}
				}
			}
		}
		return { result: false, errorMessage: 'something went wrong' };
	}

	private handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<sqlops.HandleFirewallRuleResponse> {
		if (connectionTypeId !== 'MSSQL') {
			return Promise.resolve({ result: false, ipAddress: undefined });
		}

		if (errorCode !== SqlAzureFirewallBlockedErrorNumber) {
			return Promise.resolve({ result: false, ipAddress: undefined });
		}

		let ip = errorMessage.match(/(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g);

		return Promise.resolve({ result: true, ipAddress: ip.length > 0 ? ip[0] : '' });
	}

	public dispose() {
	}
}
