
import { GoogleGenAI, Chat, GenerateContentResponse, Part, Content } from "@google/genai";
import { ChatMessage, FileAttachment } from '../types';
import { LLM_MODEL_NAME } from '../constants';

let ai: GoogleGenAI | null = null;

export const initializeGemini = (apiKey: string): boolean => {
  if (!apiKey) {
    console.error("API Key is missing. Gemini AI will not be available.");
    ai = null;
    return false;
  }
  try {
    ai = new GoogleGenAI({ apiKey });
    return true;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    ai = null;
    return false;
  }
};

export const isGeminiAvailable = (): boolean => !!ai;

export const startChatSession = (
  systemInstructionText: string,
  chatHistoryToLoad?: ChatMessage[]
): Chat | null => {
  if (!ai) return null;

  const geminiHistory: Content[] = (chatHistoryToLoad || [])
    .filter(msg => msg.sender === 'user' || msg.sender === 'ai') // Only user/ai turns for history
    .map(msg => {
        const parts: Part[] = [{ text: msg.text }];
        // For full fidelity re-chat, attachments from history might need to be processed here.
        // This is a complex feature. For now, text from history is included.
        // The RECHAT_SYSTEM_PROMPT can remind the AI about previous context.
        // If msg.attachments exist, they could be converted to Parts if needed and supported by API.
        // For simplicity in this iteration, only text parts are included from history.
        return {
            role: msg.sender === 'ai' ? 'model' : 'user',
            parts: parts
        };
  });
  
  return ai.chats.create({
    model: LLM_MODEL_NAME,
    config: {
      systemInstruction: systemInstructionText,
    },
    // Only provide history if it's not empty
    history: geminiHistory.length > 0 ? geminiHistory : undefined,
  });
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
  const base64EncodedString = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      mimeType: file.type,
      data: base64EncodedString,
    },
  };
};


export const sendMessageToChatStream = async (
  chat: Chat,
  messageText: string,
  attachments: FileAttachment[] = []
): Promise<AsyncIterableIterator<GenerateContentResponse>> => {
  if (!ai) throw new Error("Gemini AI not initialized.");

  const parts: Part[] = [{ text: messageText }];

  for (const attachment of attachments) {
    // Currently, Gemini API for chat might prefer images.
    // Adjust based on what the model version supports best in chat.
    if (attachment.file.type.startsWith('image/')) { 
        try {
            const imagePart = await fileToGenerativePart(attachment.file);
            parts.push(imagePart);
        } catch (error) {
            console.error(`Failed to process attachment ${attachment.name}:`, error);
            parts.push({text: `[System: Failed to process attachment ${attachment.name}]` });
        }
    } else {
        // For non-image files, inform the LLM about the attachment.
        parts.push({text: `[System: User attached a file named "${attachment.name}" of type ${attachment.file.type}. Content not directly viewable by AI in this turn.]` });
    }
  }
  
  return chat.sendMessageStream({ message: parts });
};
