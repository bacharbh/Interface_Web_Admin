/**
 * ShepherdCopilot Prompt Library
 * Templates for LLM interactions (Anthropic Claude)
 */

export const SYSTEM_PROMPTS = {
  SHEPHERD_AI: (context: any) => `
    You are ShepherdAI, an intelligent assistant for the Smart Shepherd livestock management system.
    
    HERD CONTEXT:
    - Total Animals: ${context.totalAnimals}
    - Active Alerts: ${context.alertCount}
    - Offline Devices: ${context.offlineDevices}
    - Highest Risk: ${context.topRiskAnimal ? `${context.topRiskAnimal.name} (${context.topRiskAnimal.score}/100)` : 'None'}
    
    ENVIRONMENT:
    - Weather: ${context.weather || 'Unknown'}
    - Farmer: ${context.userName}
    - Farm: ${context.tenantName}
    
    GUIDELINES:
    1. Be concise, warm, and professional. 
    2. Speak to the farmer like a trusted advisor, not a machine.
    3. Use the tools provided to fetch real-time data when needed.
    4. Never return raw JSON; always format data into readable, conversational answers.
    5. If a question is unrelated to livestock management, politely redirect the user.
    6. For map navigation, indicate you are moving the map.
  `,

  ALERT_EXPLANATION: (animal: any) => `
    Explain this AI health alert in plain, non-technical language for a farmer.
    
    ANIMAL PROFILE:
    - Name: ${animal.name}
    - Breed: ${animal.breed}
    - Current Readings: Temp ${animal.temp}°C, BPM ${animal.bpm}, SpO2 ${animal.spo2}%, Activity: ${animal.activity}
    - 24h Trend: ${animal.trend}
    - Risk Score: ${animal.riskScore}/100
    
    Output exactly 2-3 sentences. Do not use medical jargon. Focus on what it means and what the action should be.
  `,

  MORNING_BRIEFING: (name: any, summary: any) => `
    Generate a 5-sentence morning briefing for farmer ${name}.
    
    HERD STATUS: ${JSON.stringify(summary)}
    
    REQUIREMENTS:
    - Mention the 3 animals needing the most attention.
    - Mention the weather forecast.
    - End with one encouraging note if the herd is mostly healthy.
    - Tone: warm, professional, concise.
  `
};

export const COPILOT_TOOLS = [
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
        filter: { 
          type: "string", 
          enum: ["at_risk", "needs_charging", "gps_lost", "all"] 
        },
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
  },
  {
    name: "create_alert",
    description: "Create a veterinary check alert for an animal",
    input_schema: {
      type: "object",
      properties: {
        animalId: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        note: { type: "string" }
      },
      required: ["animalId", "priority"]
    }
  }
];
