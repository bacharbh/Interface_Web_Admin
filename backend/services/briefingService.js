import cron from 'node-cron';
import mongoose from 'mongoose';
// import copilotService from './copilotService.js'; // COPILOT REMOVED
// import { sendWhatsApp } from './twilioService.js';
// import { sendEmail } from './sendgridService.js';

/**
 * Morning Briefing Service
 * Scheduled for 7:00 AM daily
 */

const generateAndSendBriefings = async () => {
  console.log('[Briefing] Starting daily briefing generation...');

  try {
    // 1. Fetch all tenants/farmers
    // const farmers = await User.find({ role: 'FARMER' });
    const farmers = [{ name: 'Benoît', email: 'benoit@farm.com', phone: '+33123456789' }];

    for (const farmer of farmers) {
      // 2. Get herd summary for this farmer's tenant
      const summary = { total: 200, healthy: 185, alerts: 12, topRisk: ['Brebis #47', 'Agneau #12'] };

      // 3. Generate content using Claude (Proxy through copilotService)
      const prompt = `Génère un briefing matinal de 5 phrases pour le fermier ${farmer.name}. Statut du troupeau : ${JSON.stringify(summary)}. Météo : Ensoleillé, 22°C.`;

      // const aiResponse = await copilotService.handleChat([
      //   { role: 'user', content: prompt }
      // ], { userName: farmer.name });
      // console.log(`[Briefing] Briefing for ${farmer.name}: ${aiResponse.message}`);

      // 4. Send via preferred channel
      // if (farmer.pref === 'whatsapp') await sendWhatsApp(farmer.phone, aiResponse.message);
      // else await sendEmail(farmer.email, 'Votre Briefing Smart Shepherd', aiResponse.message);
    }

  } catch (error) {
    console.error('[Briefing] Error generating briefings:', error);
  }
};

// Schedule: 0 7 * * * (Every day at 7:00 AM)
cron.schedule('0 7 * * *', generateAndSendBriefings);

// For demo purposes, we can trigger it manually once on startup
// generateAndSendBriefings();

export default { generateAndSendBriefings };
