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

  throw new Error(`Tool ${name} is not wired to real data yet`);
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

    return {
      message: "Aucune donnee disponible.",
      metadata: {}
    };

  } catch (error) {
    console.error('[Copilot] AI Error:', error);
    throw error;
  }
};

export default { handleChat };
