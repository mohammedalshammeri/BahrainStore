"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Bot, Send, Sparkles, Loader2, Trash2, ChevronRight, Zap, TrendingUp, Package, MessageSquare } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "merchant" | "assistant";
  message: string;
  createdAt: string;
}

interface Suggestion {
  id: number;
  text: string;
  category: string;
}

export default function AiPage() {
  const { store } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tab, setTab] = useState<"copilot" | "writer" | "analyze">("copilot");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Product writer state
  const [writerForm, setWriterForm] = useState({ productName: "", category: "", price: "", features: "" });
  const [writerResult, setWriterResult] = useState<any>(null);
  const [writerLoading, setWriterLoading] = useState(false);

  // Analysis state
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    if (store) {
      loadHistory();
      loadSuggestions();
    }
  }, [store]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadHistory = async () => {
    try {
      const res = await api.get(`/ai/copilot/history?storeId=${store?.id}&limit=50`);
      setMessages(res.data.history || []);
    } catch {}
  };

  const loadSuggestions = async () => {
    try {
      const res = await api.get("/ai/copilot/suggestions");
      setSuggestions(res.data.suggestions || []);
    } catch {}
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || !store) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "merchant",
      message: msg,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/ai/copilot", { storeId: store.id, message: msg });
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        message: res.data.response,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        message: "عذراً، حدث خطأ. تأكد من إعداد مفتاح OpenAI في إعدادات المنصة.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm("هل تريد مسح سجل المحادثة?")) return;
    try {
      await api.delete(`/ai/copilot/history?storeId=${store?.id}`);
      setMessages([]);
    } catch {}
  };

  const runProductWriter = async () => {
    if (!writerForm.productName || !store) return;
    setWriterLoading(true);
    setWriterResult(null);
    try {
      const res = await api.post("/ai/product-writer", {
        storeId: store.id,
        productName: writerForm.productName,
        category: writerForm.category || undefined,
        price: writerForm.price ? parseFloat(writerForm.price) : undefined,
        features: writerForm.features ? writerForm.features.split("\n").filter(Boolean) : undefined,
        language: "both",
      });
      setWriterResult(res.data.data);
    } catch {
      alert("فشل توليد المحتوى");
    } finally {
      setWriterLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!store) return;
    setAnalysisLoading(true);
    setAnalysis(null);
    try {
      const res = await api.post("/ai/analyze-store", { storeId: store.id });
      setAnalysis(res.data);
    } catch {
      alert("فشل تحليل المتجر");
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">بازار AI</h1>
              <p className="text-sm text-slate-500">مساعدك الذكي لتنمية متجرك</p>
            </div>
          </div>
          <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
            {[
              { id: "copilot", label: "المساعد", icon: MessageSquare },
              { id: "writer", label: "كاتب المنتجات", icon: Sparkles },
              { id: "analyze", label: "تحليل المتجر", icon: TrendingUp },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  tab === t.id ? "bg-white shadow text-indigo-600" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Copilot Tab */}
      {tab === "copilot" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Suggestions sidebar */}
          <div className="w-72 border-r bg-white p-4 overflow-y-auto hidden lg:block">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">اقتراحات</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => sendMessage(s.text)}
                  className="w-full text-right text-sm text-slate-700 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg px-3 py-2 transition-colors"
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                    <Bot className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">بازار كوبايلوت</h2>
                  <p className="text-slate-500 max-w-md">
                    أنا مساعدك الذكي. اسألني عن أداء متجرك، أفضل أوقات العروض، كيفية زيادة المبيعات، وأكثر!
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "merchant" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-2 shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-lg rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      msg.role === "merchant"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-white border text-slate-800 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t bg-white p-4">
              <div className="flex gap-3">
                <button onClick={clearHistory} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="مسح المحادثة">
                  <Trash2 className="h-5 w-5" />
                </button>
                <div className="flex-1 flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="اسألني أي شيء عن متجرك..."
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                    className="flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Writer Tab */}
      {tab === "writer" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                كاتب المنتجات الذكي
              </h2>
              <p className="text-sm text-slate-500 mb-6">أدخل اسم المنتج وسيقوم AI بكتابة الوصف الكامل تلقائياً</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم المنتج *</label>
                  <input
                    value={writerForm.productName}
                    onChange={(e) => setWriterForm((p) => ({ ...p, productName: e.target.value }))}
                    placeholder="مثال: حذاء رياضي نايك أير ماكس"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
                    <input
                      value={writerForm.category}
                      onChange={(e) => setWriterForm((p) => ({ ...p, category: e.target.value }))}
                      placeholder="أحذية رياضية"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">السعر (BHD)</label>
                    <input
                      type="number"
                      value={writerForm.price}
                      onChange={(e) => setWriterForm((p) => ({ ...p, price: e.target.value }))}
                      placeholder="29.900"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المميزات (سطر لكل ميزة)</label>
                  <textarea
                    value={writerForm.features}
                    onChange={(e) => setWriterForm((p) => ({ ...p, features: e.target.value }))}
                    placeholder={"مقاومة للماء\nرغوة هوائية للراحة\nمقاس كبير"}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={runProductWriter}
                  disabled={writerLoading || !writerForm.productName}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {writerLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  {writerLoading ? "جاري التوليد..." : "توليد المحتوى"}
                </button>
              </div>
            </div>

            {writerResult && (
              <div className="bg-white rounded-2xl border p-6 space-y-6">
                <h3 className="font-bold text-slate-900">النتائج</h3>
                {writerResult.ar && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-3">بالعربية</p>
                    <div className="space-y-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">وصف قصير</p>
                        <p className="text-sm">{writerResult.ar.shortDescription}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">وصف تفصيلي</p>
                        <p className="text-sm">{writerResult.ar.longDescription}</p>
                      </div>
                      {writerResult.ar.bulletPoints && (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-2">نقاط البيع</p>
                          <ul className="space-y-1">
                            {(Array.isArray(writerResult.ar.bulletPoints) ? writerResult.ar.bulletPoints : [writerResult.ar.bulletPoints]).map((b: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-indigo-500 mt-0.5">•</span> {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {writerResult.raw && <pre className="bg-slate-50 rounded-lg p-4 text-sm overflow-auto whitespace-pre-wrap">{writerResult.raw}</pre>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Tab */}
      {tab === "analyze" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
              <h2 className="text-xl font-bold mb-2">تحليل المتجر الذكي</h2>
              <p className="text-indigo-200 text-sm mb-4">يحلل AI أداء متجرك ويعطيك توصيات مخصصة لزيادة المبيعات</p>
              <button
                onClick={runAnalysis}
                disabled={analysisLoading}
                className="flex items-center gap-2 bg-white text-indigo-600 rounded-xl px-6 py-3 font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                {analysisLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                {analysisLoading ? "جاري التحليل..." : "تحليل متجري الآن"}
              </button>
            </div>

            {analysis && (
              <>
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "الإيرادات (30 يوم)", value: `${Number(analysis.metrics?.revenue || 0).toFixed(3)} BHD` },
                    { label: "الطلبات", value: analysis.metrics?.ordersCount || 0 },
                    { label: "متوسط الطلب", value: `${analysis.metrics?.avgOrderValue || 0} BHD` },
                    { label: "المخزون المنخفض", value: `${analysis.metrics?.lowStockProducts || 0} منتج` },
                  ].map((m, i) => (
                    <div key={i} className="bg-white rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold text-slate-900">{m.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* AI Summary */}
                {analysis.analysis?.summary && (
                  <div className="bg-white rounded-2xl border p-6 mb-6">
                    <h3 className="font-bold text-slate-900 mb-3">ملخص AI</h3>
                    <p className="text-slate-700 text-sm leading-relaxed">{analysis.analysis.summary}</p>
                  </div>
                )}

                {/* AI Insights */}
                {analysis.analysis?.insights?.length > 0 && (
                  <div className="bg-white rounded-2xl border p-6">
                    <h3 className="font-bold text-slate-900 mb-4">التوصيات</h3>
                    <div className="space-y-4">
                      {analysis.analysis.insights.map((insight: any, i: number) => (
                        <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-50">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            insight.priority === "high" ? "bg-red-100 text-red-600" :
                            insight.priority === "medium" ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                          }`}>
                            <Zap className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{insight.title}</p>
                            <p className="text-slate-600 text-sm mt-1">{insight.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
