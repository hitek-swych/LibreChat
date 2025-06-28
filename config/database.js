// Database configuration that uses our existing Supabase setup
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// LibreChat database adapter for Supabase
class SupabaseAdapter {
  constructor() {
    this.supabase = supabase;
  }

  async saveConversation(conversationData) {
    const { data, error } = await this.supabase
      .from('librechat_conversations')
      .insert([conversationData])
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async saveMessage(messageData) {
    const { data, error } = await this.supabase
      .from('librechat_messages')
      .insert([messageData])
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async getConversationHistory(conversationId) {
    const { data, error } = await this.supabase
      .from('librechat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  async getFinancialContext(conversationId) {
    const { data, error } = await this.supabase
      .from('conversation_financial_context')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // Ignore not found
    return data;
  }

  async updateFinancialContext(conversationId, contextUpdate) {
    const { data, error } = await this.supabase
      .from('conversation_financial_context')
      .upsert([{
        conversation_id: conversationId,
        ...contextUpdate,
        updated_at: new Date().toISOString()
      }])
      .select();
    
    if (error) throw error;
    return data[0];
  }
}

module.exports = new SupabaseAdapter();