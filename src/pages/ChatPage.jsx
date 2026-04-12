import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useFinanceContext } from '@/hooks/useFinanceContext'
import { useChatBot } from '@/hooks/useChatBot'
import ChatMessages, { ChatInput } from '@/components/ChatBot/ChatMessages'
import {
  Bot, Plus, Search, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
  DollarSign, PiggyBank, CreditCard, BarChart3, Wallet, Trash2,
  Sparkles,
} from 'lucide-react'

const starterPrompts = [
  { icon: BarChart3, title: 'Analyze my spending', desc: 'Break down where my money went this month', prompt: 'Analyze my spending this month by category' },
  { icon: PiggyBank, title: 'Savings check', desc: 'How much am I saving vs spending?', prompt: "What's my savings rate this month?" },
  { icon: CreditCard, title: 'Card utilization', desc: 'Check credit card balances & limits', prompt: 'Show my credit card utilization' },
  { icon: Wallet, title: 'Budget status', desc: 'Am I on track with my budgets?', prompt: 'Am I over budget this month?' },
  { icon: DollarSign, title: 'Top merchants', desc: 'Where am I spending the most?', prompt: 'What are my top merchants this month?' },
  { icon: Sparkles, title: 'Financial tips', desc: 'Get personalized money advice', prompt: 'Give me 3 actionable tips to improve my finances based on my data' },
]

export default function ChatPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const financeContext = useFinanceContext()
  const { messages, isStreaming, sendMessage, stopStreaming, clearMessages } = useChatBot(financeContext)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [inputValue, setInputValue] = useState('')

  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue('')
  }

  const handleStarterClick = (prompt) => {
    setInputValue('')
    sendMessage(prompt)
  }

  return (
    <div className="flex h-[calc(100vh-56px)] md:h-screen overflow-hidden">

      {/* Chat Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'w-72' : 'w-0'}
        shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-out border-r
        ${isDark ? 'bg-brand-bg border-brand-border' : 'bg-slate-50 border-slate-200'}
      `}>
        {/* Sidebar header */}
        <div className={`px-3 py-3 flex items-center gap-2 shrink-0 border-b ${isDark ? 'border-brand-border' : 'border-slate-200'}`}>
          <button
            onClick={clearMessages}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer
              transition-colors border
              ${isDark
                ? 'bg-brand-primary/15 border-brand-primary/30 text-brand-secondary hover:bg-brand-primary/25'
                : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary hover:bg-brand-primary/15'}
            `}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center mb-3">
            <Bot className="w-5 h-5 text-brand-secondary" />
          </div>
          <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Conversation history will appear here in a future update.
          </p>
        </div>

        {/* Sidebar footer */}
        <div className={`px-3 py-3 border-t shrink-0 ${isDark ? 'border-brand-border' : 'border-slate-200'}`}>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-emerald-500/8' : 'bg-emerald-50'}`}>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className={`text-[10px] font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Finance-only mode</p>
              <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Powered by Claude AI</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`
          px-4 py-3 flex items-center justify-between shrink-0 border-b
          ${isDark ? 'bg-brand-card border-brand-border' : 'bg-white border-slate-200'}
        `}>
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className={`p-2 rounded-lg cursor-pointer transition-colors mr-1 ${isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-brand-card" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>FinFlow Assistant</h3>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {isStreaming ? 'Generating response...' : financeContext ? 'Connected to your data' : 'No financial data yet'}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${
                isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Messages or empty state */}
        {messages.length === 0 && !isStreaming ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center mb-6 shadow-lg shadow-brand-primary/20">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              How can I help with your finances?
            </h2>
            <p className={`text-sm mb-8 max-w-md text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {financeContext
                ? 'I have access to your spending, budgets, and account data. Ask me anything!'
                : 'Upload bank statements first, then I can give personalized insights.'}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
              {starterPrompts.map((sp, i) => {
                const Icon = sp.icon
                return (
                  <button
                    key={i}
                    onClick={() => handleStarterClick(sp.prompt)}
                    className={`
                      text-left p-4 rounded-xl border cursor-pointer transition-all group
                      ${isDark
                        ? 'bg-white/[0.03] border-brand-border hover:bg-white/[0.06] hover:border-brand-secondary/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-brand-primary/30'}
                    `}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isDark ? 'text-brand-secondary' : 'text-brand-primary'} group-hover:scale-110 transition-transform`} />
                    <p className={`text-sm font-medium mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{sp.title}</p>
                    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sp.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            isStreaming={isStreaming}
            isDark={isDark}
            avatarSize="md"
            className="flex-1 py-4 px-2"
          />
        )}

        {/* Input */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              isStreaming={isStreaming}
              onStop={stopStreaming}
              isDark={isDark}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
