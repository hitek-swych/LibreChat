import { ChevronLeft } from 'lucide-react';
import { Constants } from 'librechat-data-provider';
import { useForm, Controller } from 'react-hook-form';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useUpdateUserPluginsMutation } from 'librechat-data-provider/react-query';
import type { TUpdateUserPlugins } from 'librechat-data-provider';
import type { MCP } from 'librechat-data-provider';
import { useCreateMCPMutation } from '~/data-provider';
import { Button, Input, Label } from '~/components/ui';
import { useGetStartupConfig } from '~/data-provider';
import { useAvailableAgentToolsQuery } from '~/data-provider/Agents/queries';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import MCPPanelSkeleton from './MCPPanelSkeleton';
import { useToastContext } from '~/Providers';
import MCPFormPanel from './MCPFormPanel';
import { useLocalize } from '~/hooks';

interface ServerConfigWithVars {
  serverName: string;
  config: {
    customUserVars: Record<string, { title: string; description: string }>;
  };
}

export default function MCPPanel() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const { data: startupConfig, isLoading: startupConfigLoading } = useGetStartupConfig();
  const { data: availableTools, isLoading: toolsLoading } = useAvailableAgentToolsQuery();
  const [selectedServerNameForEditing, setSelectedServerNameForEditing] = useState<string | null>(
    null,
  );
  const [showMCPForm, setShowMCPForm] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(false);

  // Get more query state info for debugging
  const availableToolsQuery = useAvailableAgentToolsQuery();

  // debugging for query refetching
  useEffect(() => {
    console.log('MCPPanel: availableToolsQuery data changed:', {
      dataLength: availableToolsQuery.data?.length || 0,
      dataUpdatedAt: availableToolsQuery.dataUpdatedAt,
      isLoading: availableToolsQuery.isLoading,
      isFetching: availableToolsQuery.isFetching,
      isError: availableToolsQuery.isError,
    });
  }, [
    availableToolsQuery.data,
    availableToolsQuery.dataUpdatedAt,
    availableToolsQuery.isLoading,
    availableToolsQuery.isFetching,
    availableToolsQuery.isError,
  ]);

  const mcpServerDefinitions = useMemo(() => {
    if (!startupConfig?.mcpServers) {
      return [];
    }
    return Object.entries(startupConfig.mcpServers)
      .filter(
        ([, serverConfig]) =>
          serverConfig.customUserVars && Object.keys(serverConfig.customUserVars).length > 0,
      )
      .map(([serverName, config]) => ({
        serverName,
        iconPath: null,
        config: {
          ...config,
          customUserVars: config.customUserVars ?? {},
        },
      }));
  }, [startupConfig?.mcpServers]);

  // Filter MCP tools from available tools
  const mcpTools = useMemo(() => {
    if (!availableTools) return [];
    return availableTools.filter(
      (tool) => tool.pluginKey && tool.pluginKey.includes(Constants.mcp_delimiter),
    );
  }, [availableTools]);

  const updateUserPluginsMutation = useUpdateUserPluginsMutation({
    onSuccess: () => {
      showToast({ message: localize('com_nav_mcp_vars_updated'), status: 'success' });
    },
    onError: (error) => {
      console.error('Error updating MCP custom user variables:', error);
      showToast({
        message: localize('com_nav_mcp_vars_update_error'),
        status: 'error',
      });
    },
  });

  const create = useCreateMCPMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_update_mcp_success'),
        status: 'success',
      });
      setShowMCPForm(false);
    },
    onError: (error) => {
      console.error('Error creating MCP:', error);
      showToast({
        message: localize('com_ui_update_mcp_error'),
        status: 'error',
      });
    },
  });

  const handleSaveServerVars = useCallback(
    (serverName: string, updatedValues: Record<string, string>) => {
      const payload: TUpdateUserPlugins = {
        pluginKey: `${Constants.mcp_prefix}${serverName}`,
        action: 'install', // 'install' action is used to set/update credentials/variables
        auth: updatedValues,
      };
      updateUserPluginsMutation.mutate(payload);
    },
    [updateUserPluginsMutation],
  );

  const handleRevokeServerVars = useCallback(
    (serverName: string) => {
      const payload: TUpdateUserPlugins = {
        pluginKey: `${Constants.mcp_prefix}${serverName}`,
        action: 'uninstall', // 'uninstall' action clears the variables
        auth: {}, // Empty auth for uninstall
      };
      updateUserPluginsMutation.mutate(payload);
    },
    [updateUserPluginsMutation],
  );

  const handleServerClickToEdit = (serverName: string) => {
    setSelectedServerNameForEditing(serverName);
  };

  const handleGoBackToList = () => {
    setSelectedServerNameForEditing(null);
  };

  const handleAddMCP = () => {
    setShowMCPForm(true);
  };

  const handleBackFromForm = () => {
    setShowMCPForm(false);
  };

  const handleSaveMCP = (mcp: MCP) => {
    create.mutate(mcp);
  };

  const handleManualCacheInvalidation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QueryKeys.tools] });
    showToast({ message: 'Cache invalidated manually', status: 'success' });
  }, [queryClient, showToast]);

  if (showMCPForm) {
    return (
      <MCPFormPanel
        onBack={handleBackFromForm}
        onSave={handleSaveMCP}
        showDeleteButton={false}
        title={localize('com_ui_add_mcp_server')}
        subtitle={localize('com_agents_mcp_info_chat')}
      />
    );
  }

  if (startupConfigLoading || toolsLoading) {
    return <MCPPanelSkeleton />;
  }

  if (mcpServerDefinitions.length === 0) {
    return (
      <div className="h-auto max-w-full overflow-x-hidden p-3">
        <div className="p-4 text-center text-sm text-gray-500">
          {localize('com_sidepanel_mcp_no_servers_with_vars')}
        </div>

        {/* Debug Tools Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setShowDebugTools(!showDebugTools)}
            className="btn btn-neutral border-token-border-light relative h-9 w-full rounded-lg font-medium"
          >
            <div className="flex w-full items-center justify-center gap-2">
              {showDebugTools ? 'Hide' : 'Show'} Debug Tools (
              {availableToolsQuery.data?.length || 0} total, {mcpTools.length} MCP)
            </div>
          </button>

          {showDebugTools && (
            <div className="bg-token-surface-secondary mt-4 max-h-96 overflow-y-auto rounded border border-gray-200 p-3 text-xs">
              <h4 className="mb-2 font-semibold">Available Tools Debug:</h4>
              <div className="space-y-2">
                <div>
                  <strong>Query State:</strong> isLoading={availableToolsQuery.isLoading.toString()}
                  , isFetching={availableToolsQuery.isFetching.toString()}, isError=
                  {availableToolsQuery.isError.toString()}
                </div>
                <div>
                  <strong>Data Updated At:</strong>{' '}
                  {availableToolsQuery.dataUpdatedAt
                    ? new Date(availableToolsQuery.dataUpdatedAt).toLocaleTimeString()
                    : 'Never'}
                </div>
                <div>
                  <strong>Total Tools:</strong> {availableToolsQuery.data?.length || 0}
                </div>
                <div>
                  <strong>MCP Tools:</strong> {mcpTools.length}
                </div>
                <div>
                  <strong>MCP Delimiter:</strong> "{Constants.mcp_delimiter}"
                </div>
                {availableToolsQuery.error && (
                  <div className="text-red-500">
                    <strong>Query Error:</strong> {JSON.stringify(availableToolsQuery.error)}
                  </div>
                )}
                <hr className="my-2" />
                <div>
                  <button
                    type="button"
                    onClick={handleManualCacheInvalidation}
                    className="btn btn-neutral border-token-border-light relative h-8 w-full rounded-lg text-xs font-medium"
                  >
                    Manual Cache Invalidation
                  </button>
                </div>
                <hr className="my-2" />
                <div>
                  <strong>MCP Tools Found:</strong>
                </div>
                {mcpTools.map((tool, index) => (
                  <div key={index} className="bg-token-surface-tertiary ml-2 rounded p-2">
                    <div>
                      <strong>Name:</strong> {tool.name}
                    </div>
                    <div>
                      <strong>PluginKey:</strong> {tool.pluginKey}
                    </div>
                    <div>
                      <strong>Description:</strong> {tool.description}
                    </div>
                  </div>
                ))}
                <hr className="my-2" />
                <div>
                  <strong>All Tools:</strong>
                </div>
                {availableToolsQuery.data?.map((tool, index) => (
                  <div key={index} className="bg-token-surface-tertiary ml-2 rounded p-2">
                    <div>
                      <strong>Name:</strong> {tool.name}
                    </div>
                    <div>
                      <strong>PluginKey:</strong> {tool.pluginKey}
                    </div>
                    <div>
                      <strong>Has MCP Delimiter:</strong>{' '}
                      {tool.pluginKey?.includes(Constants.mcp_delimiter) ? 'Yes' : 'No'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleAddMCP}
            className="btn btn-neutral border-token-border-light relative h-9 w-full rounded-lg font-medium"
            aria-haspopup="dialog"
          >
            <div className="flex w-full items-center justify-center gap-2">
              {localize('com_ui_add_mcp')}
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (selectedServerNameForEditing) {
    // Editing View
    const serverBeingEdited = mcpServerDefinitions.find(
      (s) => s.serverName === selectedServerNameForEditing,
    );

    if (!serverBeingEdited) {
      // Fallback to list view if server not found
      setSelectedServerNameForEditing(null);
      return (
        <div className="p-4 text-center text-sm text-gray-500">
          {localize('com_ui_error')}: {localize('com_ui_mcp_server_not_found')}
        </div>
      );
    }

    return (
      <div className="h-auto max-w-full overflow-x-hidden p-3">
        <Button
          variant="outline"
          onClick={handleGoBackToList}
          className="mb-3 flex items-center px-3 py-2 text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {localize('com_ui_back')}
        </Button>
        <h3 className="mb-3 text-lg font-medium">
          {localize('com_sidepanel_mcp_variables_for', { '0': serverBeingEdited.serverName })}
        </h3>
        <MCPVariableEditor
          server={serverBeingEdited}
          onSave={handleSaveServerVars}
          onRevoke={handleRevokeServerVars}
          isSubmitting={updateUserPluginsMutation.isLoading}
        />
      </div>
    );
  } else {
    // Server List View
    return (
      <div className="h-auto max-w-full overflow-x-hidden p-3">
        <div className="space-y-2">
          {mcpServerDefinitions.map((server) => (
            <Button
              key={server.serverName}
              variant="outline"
              className="w-full justify-start dark:hover:bg-gray-700"
              onClick={() => handleServerClickToEdit(server.serverName)}
            >
              {server.serverName}
            </Button>
          ))}
          <button
            type="button"
            onClick={handleAddMCP}
            className="btn btn-neutral border-token-border-light relative h-9 w-full rounded-lg font-medium"
            aria-haspopup="dialog"
          >
            <div className="flex w-full items-center justify-center gap-2">
              {localize('com_ui_add_mcp')}
            </div>
          </button>
        </div>
      </div>
    );
  }
}

// Inner component for the form - remains the same
interface MCPVariableEditorProps {
  server: ServerConfigWithVars;
  onSave: (serverName: string, updatedValues: Record<string, string>) => void;
  onRevoke: (serverName: string) => void;
  isSubmitting: boolean;
}

function MCPVariableEditor({ server, onSave, onRevoke, isSubmitting }: MCPVariableEditorProps) {
  const localize = useLocalize();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Record<string, string>>({
    defaultValues: {}, // Initialize empty, will be reset by useEffect
  });

  useEffect(() => {
    // Always initialize with empty strings based on the schema
    const initialFormValues = Object.keys(server.config.customUserVars).reduce(
      (acc, key) => {
        acc[key] = '';
        return acc;
      },
      {} as Record<string, string>,
    );
    reset(initialFormValues);
  }, [reset, server.config.customUserVars]);

  const onFormSubmit = (data: Record<string, string>) => {
    onSave(server.serverName, data);
  };

  const handleRevokeClick = () => {
    onRevoke(server.serverName);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="mb-4 mt-2 space-y-4">
      {Object.entries(server.config.customUserVars).map(([key, details]) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`${server.serverName}-${key}`} className="text-sm font-medium">
            {details.title}
          </Label>
          <Controller
            name={key}
            control={control}
            defaultValue={''}
            render={({ field }) => (
              <Input
                id={`${server.serverName}-${key}`}
                type="text"
                {...field}
                placeholder={localize('com_sidepanel_mcp_enter_value', { '0': details.title })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
              />
            )}
          />
          {details.description && (
            <p
              className="text-xs text-text-secondary [&_a]:text-blue-500 [&_a]:hover:text-blue-600 dark:[&_a]:text-blue-400 dark:[&_a]:hover:text-blue-300"
              dangerouslySetInnerHTML={{ __html: details.description }}
            />
          )}
          {errors[key] && <p className="text-xs text-red-500">{errors[key]?.message}</p>}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        {Object.keys(server.config.customUserVars).length > 0 && (
          <Button
            type="button"
            onClick={handleRevokeClick}
            className="bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-800"
            disabled={isSubmitting}
          >
            {localize('com_ui_revoke')}
          </Button>
        )}
        <Button
          type="submit"
          className="bg-green-500 text-white hover:bg-green-600"
          disabled={isSubmitting || !isDirty}
        >
          {isSubmitting ? localize('com_ui_saving') : localize('com_ui_save')}
        </Button>
      </div>
    </form>
  );
}
