
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useApp } from '../store.tsx';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, ChevronDown } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const GeminiAssistant: React.FC = () => {
  const { employees, centers, attendance, settings } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const generateContext = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendance.filter(a => a.date === today);
    const activeCenters = centers.filter(c => c.isActive);
    
    return `
      أنت المساعد الذكي لنظام "Relief Experts Management".
      إليك بيانات النظام اللحظية الحالية:
      - عدد الموظفين الإجمالي: ${employees.length}
      - عدد المراكز النشطة: ${activeCenters.length}
      - سجلات الحضور اليوم (${today}): ${todayRecords.length}
      - حالات التأخير المرصودة اليوم: ${todayRecords.filter(r => r.status === 'late').length}
      - اسم النظام الحالي: ${settings.systemName}
      
      تعليمات:
      1. أجب باختصار شديد ولباقة.
      2. لا تذكر أي بيانات تقنية عن قاعدة البيانات.
      3. إذا سألك الموظف عن حالته، أخبره بالتوجه لسجل التقارير.
      4. لغة الإجابة: العربية دائماً.
    `;
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      // Initialize AI according to standards
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMessage,
        config: {
          systemInstruction: generateContext(),
          temperature: 0.7,
        },
      });

      const reply = response.text || 'عذراً، لم أستطع فهم ذلك. هل يمكنك إعادة الصياغة؟';
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (error) {
      console.error('Gemini Assistant Error:', error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: 'حدث خطأ تقني أثناء الاتصال بالمساعد الذكي. يرجى التحقق من مفتاح الـ API في إعدادات Vercel.' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-8 left-8 z-[100] font-cairo" dir="rtl">
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 transform hover:scale-110 active:scale-90 ${
          isOpen ? 'bg-slate-900 rotate-90' : 'bg-indigo-600'
        }`}
      >
        {isOpen ? <X className="w-8 h-8 text-white" /> : <Bot className="w-8 h-8 text-white animate-pulse" />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center">
             <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
          </div>
        )}
      </button>

      {/* Chat Window */}
      <div className={`absolute bottom-20 left-0 w-[350px] md:w-[400px] bg-white rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-slate-100 flex flex-col transition-all duration-500 origin-bottom-left ${
        isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'
      }`}>
        {/* Header */}
        <div className="p-6 bg-slate-900 rounded-t-[2.5rem] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black">مساعد Relief Experts</h4>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">AI Strategic Analyst</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Space */}
        <div 
          ref={scrollRef}
          className="flex-1 h-[400px] overflow-y-auto p-6 space-y-4 bg-slate-50/50 custom-scrollbar"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Bot className="w-12 h-12 text-indigo-600" />
              <p className="text-xs font-bold text-slate-500">مرحباً! أنا مساعدك الذكي. يمكنني مساعدتك في تحليل بيانات الحضور أو الإجابة على استفساراتك حول النظام.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold leading-relaxed ${
                msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-100' 
                : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-[10px] font-black text-slate-400 uppercase">جاري التفكير...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white rounded-b-[2.5rem] border-t border-slate-50">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="اسألني أي شيء عن النظام..."
              className="w-full pr-6 pl-14 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute left-2 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-black transition-all disabled:opacity-20 active:scale-95 shadow-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiAssistant;
