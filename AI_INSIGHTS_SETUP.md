# 🤖 AI INSIGHTS - Setup & Testing Guide

## Overview

Smart Shepherd now has **intelligent AI analysis** that works both **with and without** external API keys:

| Scenario | Mode | Confidence | Cost |
|----------|------|-----------|------|
| **No API Key** | Local AI | 85% | Free ✅ |
| **With API Key** | Claude 3.5 | 95% | ~$0.003/analysis |

---

## ⚙️ Setup Instructions

### Option 1: Using Local AI (Recommended for Development)

**No configuration needed!** The system automatically uses intelligent local analysis.

```bash
# Just start the app normally
npm run dev
```

Then navigate to:
- **Animals → Compare View** → AI Insights will analyze automatically
- **Map → Health Insights** → Shows herd analysis

### Option 2: Using Anthropic Claude API (Production)

1. **Get API Key**
   - Visit: https://console.anthropic.com
   - Create account or login
   - Get your API key (starts with `sk-ant-`)

2. **Configure Backend**
   ```bash
   # Add to backend/.env or system environment
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
   ```

3. **Restart Backend**
   ```bash
   npm run backend
   ```

4. **Verify**
   - Open Dev Console (F12)
   - Go to Animals → Compare View
   - Should see "Powered by Claude" instead of "Intelligence locale"

---

## 📊 Testing AI Insights

### Test 1: Local AI Analysis (No API Key)
```
Steps:
1. Go to: Animals → Compare View
2. Select 2-3 animals
3. Should see analysis with:
   ✅ Summary (shows health status)
   ✅ Risk Level (LOW, MEDIUM, HIGH, CRITICAL)
   ✅ Recommendations (actionable steps)
   ✅ Badge shows "Intelligence locale" + "Confiance: 85%"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "summary": "Température moyenne élevée (39.8°C) : possibile fièvre collective...",
    "riskLevel": "MEDIUM",
    "riskAnimalIds": ["collar_123", "collar_456"],
    "suggestions": [
      "🏥 Vérifier la température rectale des animaux fébriles...",
      "💧 Assurer hydratation adéquate..."
    ]
  },
  "fallback": true,
  "confidence": 0.85
}
```

### Test 2: API-Based Analysis (With Claude API)

```
Steps:
1. Configure ANTHROPIC_API_KEY (see Setup Option 2)
2. Restart backend
3. Go to: Animals → Compare View
4. Select 2-3 animals
5. Should see:
   ✅ Badge shows "Powered by Claude" + "Confiance: 95%"
   ✅ Analysis mentions "Claude 3.5 Sonnet"
   ✅ More detailed and contextual analysis
```

### Test 3: Risk Detection
```
High-Risk Scenario (should show CRITICAL):
- Animal A: Temp 41°C (fever), BPM 110 (tachycardia)
- Animal B: Temp 36°C (hypothermia), Activity 5% (lethargy)

Expected:
- Risk Level = CRITICAL
- riskAnimalIds = ["A", "B"]
- Suggestions include urgent recommendations
```

### Test 4: Fallback on API Error
```
Steps:
1. Configure bad ANTHROPIC_API_KEY (intentionally wrong)
2. Restart backend
3. Go to: Animals → Compare View
4. System should automatically fallback to local AI
5. Analysis still works with "Intelligence locale" badge
```

---

## 🔍 How It Works

### Local AI Service (No API Cost)

**File**: `backend/services/localAIService.js`

Analyzes animals using heuristics:

```javascript
// Temperature Analysis
- > 40.5°C  → FEVER_HIGH (35 points)
- > 39.8°C  → FEVER_MILD (15 points)
- < 37.5°C  → HYPOTHERMIA (25 points)

// Heart Rate Analysis  
- > 100 bpm → TACHYCARDIA (20 points)
- < 50 bpm  → BRADYCARDIA (20 points)

// Activity Level
- > 80%     → HIGH_ACTIVITY (10 points) = stress
- < 10%     → LOW_ACTIVITY (15 points) = lethargy

// Total Score
50+ = CRITICAL
30+ = HIGH
15+ = MEDIUM
<15 = LOW
```

### Claude API Integration

**File**: `backend/routes/ai.js`

- Sends animal telemetry to Anthropic API
- Receives structured JSON analysis
- **Cost**: ~$0.003 per analysis (~300 tokens)
- **Benefit**: Contextual, nuanced analysis

---

## 🧪 Debugging

### Check Backend Logs
```bash
# Look for these log messages:
# ✅ "Local AI analysis" = Using fallback
# ✅ "Anthropic API key not configured" = Need to add API key
# ❌ "Failed to parse JSON" = Claude response format issue
```

### Test API Directly
```bash
curl -X POST http://localhost:5000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "animals": [
      {
        "name": "Mouton-1",
        "collar_id": "col_123",
        "temperature": 39.8,
        "bpm": 85,
        "activity": 45,
        "battery": 75,
        "gps_signal": 4
      }
    ]
  }'
```

**Expected Response (Local AI):**
```json
{
  "success": true,
  "data": {
    "summary": "✅ Températures normales. ...",
    "riskLevel": "LOW",
    "riskAnimalIds": [],
    "suggestions": ["✅ Continuer suivi..."]
  },
  "fallback": true,
  "confidence": 0.85
}
```

---

## 📈 Improving Analysis Quality

### With Local AI
- Ensure telemetry data is accurate
- Check animal health status is up-to-date
- Monitor trend history for pattern detection

### With Claude API
- More context = better analysis
- Include historical data (24h trends)
- Add environmental data (weather, location)

---

## 🔐 API Key Security

### Best Practices
```
❌ Never commit .env files to git
❌ Never log API keys
✅ Use environment variables
✅ Rotate keys monthly
✅ Use separate keys per environment
```

### Production Setup
```bash
# Use environment variables
export ANTHROPIC_API_KEY="sk-ant-xxxxx"

# Or use secrets management (AWS/GCP/Azure)
# Or use CI/CD secrets (GitHub/GitLab)
```

---

## 📋 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Intelligence locale" always | No API key | Add ANTHROPIC_API_KEY to env |
| Error: "Invalid JSON" | Claude response format | Check temperature format |
| Empty recommendations | Poor data quality | Ensure complete animal telemetry |
| Slow analysis | API timeout | Increase timeout or use local AI |
| "429 Too Many Requests" | Rate limit | Anthropic throttling, wait/upgrade |

---

## 🚀 Next Steps

### To Enable Production AI:
1. ✅ Get Anthropic API key
2. ✅ Add to production environment
3. ✅ Test thoroughly
4. ✅ Monitor costs (~$50/month for 50,000 analyses)
5. ✅ Set up alerts for API failures

### To Improve Local AI:
1. Add more telemetry sensors
2. Train local ML models
3. Use historical trends
4. Implement seasonal adjustments

---

## 📚 Resources

- **Anthropic API Docs**: https://docs.anthropic.com
- **Claude API Pricing**: https://anthropic.com/pricing
- **Local AI Service**: `backend/services/localAIService.js`
- **API Route**: `backend/routes/ai.js`
- **Frontend Component**: `src/pages/Animals/CompareView/AIAnalysis.tsx`

---

**Status**: ✅ Ready for testing  
**Local AI**: 🟢 Working  
**Claude API**: 🟡 Optional (fallback available)  
**Cost**: 💰 Free with local AI, ~$0.003 per analysis with Claude
