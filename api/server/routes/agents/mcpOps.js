const { logger } = require('@librechat/data-schemas');
const { CacheKeys, Constants } = require('librechat-data-provider');
const { getLogStores } = require('~/cache');
const { getMCPManager } = require('~/config');
const { getCachedTools, setCachedTools } = require('~/server/services/Config');

/**
 * Add a new MCP tool to the system
 * This integrates the MCP tool into the available tools cache
 */
const addTool = async (req, res) => {
  try {
    // Check authentication
    if (!req.user?.id) {
      logger.warn('Unauthorized MCP tool creation attempt');
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const { body: mcp } = req;
    
    // Validate required fields
    // still need to add the rest (url, timeouts,)
    if (!mcp?.metadata?.name) {
      logger.warn('MCP tool creation with missing required fields');
      return res.status(400).json({ message: 'Missing required fields: name is required' });
    }

    logger.info('CREATE MCP:', JSON.stringify(mcp, null, 2));

    // Get the tools cache
    const toolsCache = getLogStores(CacheKeys.CONFIG_STORE);
    const mcpToolsCache = getLogStores(CacheKeys.MCP_TOOLS);

    if (!toolsCache || !mcpToolsCache) {
      logger.error('Cache stores not available for MCP tool creation');
      return res.status(500).json({ message: 'Cache stores not available' });
    }

    // Check if tool already exists
    const toolName = mcp.metadata.name;
    const serverName = mcp.metadata.name;
    const existingTools = await mcpToolsCache.get(serverName);
    
    if (existingTools && Array.isArray(existingTools) && existingTools.length > 0) {
      logger.warn(`MCP tool ${serverName} already exists`);
      return res.status(409).json({ message: 'MCP tool already exists' });
    }

    // Create the MCP tool manifest entry with proper MCP delimiter
    const mcpTool = {
      name: toolName,
      pluginKey: `${toolName}${Constants.mcp_delimiter}${serverName}`,
      description: mcp.metadata.description || '',
      icon: mcp.metadata.icon || '',
      authConfig:
        mcp.metadata.customHeaders?.map((header) => ({
          authField: header.name,
          label: header.name,
          description: '', // customHeaders don't have description field
        })) || [],
      chatMenu: true, // Default to showing in chat menu
      toolkit: false,
    };

    // console.log('before', mcpToolsCache);

    // Store the MCP tool in the MCP tools cache
    await mcpToolsCache.set(serverName, [mcpTool]);

    // Add the server configuration to the MCPManager so it appears in tools list
    const mcpManager = getMCPManager();
    const serverConfig = {
      customUserVars: mcp.metadata.customHeaders?.reduce((acc, header) => {
        acc[header.name] = {
          title: header.name,
          description: header.description || '',
        };
        return acc;
      }, {}) || {},
    };
    mcpManager.addServerConfig(serverName, serverConfig);

    // console.log('after', mcpToolsCache);

    // Invalidate the main tools cache to force refresh
    await toolsCache.delete(CacheKeys.TOOLS);

    // Also update the user-specific tools cache with the new MCP tool
    const userId = req.user?.id;
    if (userId) {
      const userTools = (await getCachedTools({ userId, includeGlobal: false })) || {};
      userTools[mcpTool.pluginKey] = {
        type: 'function',
        function: {
          description: mcpTool.description || '',
          name: mcpTool.name,
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      };
      await setCachedTools(userTools, { userId });
    }

    logger.info(`MCP tool ${serverName} created successfully`);
    res.status(201).json({
      message: 'MCP tool created successfully',
      mcp_id: mcp.mcp_id,
      tool: mcpTool,
    });
  } catch (error) {
    logger.error('Error creating MCP tool:', error);
    res.status(500).json({ message: 'Failed to create MCP tool' });
  }
};

/**
 * Update an existing MCP tool in the system
 */
const updateTool = async (req, res) => {
  try {
    // Check authentication
    if (!req.user?.id) {
      logger.warn('Unauthorized MCP tool update attempt');
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const {
      body: mcp,
      params: { mcp_id },
    } = req;

    // Validate required fields
    // still need to add the rest (url, timeouts,)
    if (!mcp?.metadata?.name) {
      logger.warn('MCP tool update with missing required fields');
      return res.status(400).json({ message: 'Missing required fields: name is required' });
    }

    if (!mcp_id) {
      logger.warn('MCP tool update with missing mcp_id');
      return res.status(400).json({ message: 'Missing required parameter: mcp_id' });
    }

    logger.info('UPDATE MCP:', mcp_id, JSON.stringify(mcp, null, 2));

    // Get the tools cache
    const toolsCache = getLogStores(CacheKeys.CONFIG_STORE);
    const mcpToolsCache = getLogStores(CacheKeys.MCP_TOOLS);

    if (!toolsCache || !mcpToolsCache) {
      logger.error('Cache stores not available for MCP tool update');
      return res.status(500).json({ message: 'Cache stores not available' });
    }

    // Check if tool exists before updating
    const toolName = mcp.metadata.name;
    const serverName = mcp.metadata.name;
    const existingTools = await mcpToolsCache.get(serverName);
    
    if (!existingTools || !Array.isArray(existingTools) || existingTools.length === 0) {
      logger.warn(`MCP tool ${mcp_id} not found for update`);
      return res.status(404).json({ message: 'MCP tool not found' });
    }

    // Create the updated MCP tool manifest entry with proper MCP delimiter
    const mcpTool = {
      name: toolName,
      pluginKey: `${toolName}${Constants.mcp_delimiter}${serverName}`,
      description: mcp.metadata.description || '',
      icon: mcp.metadata.icon || '',
      authConfig:
        mcp.metadata.customHeaders?.map((header) => ({
          authField: header.name,
          label: header.name,
          description: '', // customHeaders don't have description field
        })) || [],
      chatMenu: true,
      toolkit: false,
    };

    // Update the MCP tool in the MCP tools cache
    await mcpToolsCache.set(serverName, [mcpTool]);

    // Update the server configuration in the MCPManager
    const mcpManager = getMCPManager();
    const serverConfig = {
      customUserVars: mcp.metadata.customHeaders?.reduce((acc, header) => {
        acc[header.name] = {
          title: header.name,
          description: header.description || '',
        };
        return acc;
      }, {}) || {},
    };
    mcpManager.addServerConfig(serverName, serverConfig);

    // Invalidate the main tools cache to force refresh
    await toolsCache.delete(CacheKeys.TOOLS);

    // Also update the user-specific tools cache with the updated MCP tool
    const userId = req.user?.id;
    if (userId) {
      const userTools = (await getCachedTools({ userId, includeGlobal: false })) || {};
      userTools[mcpTool.pluginKey] = {
        type: 'function',
        function: {
          description: mcpTool.description || '',
          name: mcpTool.name,
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      };
      await setCachedTools(userTools, { userId });
    }

    logger.info(`MCP tool ${serverName} updated successfully`);
    res.status(200).json({
      message: 'MCP tool updated successfully',
      mcp_id,
      tool: mcpTool,
    });
  } catch (error) {
    logger.error('Error updating MCP tool:', error);
    res.status(500).json({ message: 'Failed to update MCP tool' });
  }
};

/**
 * Delete an MCP tool from the system
 */
const deleteTool = async (req, res) => {
  try {
    // Check authentication
    if (!req.user?.id) {
      logger.warn('Unauthorized MCP tool deletion attempt');
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const { mcp_id } = req.params;

    // Validate required fields
    if (!mcp_id) {
      logger.warn('MCP tool deletion with missing mcp_id');
      return res.status(400).json({ message: 'Missing required parameter: mcp_id' });
    }

    logger.info('DELETE MCP:', mcp_id);

    // Get the tools cache
    const toolsCache = getLogStores(CacheKeys.CONFIG_STORE);
    const mcpToolsCache = getLogStores(CacheKeys.MCP_TOOLS);

    if (!toolsCache || !mcpToolsCache) {
      logger.error('Cache stores not available for MCP tool deletion');
      return res.status(500).json({ message: 'Cache stores not available' });
    }

    // Find and remove the MCP tool from cache
    const keys = (await mcpToolsCache.opts?.store?.keys()) || [];
    let deleted = false;

    for (const key of keys) {
      const tools = await mcpToolsCache.get(key);
      if (tools && Array.isArray(tools)) {
        const toolIndex = tools.findIndex(
          (tool) => tool.pluginKey.includes(mcp_id) || tool.name === mcp_id,
        );

        if (toolIndex !== -1) {
          tools.splice(toolIndex, 1);
          if (tools.length === 0) {
            await mcpToolsCache.delete(key);
          } else {
            await mcpToolsCache.set(key, tools);
          }
          deleted = true;
          break;
        }
      }
    }

    if (!deleted) {
      logger.warn(`MCP tool with ID ${mcp_id} not found in cache`);
      return res.status(404).json({ message: 'MCP tool not found' });
    }

    // Remove the server configuration from the MCPManager
    const mcpManager = getMCPManager();
    mcpManager.removeServerConfig(mcp_id);

    // Invalidate the main tools cache to force refresh
    await toolsCache.delete(CacheKeys.TOOLS);

    // Also remove the MCP tool from the user-specific tools cache
    const userId = req.user?.id;
    if (userId) {
      const userTools = (await getCachedTools({ userId, includeGlobal: false })) || {};
      // Find and remove the MCP tool from user cache
      for (const key of Object.keys(userTools)) {
        if (key.includes(mcp_id) || key.includes(Constants.mcp_delimiter + mcp_id)) {
          delete userTools[key];
        }
      }
      await setCachedTools(userTools, { userId });
    }

    logger.info(`MCP tool ${mcp_id} deleted successfully`);
    res.status(200).json({
      message: 'MCP tool deleted successfully',
      mcp_id,
    });
  } catch (error) {
    logger.error('Error deleting MCP tool:', error);
    res.status(500).json({ message: 'Failed to delete MCP tool' });
  }
};

module.exports = {
  addTool,
  updateTool,
  deleteTool,
}; 