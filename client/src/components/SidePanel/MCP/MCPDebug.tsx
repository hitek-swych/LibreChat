import React from 'react';
import { Constants } from 'librechat-data-provider';
import { useAvailableAgentToolsQuery } from '~/data-provider/Agents/queries';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { useToastContext } from '~/Providers';
import { useLocalize } from '~/hooks';

interface MCPDebugToolsProps {
  showDebugTools: boolean;
  setShowDebugTools: (show: boolean) => void;
  mcpTools: any[];
}

export default function MCPDebug({
  showDebugTools,
  setShowDebugTools,
  mcpTools,
}: MCPDebugToolsProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const availableToolsQuery = useAvailableAgentToolsQuery();

  const handleManualCacheInvalidation = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QueryKeys.tools] });
    showToast({ message: 'Cache invalidated manually', status: 'success' });
  }, [queryClient, showToast]);

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <button
        type="button"
        onClick={() => setShowDebugTools(!showDebugTools)}
        className="btn btn-neutral border-token-border-light relative h-9 w-full rounded-lg font-medium"
      >
        <div className="flex w-full items-center justify-center gap-2">
          {showDebugTools ? 'Hide' : 'Show'} Debug Tools ({availableToolsQuery.data?.length || 0}{' '}
          total, {mcpTools.length} MCP)
        </div>
      </button>

      {showDebugTools && (
        <div className="bg-token-surface-secondary mt-4 max-h-96 overflow-y-auto rounded border border-gray-200 p-3 text-xs">
          <h4 className="mb-2 font-semibold">Available Tools Debug:</h4>
          <div className="space-y-2">
            <div>
              <strong>Query State:</strong> isLoading={availableToolsQuery.isLoading.toString()},
              isFetching=
              {availableToolsQuery.isFetching.toString()}, isError=
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
  );
}
