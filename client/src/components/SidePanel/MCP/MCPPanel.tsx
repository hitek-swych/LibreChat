import { ChevronLeft, Trash2 } from 'lucide-react';
import { Constants } from 'librechat-data-provider';
import { useForm, Controller } from 'react-hook-form';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useUpdateUserPluginsMutation } from 'librechat-data-provider/react-query';
import type { TUpdateUserPlugins } from 'librechat-data-provider';
import type { MCP } from 'librechat-data-provider';
import { useCreateMCPMutation, useUpdateMCPMutation, useDeleteMCPMutation } from '~/data-provider';
import { Button, Input, Label, OGDialog, OGDialogTrigger, OGDialogTemplate } from '~/components/ui';
import { useGetStartupConfig } from '~/data-provider';
import { useAvailableAgentToolsQuery } from '~/data-provider/Agents/queries';
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
  const { data: startupConfig, isLoading: startupConfigLoading } = useGetStartupConfig();
  const { data: availableTools, isLoading: toolsLoading } = useAvailableAgentToolsQuery();
  const [selectedServerNameForEditing, setSelectedServerNameForEditing] = useState<string | null>(
    null,
  );
  const [showMCPForm, setShowMCPForm] = useState(false);
  const [editingMCP, setEditingMCP] = useState<any>(null);

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

  // Filter MCP tools from available tools (user-created MCP servers)
  const mcpTools = useMemo(() => {
    if (!availableTools) return [];

    // Use the same filtering logic as MCPSelect
    const mcpToolsMap = new Map<string, any>();
    availableTools.forEach((tool) => {
      const isMCP = tool.pluginKey.includes(Constants.mcp_delimiter);
      if (isMCP && tool.chatMenu !== false) {
        const parts = tool.pluginKey.split(Constants.mcp_delimiter);
        const serverName = parts[parts.length - 1];
        if (!mcpToolsMap.has(serverName)) {
          mcpToolsMap.set(serverName, {
            name: serverName,
            pluginKey: tool.pluginKey,
            authConfig: tool.authConfig,
            authenticated: tool.authenticated,
            icon: tool.icon,
          });
        }
      }
    });

    return Array.from(mcpToolsMap.values());
  }, [availableTools]);

  // Combine startup config MCP servers with user-created MCP tools
  const allMCPServers = useMemo(() => {
    const serverSet = new Set<string>();
    const servers: Array<{
      serverName: string;
      iconPath: string | null;
      config: {
        customUserVars: Record<string, { title: string; description: string }>;
      };
      isUserCreated: boolean;
      mcpData?: any; // Store the original MCP tool data for user-created servers
    }> = [];

    // Add startup config servers first
    mcpServerDefinitions.forEach((server) => {
      if (!serverSet.has(server.serverName)) {
        serverSet.add(server.serverName);
        servers.push({
          serverName: server.serverName,
          iconPath: server.iconPath,
          config: server.config,
          isUserCreated: false,
        });
      }
    });

    // Add user-created servers (only if not already added from startup config)
    mcpTools.forEach((tool) => {
      if (!serverSet.has(tool.name)) {
        serverSet.add(tool.name);
        servers.push({
          serverName: tool.name,
          iconPath: tool.icon || null,
          config: {
            customUserVars:
              tool.authConfig?.reduce(
                (acc, auth) => {
                  acc[auth.authField] = {
                    title: auth.label || auth.authField,
                    description: auth.description || '',
                  };
                  return acc;
                },
                {} as Record<string, { title: string; description: string }>,
              ) || {},
          },
          isUserCreated: true,
          mcpData: tool,
        });
      }
    });

    return servers;
  }, [mcpServerDefinitions, mcpTools]);

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

  const update = useUpdateMCPMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_update_mcp_success'),
        status: 'success',
      });
      setShowMCPForm(false);
      setEditingMCP(null);
    },
    onError: (error) => {
      console.error('Error updating MCP:', error);
      showToast({
        message: localize('com_ui_update_mcp_error'),
        status: 'error',
      });
    },
  });

  const deleteMCP = useDeleteMCPMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_delete_mcp_success'),
        status: 'success',
      });
      setShowMCPForm(false);
      setEditingMCP(null);
    },
    onError: (error) => {
      console.error('Error deleting MCP:', error);
      showToast({
        message: localize('com_ui_delete_mcp_error'),
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
    const server = allMCPServers.find((s) => s.serverName === serverName);
    if (!server) return;

    if (server.isUserCreated) {
      // For user-created servers, create a minimal MCP structure with available data
      // Hopefully we will refactor useGetAvailableTools to return MCP[] rather than TPlugin[]
      // and then we wont lose the MCP data like timeouts and custom headers when we refetch the tools
      const mcpForEditing = {
        mcp_id: server.mcpData.name, // Use name as mcp_id for now
        agent_id: '', // Will be set by the form
        metadata: {
          name: server.mcpData.name,
          description: '', // Will need to be filled by user
          url: '', // Will need to be filled by user
          icon: server.mcpData.icon || '',
          tools: [], // Will need to be filled by user
          trust: false, // Default value
          customHeaders: [], // Default empty array
          requestTimeout: undefined,
          connectionTimeout: undefined,
        },
      };
      setEditingMCP(mcpForEditing);
      setShowMCPForm(true);
    } else {
      // For startup config servers, open the variable editor
      setSelectedServerNameForEditing(serverName);
    }
  };

  const handleGoBackToList = () => {
    setSelectedServerNameForEditing(null);
  };

  const handleAddMCP = () => {
    setShowMCPForm(true);
  };

  const handleBackFromForm = () => {
    setShowMCPForm(false);
    setEditingMCP(null);
  };

  const handleSaveMCP = (mcp: MCP) => {
    if (editingMCP) {
      // Update existing MCP
      update.mutate({ mcp_id: editingMCP.mcp_id || editingMCP.name, data: mcp });
    } else {
      // Create new MCP
      create.mutate(mcp);
    }
  };

  const handleDeleteMCP = (mcp_id: string, agent_id: string) => {
    deleteMCP.mutate({ mcp_id });
  };

  if (showMCPForm) {
    return (
      <MCPFormPanel
        mcp={editingMCP}
        onBack={handleBackFromForm}
        onSave={handleSaveMCP}
        onDelete={handleDeleteMCP}
        showDeleteButton={!!editingMCP}
        title={editingMCP ? localize('com_ui_edit_mcp_server') : localize('com_ui_add_mcp_server')}
        subtitle={
          editingMCP
            ? localize('com_ui_edit_mcp_description')
            : localize('com_agents_mcp_info_chat')
        }
      />
    );
  }

  if (startupConfigLoading || toolsLoading) {
    return <MCPPanelSkeleton />;
  }

  if (allMCPServers.length === 0) {
    return (
      <div className="h-auto max-w-full overflow-x-hidden p-3">
        <div className="p-4 text-center text-sm text-gray-500">
          {localize('com_sidepanel_mcp_no_servers_with_vars')}
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
    const serverBeingEdited = allMCPServers.find(
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
          {allMCPServers.map((server) => (
            <Button
              key={server.serverName}
              variant="outline"
              className="w-full justify-start pl-4 pr-2 dark:hover:bg-gray-700"
              onClick={() => handleServerClickToEdit(server.serverName)}
            >
              <div className="flex w-full items-center justify-between">
                <span>{server.serverName}</span>
                {server.isUserCreated && (
                  <OGDialog>
                    <OGDialogTrigger asChild>
                      <button
                        type="button"
                        className="ml-4 flex h-7 w-7 items-center justify-center rounded p-1 text-white hover:bg-surface-secondary"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Delete ${server.serverName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </OGDialogTrigger>
                    <OGDialogTemplate
                      showCloseButton={false}
                      title={localize('com_ui_delete_mcp')}
                      className="max-w-[450px]"
                      main={
                        <Label className="text-left text-sm font-medium">
                          {localize('com_ui_delete_mcp_confirm')}
                        </Label>
                      }
                      selection={{
                        selectHandler: () => {
                          deleteMCP.mutate({ mcp_id: server.serverName });
                        },
                        selectClasses:
                          'bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-800 transition-color duration-200 text-white',
                        selectText: localize('com_ui_delete'),
                      }}
                    />
                  </OGDialog>
                )}
              </div>
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
