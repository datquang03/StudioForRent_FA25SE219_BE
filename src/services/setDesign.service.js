// #region Imports
import { GoogleGenerativeAI } from '@google/generative-ai';
import SetDesign from '../models/SetDesign/setDesign.model.js';
import Booking from '../models/Booking/booking.model.js';
import { AI_SET_DESIGN_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';
// #endregion

// Initialize Gemini AI with safety settings
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash', // Updated to latest released model
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
  ],
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  },
});

// Imagen 4.0 image generation is NOT accessible via @google/generative-ai SDK's getGenerativeModel.
// To use Imagen 4.0, you must use the appropriate API endpoint or SDK provided by Google for image generation.
// Remove or replace this block with the correct integration when available.

// #region Set Design Service

/**
 * Generate AI design suggestions for a booking
 * @param {string} bookingId - Booking ID
 * @param {Object} preferences - User preferences (theme, style, colors, etc.)
 * @returns {Object} AI-generated design suggestions
 */
export const generateAiDesign = async (bookingId, preferences = {}) => {
  try {
    // Get booking details for context
    const booking = await Booking.findById(bookingId)
      .populate('scheduleId', 'studioId startTime endTime')
      .populate('scheduleId.studioId', 'name type capacity');

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Create prompt for Gemini with strict studio-only instructions
    const prompt = createDesignPrompt(booking, preferences);

    // Generate design suggestions with system instructions
    const systemPrompt = `SYSTEM INSTRUCTIONS: You are a professional photo studio set designer AI that ONLY creates content related to photo studio set designs. You MUST refuse any requests that are not related to photo studio set design, photography equipment, lighting, props, or studio setup. If asked about anything else, respond with: "I can only assist with photo studio set design topics."

You are restricted to:
- Photo studio set designs and layouts
- Photography lighting and equipment
- Props and backdrops for photo shoots
- Camera angles and techniques for studio photography
- Color schemes and mood for studio shoots

You CANNOT discuss or generate content about:
- General topics not related to photography
- Personal advice or life coaching
- Political topics
- Sensitive or controversial subjects
- Anything outside of professional photo studio work

Always respond in the requested JSON format for valid studio design requests.`;

    const fullPrompt = `${systemPrompt}\n\nUSER REQUEST: ${prompt}`;

    // Log AI usage for monitoring
    logger.info(`AI Design Generation - User: ${booking.userId}, Booking: ${bookingId}, Preferences: ${Object.keys(preferences).length} items`);

    // Generate design suggestions
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();

    // Validate response is studio-related
    if (responseText.toLowerCase().includes('i can only assist') ||
        !responseText.includes('title') ||
        !responseText.includes('description')) {
      throw new Error('AI response was not studio design related or invalid format');
    }

    let designSuggestions;
    try {
      designSuggestions = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON:', responseText);
      throw new Error('AI generated invalid response format');
    }

    // Save AI iteration to database
    const setDesign = await SetDesign.findOneAndUpdate(
      { bookingId },
      {
        $push: {
          aiIterations: {
            prompt: JSON.stringify(preferences),
            imageUrl: designSuggestions.imageUrl || null,
            generatedAt: new Date()
          }
        }
      },
      { upsert: true, new: true }
    );

    return {
      setDesignId: setDesign._id,
      suggestions: designSuggestions,
      iterationCount: setDesign.aiIterations.length
    };

  } catch (error) {
    logger.error('Error generating AI design:', error);
    throw new Error('Failed to generate AI design suggestions');
  }
};

/**
 * Select final AI design from iterations
 * @param {string} setDesignId - SetDesign ID
 * @param {number} iterationIndex - Index of selected iteration
 * @returns {Object} Updated SetDesign
 */
export const selectFinalDesign = async (setDesignId, iterationIndex) => {
  try {
    const setDesign = await SetDesign.findById(setDesignId);

    if (!setDesign) {
      throw new Error('SetDesign not found');
    }

    if (!setDesign.aiIterations[iterationIndex]) {
      throw new Error('Invalid iteration index');
    }

    const selectedIteration = setDesign.aiIterations[iterationIndex];

        setDesign.finalDesign = {
      prompt: selectedIteration.prompt,
      imageUrl: selectedIteration.imageUrl,
    };
    setDesign.status = AI_SET_DESIGN_STATUS.DESIGN_APPROVED;

    await setDesign.save();

    return setDesign;

  } catch (error) {
    logger.error('Error selecting final design:', error);
    throw error;
  }
};

