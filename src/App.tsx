import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Loader2, Send, CheckCircle2, TrendingUp, HelpCircle, BookOpen, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface RubricItem {
  criterion: string;
  level: string;
}

interface Feedback {
  rubric: RubricItem[];
  glow: string[];
  grow: string[];
  agencyQuestion: string;
  overallGrade: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function App() {
  const [paragraph, setParagraph] = useState('');
  const [level, setLevel] = useState<'A2' | 'B1'>('A2');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const handleAnalyze = async () => {
    if (!paragraph.trim()) return;
    
    setLoading(true);
    setError('');
    setFeedback(null);
    setChatHistory([]);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Student Level: ${level}\n\nStudent Paragraph:\n${paragraph}`,
        config: {
          systemInstruction: `You are the "Paragraph Feedback Assistant," a specialized tool for language teachers. Your sole purpose is to evaluate student paragraphs using the provided Rubric.

EVALUATION PROTOCOL:
1. Analyze: Read the student paragraph carefully.
2. Score: Evaluate the text against the 11 criteria in the Rubric:
   - Meeting task requirements
   - Supportive ideas
   - Details
   - Topic sentence
   - Supporting sentences
   - Concluding sentence
   - Logic/Unity
   - Linkers
   - Grammar
   - Vocabulary
   - Mechanics
3. Levels: Use only the levels: Outstanding, Good, Fair, Limited, Weak.
4. Tone: Be encouraging but precise. Use "Socratic feedback" where possible (ask a question to make the student think). Adjust your tone and expectations according to the student's level (A2 or B1).
5. Grading Scale: Calculate an overall letter grade (A, B, C, D, F) based on the 11 criteria scores, adapting your expectations to the target proficiency level (A2 or B1).

CRITICAL RULE FOR LANGUAGE: The students are learning English as a foreign language (EFL). You MUST use very simple, clear, and basic English vocabulary and short sentences. Avoid complex words, idioms, or advanced grammar in your feedback (Glow, Grow, and Agency Question). Write exactly at an ${level} reading level.

OUTPUT FORMAT:
You must return a JSON object containing:
- rubric: An array of exactly 11 objects, each with 'criterion' and 'level'.
- glow: An array of exactly 2 specific things the student did well. Keep the language very simple.
- grow: An array of exactly 2 specific, level-appropriate suggestions for improvement based on the 'Weak' or 'Fair' scores. Keep the language very simple.
- agencyQuestion: A reflective question that forces the student to look at their own writing critically. Keep the language very simple.
- overallGrade: A single letter grade (A, B, C, D, or F) representing the overall performance.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rubric: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    criterion: { type: Type.STRING },
                    level: { type: Type.STRING }
                  },
                  required: ["criterion", "level"]
                }
              },
              glow: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              grow: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              agencyQuestion: { type: Type.STRING },
              overallGrade: { type: Type.STRING }
            },
            required: ["rubric", "glow", "grow", "agencyQuestion", "overallGrade"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        setFeedback(parsed);
      } else {
        setError('Failed to generate feedback. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while analyzing the paragraph.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !feedback) return;
    
    const newUserMsg = { role: 'user' as const, text: question };
    setChatHistory(prev => [...prev, newUserMsg]);
    setQuestion('');
    setIsAsking(true);

    try {
      const historyContents = chatHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      
      historyContents.push({
        role: 'user',
        parts: [{ text: newUserMsg.text }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: historyContents,
        config: {
          systemInstruction: `You are a writing tutor helping an ${level} English student.
The student wrote this paragraph:
"${paragraph}"

They received this feedback:
Strengths: ${feedback.glow.join(' ')}
Areas to improve: ${feedback.grow.join(' ')}

The student is asking for help to improve their writing based on the feedback.

CRITICAL RULE FOR LANGUAGE: The student is learning English as a foreign language (EFL). You MUST use very simple, clear, and basic English vocabulary and short sentences. Avoid complex words, idioms, or advanced grammar. Write exactly at an ${level} reading level.

CRITICAL RULE FOR GUIDANCE: DO NOT provide direct corrections, rewritten sentences, or full answers. Instead, provide simple guiding questions or hints that prompt the student to figure out the correction themselves. Keep your response brief and encouraging.`,
        }
      });

      if (response.text) {
        setChatHistory(prev => [...prev, { role: 'model', text: response.text! }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try asking again.' }]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <BookOpen className="w-6 h-6" />
            <h1 className="font-semibold text-lg tracking-tight text-slate-900">Paragraph Feedback Assistant</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Student Submission</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Student Level</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {(['A2', 'B1'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        level === l 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="paragraph" className="block text-sm font-medium text-slate-700 mb-1">
                  Paragraph Text
                </label>
                <textarea
                  id="paragraph"
                  rows={12}
                  className="w-full rounded-xl border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm resize-none p-4 bg-white outline-none transition-all"
                  placeholder="Paste the student's paragraph here..."
                  value={paragraph}
                  onChange={(e) => setParagraph(e.target.value)}
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={loading || !paragraph.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 px-4 rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Evaluate Paragraph
                  </>
                )}
              </button>
              
              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {!feedback && !loading && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed"
              >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Ready to Evaluate</h3>
                <p className="text-slate-500 max-w-sm">
                  Paste a student's paragraph and click evaluate to generate structured feedback based on the rubric.
                </p>
              </motion.div>
            )}

            {loading && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-200"
              >
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Analyzing Paragraph...</h3>
                <p className="text-slate-500">Evaluating against 11 rubric criteria.</p>
              </motion.div>
            )}

            {feedback && !loading && (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Overall Grade Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Overall Grade</h3>
                    <p className="text-slate-600 text-sm">Based on {level} proficiency expectations</p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-md">
                    {feedback.overallGrade}
                  </div>
                </div>

                {/* Glow & Grow Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-emerald-700 mb-3">
                      <CheckCircle2 className="w-5 h-5" />
                      <h3 className="font-semibold">The "Glow"</h3>
                    </div>
                    <ul className="space-y-2">
                      {feedback.glow.map((item, i) => (
                        <li key={i} className="text-sm text-emerald-900 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-amber-700 mb-3">
                      <TrendingUp className="w-5 h-5" />
                      <h3 className="font-semibold">The "Grow"</h3>
                    </div>
                    <ul className="space-y-2">
                      {feedback.grow.map((item, i) => (
                        <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Agency Question */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-indigo-700 mb-2">
                    <HelpCircle className="w-5 h-5" />
                    <h3 className="font-semibold">Agency Question</h3>
                  </div>
                  <p className="text-indigo-900 text-sm italic">
                    "{feedback.agencyQuestion}"
                  </p>
                </div>

                {/* Rubric Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-900">Rubric Evaluation</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3 font-medium">Criterion</th>
                          <th className="px-5 py-3 font-medium">Achievement Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {feedback.rubric.map((item, i) => {
                          let badgeColor = 'bg-slate-100 text-slate-700';
                          if (item.level === 'Outstanding') badgeColor = 'bg-emerald-100 text-emerald-700';
                          if (item.level === 'Good') badgeColor = 'bg-blue-100 text-blue-700';
                          if (item.level === 'Fair') badgeColor = 'bg-amber-100 text-amber-700';
                          if (item.level === 'Limited') badgeColor = 'bg-orange-100 text-orange-700';
                          if (item.level === 'Weak') badgeColor = 'bg-red-100 text-red-700';

                          return (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 font-medium text-slate-900">
                                {item.criterion}
                              </td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                                  {item.level}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ask for Guidance Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-900">Ask for Guidance</h3>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    <p className="text-sm text-slate-600">
                      Not sure how to improve your "Grow" areas? Ask a question below to get guiding hints (not direct answers!).
                    </p>
                    
                    {chatHistory.length > 0 && (
                      <div className="space-y-4 max-h-80 overflow-y-auto p-2">
                        {chatHistory.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                              msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-sm' 
                                : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        {isAsking && (
                          <div className="flex justify-start">
                            <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-2 text-sm flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Thinking...
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                        placeholder="e.g., How can I make my topic sentence better?"
                        className="flex-1 rounded-xl border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm px-4 py-2 outline-none transition-all"
                      />
                      <button
                        onClick={handleAskQuestion}
                        disabled={isAsking || !question.trim()}
                        className="flex items-center justify-center bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
