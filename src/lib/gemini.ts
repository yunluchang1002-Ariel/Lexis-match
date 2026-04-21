import { GoogleGenAI, Type } from "@google/genai";
import { WordPair, Difficulty, ReviewItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateWordPairs(category: string, difficulty: Difficulty, excludeWords: string[] = []): Promise<WordPair[]> {
  const prompt = `Generate a list of 8 unique English word-synonym pairs for a language learning game.
  Specific Category: ${category}
  Exam/Domain Context: ${category === '大学英语四六级' ? 'College English Test (CET-4 and CET-6) vocabulary used in China.' : category}
  Complexity Level: ${difficulty}
  
  ${excludeWords.length > 0 ? `CRITICAL: Do NOT include any of the following words in this list as they were just used: ${excludeWords.join(', ')}.` : ''}

  Instructions:
  1. The word and its synonym should be at the level typically found in ${category} exams.
  2. For ${category}, prioritize vocabulary that is frequently tested.
  3. Ensure the pairs are clear and accurate.
  4. Ensure ALL 8 pairs are completely new and different from the excluded list.
  
  Return only the JSON array of objects with 'word' and 'synonym' keys.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              synonym: { type: Type.STRING },
            },
            required: ['word', 'synonym'],
          },
        },
      },
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Error generating word pairs:", error);
    return [
      { word: "Happy", synonym: "Joyful" },
      { word: "Big", synonym: "Large" },
      { word: "Small", synonym: "Tiny" },
      { word: "Fast", synonym: "Quick" },
      { word: "Smart", synonym: "Intelligent" },
      { word: "Beautiful", synonym: "Lovely" },
      { word: "Cold", synonym: "Chilly" },
      { word: "Hard", synonym: "Difficult" },
    ];
  }
}

export async function enhanceReviewList(pairs: WordPair[], category: string): Promise<ReviewItem[]> {
  if (pairs.length === 0) return [];
  
  const prompt = `For the following English synonym pairs used in the context of ${category}, provide:
  1. The International Phonetic Alphabet (IPA) transcription for the 'word'.
  2. The most frequent Chinese meaning in the context of ${category} for the pair.
  
  Pairs:
  ${JSON.stringify(pairs)}
  
  Return only the JSON array of objects with keys: 'word', 'synonym', 'phonetic', 'meaning'.
  Ensure accuracy for the exam context: ${category}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              synonym: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              meaning: { type: Type.STRING },
            },
            required: ['word', 'synonym', 'phonetic', 'meaning'],
          },
        },
      },
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Error enhancing review list:", error);
    return pairs.map(p => ({ ...p, phonetic: '[N/A]', meaning: 'Review required' }));
  }
}