/**
 * Generate props/equipment recommendations for a design
 * @param {string} setDesignId - SetDesign ID
 * @returns {Object} Props recommendations
 */
export const generatePropsRecommendations = async (setDesignId) => {
  try {
    const setDesign = await SetDesign.findById(setDesignId)
      .populate('bookingId', 'scheduleId')
      .populate('bookingId.scheduleId', 'studioId')
      .populate('bookingId.scheduleId.studioId', 'equipment');

    if (!setDesign || !setDesign.finalAiPrompt) {
      throw new Error('SetDesign not found or no final design selected');
    }

    const systemPrompt = `SYSTEM INSTRUCTIONS: You are a professional photo studio equipment specialist. You ONLY provide recommendations for photography equipment, lighting, props, and studio setup. You MUST refuse any requests not related to professional photo studio work.`;

    const prompt = `${systemPrompt}

Based on this approved studio set design: "${setDesign.finalAiPrompt}"

Please recommend ONLY professional photography equipment and props needed for this studio set design.

Available studio equipment: ${JSON.stringify(setDesign.bookingId.scheduleId.studioId.equipment || [])}

REQUIREMENTS:
- Only recommend photography-related equipment and props
- Focus on lighting, backdrops, stands, modifiers, cameras, lenses
- No general household items or non-photography equipment
- Be specific about professional photography gear
- Consider the studio's existing equipment

Return ONLY a valid JSON object with this exact structure:
{
  "recommendedProps": ["Professional photography prop 1", "Professional photography prop 2"],
  "availableEquipment": ["Existing studio equipment to use"],
  "additionalNotes": "Professional photography setup notes only"
}`;

    // Log AI usage for props recommendations
    logger.info(`AI Props Recommendations - SetDesign: ${setDesignId}, User: ${setDesign.bookingId.userId}`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Validate response is equipment-related
    if (responseText.toLowerCase().includes('i can only assist') ||
        !responseText.includes('recommendedProps') ||
        !responseText.includes('availableEquipment')) {
      throw new Error('AI response was not equipment-related or invalid format');
    }

    let recommendations;
    try {
      recommendations = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse props recommendations as JSON:', responseText);
      throw new Error('AI generated invalid props response format');
    }

    // Update setDesign with recommendations
    setDesign.requiredProps = recommendations;
    await setDesign.save();

    return recommendations;

  } catch (error) {
    logger.error('Error generating props recommendations:', error);
    throw new Error('Failed to generate props recommendations');
  }
};

/**
 * Get all AI iterations for a setDesign
 * @param {string} setDesignId - SetDesign ID
 * @returns {Array} AI iterations
 */
export const getAiIterations = async (setDesignId) => {
  try {
    const setDesign = await SetDesign.findById(setDesignId)
      .select('aiIterations finalAiPrompt finalAiImageUrl status')
      .lean();

    if (!setDesign) {
      throw new Error('SetDesign not found');
    }

    return setDesign;

  } catch (error) {
    logger.error('Error getting AI iterations:', error);
    throw error;
  }
};

/**
 * Create design prompt for Gemini AI
 * @param {Object} booking - Booking object
 * @param {Object} preferences - User preferences
 * @returns {string} Formatted prompt
 */
const createDesignPrompt = (booking, preferences) => {
  const studio = booking.scheduleId?.studioId;

  // Validate preferences are studio-related
  const allowedKeys = ['theme', 'style', 'colors', 'mood', 'lighting', 'backdrop', 'props', 'camera', 'specialEffects', 'atmosphere'];
  const filteredPreferences = Object.entries(preferences)
    .filter(([key]) => allowedKeys.includes(key.toLowerCase()))
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});

  return `STUDIO SET DESIGN REQUEST ONLY:

You must ONLY generate photo studio set design concepts. This is for professional photography studio work.

Studio Specifications:
- Studio Name: ${studio?.name || 'Professional Photo Studio'}
- Studio Type: ${studio?.type || 'Commercial Photography Studio'}
- Capacity: ${studio?.capacity || 'Standard'} people
- Session Time: ${booking.scheduleId?.startTime || 'Scheduled time'} to ${booking.scheduleId?.endTime || 'End time'}

Client Preferences (studio-related only):
${Object.entries(filteredPreferences).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

REQUIRED: Generate exactly 3 different professional photo studio set design concepts for this booking.

Each design concept MUST include:
1. title: A professional, descriptive title (max 50 characters)
2. description: Detailed studio setup description (200-400 characters)
3. colorScheme: Professional color palette for studio photography
4. lighting: Specific lighting setup using studio equipment
5. mood: Professional photography mood/atmosphere
6. cameraAngles: Recommended camera techniques for this setup
7. specialEffects: Studio-appropriate effects and techniques

IMPORTANT RESTRICTIONS:
- Only discuss studio photography equipment and techniques
- No general topics, personal advice, or non-studio content
- All suggestions must be practical for professional photo studios
- Focus on lighting, composition, props, and camera work
- Keep descriptions professional and photography-focused

Return ONLY a valid JSON array with exactly 3 objects. No additional text or explanations.`;
};

