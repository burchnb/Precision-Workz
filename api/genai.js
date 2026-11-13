import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
const apiKey = "AQ.Ab8RN6KxpNYiTAXpbQKneZ5oJ84sZkPB7wvurLHw6PZeWhQN6Q";
export function getGenAI(){
    return [new GoogleGenAI({ apiKey }), Type];
}