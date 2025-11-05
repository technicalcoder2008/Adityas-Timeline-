
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Yeh line API key ko GitHub ke secret locker se uthayegi
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

// === FUNCTION #1: Bhaari kaam ke liye (Compare Tab) ===
exports.getHistoricEvents = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { year, continent } = req.query;
      if (!year || !continent) {
        return res.status(400).send("Faltan los parámetros 'year' y 'continent'.");
      }

      const cacheId = `${year}_${continent.replace(/ /g, "_")}`;
      const cacheRef = db.collection("historical_cache").doc(cacheId);

      const cachedDoc = await cacheRef.get();
      if (cachedDoc.exists) {
        console.log(`Cache HIT for: ${cacheId}`);
        return res.status(200).json(cachedDoc.data().payload);
      }

      console.log(`Cache MISS for: ${cacheId}. Fetching from AI.`);

      const promptStep1 = `You are an expert historian and geographer who ONLY responds in perfectly formatted JSON.
            Your task is to generate a comprehensive, historically accurate, and clean list of all distinct political entities on the continent of **${continent}** during the year **${year}**.

            RULES FOR OUTPUT:
            1. Your final output MUST be a single, valid JSON array of unique strings.
            2. Do NOT include any text outside the JSON array.
            3. The response must start with '[' and end with ']'.`;
      
      const responseStep1 = await axios.post(GEMINI_API_URL, {
        contents: [{ parts: [{ text: promptStep1 }] }],
      });
      
      const entityListContent = responseStep1.data.candidates[0].content.parts[0].text;
      const jsonMatch = entityListContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Gemini ne entity list ke liye JSON array nahi diya.");
      
      const entityNames = JSON.parse(jsonMatch[0]);

      if (entityNames.length === 0) {
        await cacheRef.set({ payload: [] });
        return res.status(200).json([]);
      }

      const allEntitiesData = [];
      for (const entityName of entityNames) {
        const promptStep2 = `You are a historian AI that ONLY responds in a single, valid JSON object. For the historical entity "${entityName}" in the year ${year}, provide its events.
                    
                    RULES:
                    1. Your response MUST be a valid JSON object with two keys: "representative_modern_code" and "events".
                    2. "representative_modern_code": The 2-letter ISO code for a flag icon (e.g., "in" for "British Raj"). This is mandatory.
                    3. "events": An array of strings with significant events for that year.
                    4. CRITICAL: If no events are found, you MUST return a valid JSON object with an empty events array. Example: {"representative_modern_code": "np", "events": []}.
        5. Your response MUST start with '{' and end with '}'. No other text.`;        const responseStep2 = await axios.post(GEMINI_API_URL,          cntents: [{ parts: [{ text: promptStep2 }] }],
        });

        const eventDetailsContent = responseStep2.data.candidates[0].content.parts[0].text;
        const eventJsonMatch = eventDetailsContent.match(/\{[\s\S]*\}/);

        if (eventJsonMatch) {
          const eventData = JSON.parse(eventJsonMatch[0]);
          allEntitiesData.push({ name: entityName, ...eventData });
        } else {
          allEntitiesData.push({ name: entityName, representative_modern_code: 'xx', events: [] });
        }
      }

      await cacheRef.set({ payload: allEntitiesData, createdAt: new Date() });
      res.status(200).json(allEntitiesData);

    } catch (error) {
      console.error("getHistoricEvents mein Error:", error.response ? error.response.data : error.message);
      res.status(500).send("Request process karne mein error aaya.");
    }
  });
});


            
                            
            
                                
                                            
            