/**
 * Generate image from design description (Optional - requires Imagen API)
 * @param {string} designDescription - Text description from Gemini
 * @returns {Object} Image generation result
 */
export const generateDesignImage = async (designDescription) => {
  try {
    // Check if Imagen is available
    if (!imagenModel) {
      logger.info(`Image generation requested but Gemini API not configured: ${designDescription.substring(0, 100)}...`);
      return {
        imageUrl: null,
        prompt: designDescription,
        note: 'Image generation requires GOOGLE_GEMINI_API_KEY in .env file (same key used for text generation)'
      };
    }

    // Create professional photography prompt for Imagen 4.0
    const imagePrompt = `Professional photo studio set design: ${designDescription}. 
High quality, 4K HDR, professional photography, studio lighting, detailed, realistic, 
cinematic composition, professional color grading, shot with professional camera equipment`;

    logger.info(`Generating image with Imagen 4.0: ${designDescription.substring(0, 100)}...`);

    // Generate image with Imagen 4.0
    const result = await imagenModel.generateImages({
      prompt: imagePrompt,
      numberOfImages: 1,
      aspectRatio: '16:9', // Widescreen for studio layouts
      personGeneration: 'allow_adult' // Allow people in studio setup images
    });

    const generatedImages = result.generatedImages;
    if (!generatedImages || generatedImages.length === 0) {
      throw new Error('No images generated');
    }

    // Return the first generated image
    return {
      imageUrl: generatedImages[0].imageUrl || generatedImages[0].image,
      prompt: imagePrompt,
      model: 'imagen-4.0-generate-001',
      aspectRatio: '16:9'
    };

  } catch (error) {
    logger.error('Error generating design image:', error);
    throw new Error('Failed to generate design image: ' + error.message);
  }
};

/**
 * Send a chat message to AI and get conversational response
 * @param {string} bookingId - Booking ID
 * @param {string} userMessage - Customer's message
 * @returns {Promise<Object>} AI response with chat history
 */
export const sendChatMessage = async (bookingId, userMessage) => {
  try {
    // Validate booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Find or create SetDesign for this booking
    let setDesign = await SetDesign.findOne({ bookingId });
    
    if (!setDesign) {
      // Create new SetDesign in drafting status
      setDesign = new SetDesign({
        bookingId,
        status: AI_SET_DESIGN_STATUS.DRAFTING,
        chatHistory: []
      });
    }

    // Add customer message to chat history
    setDesign.chatHistory.push({
      role: 'customer',
      message: userMessage,
      timestamp: new Date()
    });

    // Build conversation context for AI
    const conversationContext = setDesign.chatHistory
      .map(msg => `${msg.role === 'customer' ? 'Customer' : 'AI'}: ${msg.message}`)
      .join('\n');

    // Create AI prompt for conversational response
    const prompt = `You are a helpful AI assistant for a photoshoot studio. You help customers design their perfect photoshoot setup through conversation.

Previous conversation:
${conversationContext}

Instructions:
1. Have a natural, friendly conversation about the customer's photoshoot vision
2. Ask clarifying questions about: theme, colors, mood, lighting preferences, special effects
3. When you have enough information (at least theme, colors, and mood), suggest generating 3 specific design concepts
4. Keep responses concise and conversational (2-3 sentences)
5. Focus on studio photoshoot setups only

Respond to the customer's latest message naturally and helpfully.`;

    const result = await model.generateContent(prompt);
    const aiMessage = result.response.text();

    // Add AI response to chat history
    setDesign.chatHistory.push({
      role: 'ai',
      message: aiMessage,
      timestamp: new Date()
    });

    // Save updated SetDesign
    await setDesign.save();

    // Determine if we have enough information to generate designs
    const conversationText = conversationContext.toLowerCase();
    const hasTheme = conversationText.includes('theme') || 
                     conversationText.includes('occasion') || 
                     conversationText.includes('wedding') ||
                     conversationText.includes('portrait') ||
                     conversationText.includes('couple');
    const hasColors = conversationText.match(/\b(color|white|black|red|blue|green|pink|gold|silver)\b/);
    const hasMood = conversationText.match(/\b(mood|elegant|romantic|modern|classic|dreamy|cozy|bright)\b/);
    
    const canGenerateDesigns = hasTheme && hasColors && hasMood;

    return {
      setDesignId: setDesign._id,
      aiMessage,
      chatHistory: setDesign.chatHistory,
      canGenerateDesigns,
      messageCount: setDesign.chatHistory.length
    };

  } catch (error) {
    logger.error('Error in chat with AI:', error);
    throw new Error('Failed to process chat message: ' + error.message);
  }
};

