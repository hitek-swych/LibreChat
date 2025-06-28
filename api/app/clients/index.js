const OpenAIClient = require('./OpenAIClient');
const GoogleClient = require('./GoogleClient');
const TextStream = require('./TextStream');
const AnthropicClient = require('./AnthropicClient');
const AzouFinancialClient = require('./AzouClient');
const toolUtils = require('./tools/util');

module.exports = {
  OpenAIClient,
  GoogleClient,
  TextStream,
  AnthropicClient,
  ...toolUtils,
  'azou-financial': AzouFinancialClient,
  'savefinances': AzouFinancialClient,
  'operational-metrics': AzouFinancialClient,
};
