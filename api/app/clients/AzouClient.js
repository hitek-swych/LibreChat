const OpenAIClient = require('./OpenAIClient');
const axios = require('axios');

class AzouFinancialClient extends OpenAIClient {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this.azouBackendUrl = process.env.AZOU_BACKEND_URL || 'http://localhost:9002';
    this.sender = 'Azou Financial Analysis';
    this.conversationContext = new Map(); // Store conversation financial context
  }

  async sendMessage(message, opts = {}) {
    const { conversationId, parentMessageId, user } = opts;
    
    try {
      // Get existing financial context for conversation
      const financialContext = await this.getFinancialContext(conversationId);
      
      // Classify message intent for financial analysis
      const intent = await this.classifyFinancialIntent(message);
      
      // Route to appropriate Azou backend endpoint
      let endpoint = '/api/chat/completions';
      if (intent === 'savefinances') {
        endpoint = '/api/timeseries/chat';
      } else if (intent === 'operational_metrics') {
        endpoint = '/api/operational-metrics/chat';
      }

      // Prepare request with financial context
      const requestData = {
        messages: await this.buildContextualMessages(message, financialContext),
        model: opts.model || 'enhanced-financial-agent',
        stream: opts.stream || false,
        user: user?.id,
        conversationId,
        parentMessageId,
        financialContext: financialContext?.accumulated_insights || {}
      };

      // Make request to Azou backend
      const response = await axios.post(
        `${this.azouBackendUrl}${endpoint}`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-Conversation-ID': conversationId
          },
          responseType: opts.stream ? 'stream' : 'json'
        }
      );

      // Process response and update financial context
      if (!opts.stream) {
        await this.updateFinancialContext(conversationId, response.data);
      }

      return this.handleResponse(response, opts);
      
    } catch (error) {
      console.error('Azou Financial Client Error:', error);
      throw error;
    }
  }

  async classifyFinancialIntent(message) {
    const intentKeywords = {
      savefinances: ['save finances', 'store financial data', 'time series', 'financial facts'],
      operational_metrics: ['acv', 'cac', 'ltv', 'churn', 'unit economics', 'metrics'],
      credit_analysis: ['credit', 'risk', '13 dimensions', 'creditworthiness'],
      revenue_scale: ['revenue scale', 'company size', 'classification'],
      report_generation: ['report', 'analysis', 'generate', 'export']
    };

    const messageLower = message.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        return intent;
      }
    }
    
    return 'general_financial_analysis';
  }

  async buildContextualMessages(currentMessage, financialContext) {
    const messages = [
      {
        role: 'system',
        content: `You are an advanced financial analysis AI agent with access to comprehensive financial tools and time-series data storage. 

Current Financial Context: ${JSON.stringify(financialContext?.accumulated_insights || {}, null, 2)}

Available Tools:
- SAVEFINANCES: Store financial facts in time-series format
- 13 Credit Dimensions Analysis
- Revenue Scale Classification  
- Operational Metrics Calculation
- Comprehensive Report Generation

Provide detailed financial analysis and use appropriate tools when needed.`
      },
      {
        role: 'user',
        content: currentMessage
      }
    ];

    return messages;
  }

  async getFinancialContext(conversationId) {
    if (!conversationId) return null;
    
    try {
      const response = await axios.get(
        `${this.azouBackendUrl}/api/conversations/${conversationId}/financial-context`,
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` }
        }
      );
      return response.data;
    } catch (error) {
      console.log('No existing financial context found');
      return null;
    }
  }

  async updateFinancialContext(conversationId, analysisResults) {
    if (!conversationId || !analysisResults.financial_analysis) return;
    
    try {
      await axios.post(
        `${this.azouBackendUrl}/api/conversations/${conversationId}/financial-context`,
        {
          analysis_update: analysisResults.financial_analysis,
          timestamp: new Date().toISOString()
        },
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` }
        }
      );
    } catch (error) {
      console.error('Failed to update financial context:', error);
    }
  }

  handleResponse(response, opts) {
    if (opts.stream) {
      return response.data; // Return stream directly
    }
    
    const result = response.data;
    
    // Format as OpenAI-compatible response
    return {
      id: result.id || `azou-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model || 'azou-financial-agent',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: result.message || result.response,
          financial_analysis: result.financial_analysis,
          tools_used: result.tools_used
        },
        finish_reason: 'stop'
      }],
      usage: result.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }
}

module.exports = AzouFinancialClient;