/**
 * Get chat history for a booking
 * @param {string} bookingId - Booking ID
 * @returns {Promise<Object>} Chat history
 */
export const getChatHistory = async (bookingId) => {
  try {
    const setDesign = await SetDesign.findOne({ bookingId });
    
    if (!setDesign) {
      return {
        chatHistory: [],
        messageCount: 0
      };
    }

    return {
      setDesignId: setDesign._id,
      chatHistory: setDesign.chatHistory || [],
      messageCount: setDesign.chatHistory?.length || 0,
      status: setDesign.status
    };

  } catch (error) {
    logger.error('Error getting chat history:', error);
    throw new Error('Failed to get chat history: ' + error.message);
  }
};

/**
 * Generate design concepts based on entire chat conversation
 * @param {string} bookingId - Booking ID
 * @returns {Promise<Object>} Generated design suggestions
 */
export const generateDesignsFromChat = async (bookingId) => {
  try {
    // Get SetDesign with chat history
    const setDesign = await SetDesign.findOne({ bookingId });
    
    if (!setDesign || !setDesign.chatHistory || setDesign.chatHistory.length === 0) {
      throw new Error('No chat history found. Please chat with AI first.');
    }

    // Build conversation summary for AI
    const conversationSummary = setDesign.chatHistory
      .map(msg => `${msg.role === 'customer' ? 'Customer' : 'AI'}: ${msg.message}`)
      .join('\n');

    // Create detailed prompt for design generation
    const prompt = `Based on this entire conversation with the customer, generate 3 distinct photoshoot setup designs.

Conversation:
${conversationSummary}

Generate 3 professional studio photoshoot setup designs in JSON format. Each design should include:
- title: Creative, descriptive name
- description: Detailed setup description (2-3 sentences)
- colorScheme: Array of 3-5 specific colors
- lighting: Detailed lighting setup
- mood: Overall atmosphere
- cameraAngles: Array of recommended angles
- specialEffects: Array of effects/techniques

Return ONLY valid JSON array with no markdown formatting:
[
  {
    "title": "Design Name",
    "description": "...",
    "colorScheme": ["color1", "color2", "color3"],
    "lighting": "...",
    "mood": "...",
    "cameraAngles": ["angle1", "angle2"],
    "specialEffects": ["effect1", "effect2"]
  }
]`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Clean response - remove markdown code blocks if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let suggestions;
    try {
      suggestions = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse AI response:', responseText);
      throw new Error('AI generated invalid response format');
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('AI did not generate valid design suggestions');
    }

    // Validate and map AI suggestions to expected schema
    function mapSuggestion(suggestion) {
      // Define expected fields and types
      return {
        title: typeof suggestion.title === 'string' ? suggestion.title : '',
        description: typeof suggestion.description === 'string' ? suggestion.description : '',
        colorScheme: typeof suggestion.colorScheme === 'string' ? suggestion.colorScheme : '',
        style: typeof suggestion.style === 'string' ? suggestion.style : '',
        elements: Array.isArray(suggestion.elements) ? suggestion.elements : [],
        generatedAt: new Date()
      };
    }
    setDesign.aiIterations = suggestions.map(mapSuggestion);

    // Store the full conversation as final prompt context
    setDesign.finalAiPrompt = conversationSummary;

    // Update status to design_approved (waiting for customer selection)
    setDesign.status = AI_SET_DESIGN_STATUS.DRAFTING; // Still drafting until they select

    await setDesign.save();

    return {
      setDesignId: setDesign._id,
      suggestions: setDesign.aiIterations,
      iterationCount: setDesign.aiIterations.length,
      conversationSummary
    };

  } catch (error) {
    logger.error('Error generating designs from chat:', error);
    throw new Error('Failed to generate designs: ' + error.message);
  }
};

// #endregion