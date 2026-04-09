import { GoogleGenAI } from "@google/genai";
import { getStudents } from "./supabase";

const apiKey = process.env.GEMINI_API_KEY;

export const getGeminiResponse = async (message: string, history: { role: "user" | "model"; parts: { text: string }[] }[]) => {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const students = await getStudents();
  const studentContext = JSON.stringify(students, null, 2);

  const response = await ai.models.generateContent({
    model,
    contents: [
        ...history.map(h => ({ role: h.role, parts: h.parts })),
        { role: "user", parts: [{ text: message }] }
    ],
    config: {
        systemInstruction: `You are EduAssist AI, a professional school assistant. 
        You have access to the following real-time student database:
        ${studentContext}
        
        When asked about students, fees, or attendance, use this data to provide accurate answers.
        If a student is not in the list, inform the user politely.
        Always maintain a professional, helpful, and concise tone.
        Use Markdown for formatting tables or lists if needed.`
    }
  });

  return response.text || "I'm sorry, I couldn't process that request.";
};

export const generateDailyInsights = async () => {
  if (!apiKey) return "AI insights are currently unavailable.";

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const students = await getStudents();
  const overdueCount = students.filter(s => s.feeStatus === 'Overdue').length;
  const avgAttendance = students.length > 0 
    ? (students.reduce((sum, s) => sum + s.attendance, 0) / students.length).toFixed(1) 
    : "0";
  
  const prompt = `Analyze this school data and provide 3-4 concise, professional, and actionable daily insights for the school administrator.
  Data:
  - Total Students: ${students.length}
  - Students with Overdue Fees: ${overdueCount}
  - Average Attendance: ${avgAttendance}%
  
  Format the response as a short bulleted list. Focus on trends and urgent actions.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a data analyst for a school. Provide brief, high-impact insights."
      }
    });
    return response.text || "No insights available for today.";
  } catch (error) {
    console.error("Error generating insights:", error);
    return "Failed to generate daily insights.";
  }
};

