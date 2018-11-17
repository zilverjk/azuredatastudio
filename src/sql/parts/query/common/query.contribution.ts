/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!sql/media/overwriteVsIcons';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { localize } from 'vs/nls';

import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { QueryResultsEditor } from 'sql/parts/query/editor/queryResultsEditor';
import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { EditDataEditor } from 'sql/parts/editData/editor/editDataEditor';
import { EditDataInput } from 'sql/parts/editData/common/editDataInput';
import { QueryPlanEditor } from 'sql/parts/queryPlan/queryPlanEditor';
import { QueryPlanInput } from 'sql/parts/queryPlan/queryPlanInput';
import * as Constants from 'sql/parts/query/common/constants';
import { EditDataResultsEditor } from 'sql/parts/editData/editor/editDataResultsEditor';
import { EditDataResultsInput } from 'sql/parts/editData/common/editDataResultsInput';

import 'sql/parts/query/execution/queryActions';

// Editor
const queryResultsEditorDescriptor = new EditorDescriptor(
	QueryResultsEditor,
	QueryResultsEditor.ID,
	'QueryResults'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(queryResultsEditorDescriptor, [new SyncDescriptor(QueryResultsInput)]);

// Editor
const queryEditorDescriptor = new EditorDescriptor(
	QueryEditor,
	QueryEditor.ID,
	'Query'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(queryEditorDescriptor, [new SyncDescriptor(QueryInput)]);

// Query Plan editor registration

const queryPlanEditorDescriptor = new EditorDescriptor(
	QueryPlanEditor,
	QueryPlanEditor.ID,
	'QueryPlan'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(queryPlanEditorDescriptor, [new SyncDescriptor(QueryPlanInput)]);

// Editor
const editDataEditorDescriptor = new EditorDescriptor(
	EditDataEditor,
	EditDataEditor.ID,
	'EditData'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(editDataEditorDescriptor, [new SyncDescriptor(EditDataInput)]);

// Editor
const editDataResultsEditorDescriptor = new EditorDescriptor(
	EditDataResultsEditor,
	EditDataResultsEditor.ID,
	'EditDataResults'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(editDataResultsEditorDescriptor, [new SyncDescriptor(EditDataResultsInput)]);

// Intellisense and other configuration options
let registryProperties = {
	'sql.messagesDefaultOpen': {
		'type': 'boolean',
		'description': localize('sql.messagesDefaultOpen', 'True for the messages pane to be open by default; false for closed'),
		'default': true
	},
	'sql.saveAsCsv.includeHeaders': {
		'type': 'boolean',
		'description': localize('sql.saveAsCsv.includeHeaders', '[Optional] When true, column headers are included when saving results as CSV'),
		'default': true
	},
	'sql.saveAsCsv.delimiter': {
		'type': 'string',
		'description': localize('sql.saveAsCsv.delimiter', '[Optional] The custom delimiter to use between values when saving as CSV'),
		'default': ','
	},
	'sql.saveAsCsv.lineSeperator': {
		'type': '',
		'description': localize('sql.saveAsCsv.lineSeperator', '[Optional] Character(s) used for seperating rows when saving results as CSV'),
		'default': null
	},
	'sql.saveAsCsv.textIdentifier': {
		'type': 'string',
		'description': localize('sql.saveAsCsv.textIdentifier', '[Optional] Character used for enclosing text fields when saving results as CSV'),
		'default': '\"'
	},
	'sql.saveAsCsv.encoding': {
		'type': 'string',
		'description': localize('sql.saveAsCsv.encoding', '[Optional] File encoding used when saving results as CSV'),
		'default': 'utf-8'
	},
	'sql.copyIncludeHeaders': {
		'type': 'boolean',
		'description': localize('sql.copyIncludeHeaders', '[Optional] Configuration options for copying results from the Results View'),
		'default': false
	},
	'sql.copyRemoveNewLine': {
		'type': 'boolean',
		'description': localize('sql.copyRemoveNewLine', '[Optional] Configuration options for copying multi-line results from the Results View'),
		'default': true
	},
	'sql.showBatchTime': {
		'type': 'boolean',
		'description': localize('sql.showBatchTime', '[Optional] Should execution time be shown for individual batches'),
		'default': false
	},
	'sql.chart.defaultChartType': {
		'enum': Constants.allChartTypes,
		'default': Constants.chartTypeHorizontalBar,
		'description': localize('defaultChartType', "[Optional] the default chart type to use when opening Chart Viewer from a Query Results")
	},
	'sql.tabColorMode': {
		'type': 'string',
		'enum': [Constants.tabColorModeOff, Constants.tabColorModeBorder, Constants.tabColorModeFill],
		'enumDescriptions': [
			localize('tabColorMode.off', "Tab coloring will be disabled"),
			localize('tabColorMode.border', "The top border of each editor tab will be colored to match the relevant server group"),
			localize('tabColorMode.fill', "Each editor tab's background color will match the relevant server group"),
		],
		'default': Constants.tabColorModeOff,
		'description': localize('tabColorMode', "Controls how to color tabs based on the server group of their active connection")
	},
	'sql.showConnectionInfoInTitle': {
		'type': 'boolean',
		'description': localize('showConnectionInfoInTitle', "Controls whether to show the connection info for a tab in the title."),
		'default': true
	},
	'mssql.intelliSense.enableIntelliSense': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableIntelliSense', 'Should IntelliSense be enabled')
	},
	'mssql.intelliSense.enableErrorChecking': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableErrorChecking', 'Should IntelliSense error checking be enabled')
	},
	'mssql.intelliSense.enableSuggestions': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableSuggestions', 'Should IntelliSense suggestions be enabled')
	},
	'mssql.intelliSense.enableQuickInfo': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableQuickInfo', 'Should IntelliSense quick info be enabled')
	},
	'mssql.intelliSense.lowerCaseSuggestions': {
		'type': 'boolean',
		'default': false,
		'description': localize('mssql.intelliSense.lowerCaseSuggestions', 'Should IntelliSense suggestions be lowercase')
	}
};

// Register the query-related configuration options
let configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'sqlEditor',
	'title': 'SQL Editor',
	'type': 'object',
	'properties': registryProperties
});
