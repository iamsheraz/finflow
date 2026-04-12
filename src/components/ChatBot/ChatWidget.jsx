import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useFinanceContext } from '@/hooks/useFinanceContext'
import { useChatBot } from '@/hooks/useChatBot'
import ChatMessages, { ChatInput } from './ChatMessages'
import {
  MessageCircle, X, Bot, DollarSign, PiggyBank, CreditCard, TrendingUp, Maximize2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const quickPrompts = [
  { icon: DollarSign, label: 'Spending', prompt: 'How much did I spend this month?' },
  { icon: PiggyBank, label: 'Savings', prompt: "What's my savings rate?" },
  { icon: CreditCard, label: 'Cards', prompt: 'Show credit card utilization' },
  { icon: TrendingUp, label: 'Subscriptions', prompt: 'What subscriptions am I paying?' },
]

export default function ChatWidget() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const financeContext = useFinanceContext()
  const { messages, isStreaming, sendMessage, stopStreaming, clearMessages } = useChatBot(financeContext)
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue('')
  }

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/30 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200"
          aria-label="Open finance assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`
            fixed bottom-6 right-6 z-50
            w-[380px] max-h-[600px] h-[85vh]
            rounded-2xl overflow-hidden flex flex-col
            shadow-2xl shadow-black/40 border
            ${isDark ? 'bg-brand-card border-brand-border' : 'bg-white border-slate-200'}
          `}
          style={{ animation: 'chatSlideUp 0.25s ease-out' }}
        >
          {/* Header */}
          <div className={`
            px-4 py-3 flex items-center justify-between shrink-0 border-b
            ${isDark
              ? 'bg-gradient-to-r from-brand-primary/15 to-brand-card border-brand-border'
              : 'bg-gradient-to-r from-brand-primary/5 to-white border-slate-200'}
          `}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-brand-card" />
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>FinFlow Assistant</h3>
                <p className={`text-[10px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {isStreaming ? 'Thinking...' : 'Online — Finance only'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('/chat')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                aria-label="Open full page"
                title="Open full page"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <ChatMessages
            messages={messages}
            isStreaming={isStreaming}
            isDark={isDark}
            className="flex-1 py-3"
          />

          {/* Quick prompts (only show when no messages) */}
          {messages.length === 0 && (
            <div className={`px-3 py-2 border-t shrink-0 ${isDark ? 'border-brand-border' : 'border-slate-200'}`}>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {quickPrompts.map((qp, i) => {
                  const Icon = qp.icon
                  return (
                    <button
                      key={i}
                      onClick={() => { setInputValue(qp.prompt) }}
                      className={`
                        shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer
                        transition-colors border
                        ${isDark
                          ? 'bg-white/5 border-brand-border text-slate-300 hover:bg-white/10'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}
                      `}
                    >
                      <Icon className="w-3 h-3" />
                      {qp.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Input */}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            isStreaming={isStreaming}
            onStop={stopStreaming}
            isDark={isDark}
            className="px-3 pb-3 pt-1 shrink-0"
          />
        </div>
      )}

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  )
}
