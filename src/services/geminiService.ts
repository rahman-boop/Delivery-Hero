import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getChatResponse = async (message: string, history: any[], context: string) => {
  try {
    const systemInstruction = `You are "Delivery Hero", a smart and friendly assistant for a delivery management app. 
    You help users manage orders, calculate earnings, and find information. 
    Current context: ${context}
    
    Personality traits:
    - Use expressive emojis and formatting to make answers look beautiful and organized.
    - Be very polite and helpful.
    - Use relevant emojis like 📦, 🏍️, 💰, ✅, 📍, etc.
    - If user asks about orders, show them in a clean list format.
    - Keep your answers concise yet informative.
    
    You can add orders using the addOrder function.
    Answer in Bengali or English as preferred by the user.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
        tools: [
          {
            functionDeclarations: [
              {
                name: "addOrder",
                description: "Add a new delivery order to the system",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING, description: "Name of the customer" },
                    phoneNumber: { type: Type.STRING, description: "Phone number of the customer" },
                    address: { type: Type.STRING, description: "Delivery address" },
                    orderDetails: { type: Type.STRING, description: "Details of the items ordered" },
                    deliveryCharge: { type: Type.NUMBER, description: "Bill amount or delivery fee" },
                    status: { type: Type.STRING, enum: ["Pending", "Accepted", "On the Way", "Completed", "Cancelled"] }
                  },
                  required: ["customerName", "phoneNumber", "address", "orderDetails", "deliveryCharge"]
                }
              }
            ]
          }
        ],
        toolConfig: { includeServerSideToolInvocations: true }
      },
    });

    return {
      text: response.text || "",
      functionCalls: response.functionCalls
    };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { text: "দুঃখিত, এআই সংযোগে সমস্যা হচ্ছে। আপনার ইন্টারনেট কানেকশন চেক করুন।" };
  }
};
