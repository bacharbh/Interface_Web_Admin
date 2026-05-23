const axios = require('axios');
// const anthropic = new (require('@anthropic-ai/sdk'))({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * ShepherdCopilot Service
 * Handles Claude API proxy and tool execution
 */

const tools = [
  {
    name: "get_herd_summary",
    description: "Get real-time summary of the entire herd including alert counts and health distribution"
  },
  {
    name: "query_animals",
    description: "Filter animals by health status, risk score, battery level, or GPS status",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["at_risk", "needs_charging", "gps_lost", "all"] },
        limit: { type: "integer" }
      }
    }
  },
  {
    name: "get_animal_detail",
    description: "Get full telemetry and AI risk analysis for a specific animal",
    input_schema: {
      type: "object",
      properties: {
        animalId: { type: "string" }
      },
      required: ["animalId"]
    }
  }
];

const executeTool = async (name, args) => {
  console.log(`[Copilot] Executing tool: ${name}`, args);
  
  switch (name) {
    case 'get_herd_summary':
      return { total: 200, healthy: 185, at_risk: 12, critical: 3 };
    case 'query_animals':
      return [
        { id: 'C047', name: 'Brebis #47', status: 'at_risk', score: 87 },
        { id: 'C012', name: 'Agneau #12', status: 'healthy', score: 15 }
      ];
    case 'get_animal_detail':
      return { 
        id: args.animalId, 
        name: 'Brebis #47', 
        temp: 40.2, 
        bpm: 125, 
        risk: 87,
        explanation: "Early signs of fever detected. Temperature rising +1.2C in 6 hours."
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
};

const handleChat = async (messages, context) => {
  try {
    // In a real implementation, you would call:
    /*
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      system: `You are ShepherdAI... (use context)`,
      messages: messages,
      tools: tools
    });
    */

    // MOCK RESPONSE for Demonstration
    const lastUserMsg = messages[messages.length - 1].content.toLowerCase();
    
    if (lastUserMsg.includes('résumé') || lastUserMsg.includes('troupeau')) {
      const summary = await executeTool('get_herd_summary');
      return { 
        message: `Votre troupeau compte actuellement ${summary.total} bêtes. Tout va bien pour la majorité (${summary.healthy} en bonne santé), mais j'ai détecté ${summary.at_risk} animaux à risque, dont ${summary.critical} en état critique nécessitant une vérification immédiate.`,
        metadata: {} 
      };
    }

    if (lastUserMsg.includes('47')) {
      const detail = await executeTool('get_animal_detail', { animalId: 'C047' });
      return { 
        message: `La Brebis #47 est actuellement à surveiller de près. Son score de risque est de ${detail.risk}/100. Sa température est élevée (${detail.temp}°C) et son rythme cardiaque est de ${detail.bpm} BPM. ${detail.explanation}`,
        metadata: { flyTo: 'C047' } 
      };
    }

    return { 
      message: "Je peux vous aider à analyser la santé de votre troupeau, localiser un animal sur la carte, ou programmer des alertes vétérinaires. Que voulez-vous savoir ?",
      metadata: {} 
    };

  } catch (error) {
    console.error('[Copilot] AI Error:', error);
    throw error;
  }
};

export default { handleChat };
