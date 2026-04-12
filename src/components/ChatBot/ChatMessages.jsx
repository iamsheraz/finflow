import { useEffect, useRef } from 'react'
import { Bot, Sparkles, AlertCircle, Square, Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react'

/**
 * Parses markdown text into styled React elements.
 * Supports: **bold**, ## headings, - bullet lists, 💡/🔹 emoji hints
 */
function renderContent(text, isDark) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []
  let listItems = []
  let listKey = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="space-y-1.5 my-2">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  const formatInline = (str, key) => {
    // Bold + normal text
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${key}-b-${i}`} className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      flushList()
      return
    }

    // Heading ## or ###
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      flushList()
      const level = trimmed.startsWith('### ') ? 3 : 2
      const headingText = trimmed.replace(/^#{2,3}\s+/, '')
      elements.push(
        <div key={`h-${idx}`} className={`flex items-center gap-2 mt-3 mb-1.5 ${idx === 0 ? 'mt-0' : ''}`}>
          <div className={`w-1 h-4 rounded-full ${isDark ? 'bg-brand-secondary' : 'bg-brand-primary'}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-brand-secondary' : 'text-brand-primary'}`}>
            {formatInline(headingText, `h-${idx}`)}
          </span>
        </div>
      )
      return
    }

    // Bullet list items: - text or * text
    if (/^[-*•]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*•]\s+/, '')

      // Detect special bullets with emoji
      const isTip = content.startsWith('💡') || content.toLowerCase().startsWith('tip:')
      const isWarning = content.includes('⚠') || content.toLowerCase().includes('warning') || content.toLowerCase().includes('over budget') || content.toLowerCase().includes('exceeded')
      const isSuccess = content.includes('✅') || content.includes('✓')

      let dotColor = isDark ? 'bg-brand-secondary' : 'bg-brand-primary'
      if (isWarning) dotColor = 'bg-amber-500'
      if (isSuccess) dotColor = 'bg-emerald-500'
      if (isTip) dotColor = 'bg-violet-500'

      listItems.push(
        <li key={`li-${idx}`} className="flex items-start gap-2.5">
          <span className={`w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${dotColor}`} />
          <span className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {formatInline(content, `li-${idx}`)}
          </span>
        </li>
      )
      return
    }

    // Tip/lightbulb line: 💡 text
    if (trimmed.startsWith('💡') || trimmed.startsWith('🔹') || trimmed.startsWith('📌')) {
      flushList()
      const tipText = trimmed.replace(/^[💡🔹📌]\s*/, '')
      elements.push(
        <div key={`tip-${idx}`} className={`flex items-start gap-2 mt-2 rounded-lg px-3 py-2.5 border ${
          isDark ? 'bg-brand-secondary/5 border-brand-secondary/15' : 'bg-blue-50 border-blue-200'
        }`}>
          <Lightbulb className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isDark ? 'text-brand-secondary' : 'text-brand-primary'}`} />
          <span className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {formatInline(tipText || trimmed, `tip-${idx}`)}
          </span>
        </div>
      )
      return
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={`p-${idx}`} className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        {formatInline(trimmed, `p-${idx}`)}
      </p>
    )
  })

  flushList()
  return <div className="space-y-1">{elements}</div>
}

/**
 * Bot avatar component
 */
function BotAvatar({ isDark, size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-brand-primary/20' : 'bg-brand-primary/10'}`}>
      <Bot className={`${iconSize} text-brand-secondary`} />
    </div>
  )
}

/**
 * Typing indicator (animated dots)
 */
function TypingIndicator({ isDark }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1.5">
      <BotAvatar isDark={isDark} />
      <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

/**
 * Single message bubble
 */
function MessageBubble({ message, isDark, avatarSize }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end py-1.5">
        <div className="max-w-[80%]">
          <div className="bg-brand-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Bot message
  const isError = message.isError
  return (
    <div className="flex items-start gap-2 py-1.5">
      <BotAvatar isDark={isDark} size={avatarSize} />
      <div className="max-w-[85%]">
        <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${
          isError
            ? isDark ? 'bg-red-500/5 border border-red-500/15 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
            : isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
        }`}>
          {isError && <AlertCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />}
          {renderContent(message.content, isDark)}
        </div>
      </div>
    </div>
  )
}

/**
 * Chat messages list — shared between widget and full-page views.
 */
export default function ChatMessages({
  messages,
  isStreaming,
  isDark,
  avatarSize = 'sm',
  className = '',
}) {
  const bottomRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  return (
    <div className={`overflow-y-auto ${className}`}>
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full px-6 py-12">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center mb-4 shadow-lg shadow-brand-primary/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            FinFlow Assistant
          </p>
          <p className={`text-xs text-center max-w-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Ask about your spending, budgets, subscriptions, or any personal finance question.
          </p>
        </div>
      )}

      <div className="px-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isDark={isDark} avatarSize={avatarSize} />
        ))}
        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <TypingIndicator isDark={isDark} />
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}

/**
 * Chat input component — shared between widget and full-page views.
 */
export function ChatInput({
  value,
  onChange,
  onSend,
  isStreaming,
  onStop,
  isDark,
  placeholder = 'Ask about your finances...',
  className = '',
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className={className}>
      <div className={`
        flex items-end gap-2 rounded-xl px-4 py-2.5 border transition-colors
        ${isDark
          ? 'bg-brand-bg border-brand-border focus-within:border-brand-secondary/40'
          : 'bg-slate-50 border-slate-200 focus-within:border-brand-primary/40'}
      `}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className={`
            flex-1 bg-transparent text-sm outline-none resize-none placeholder:text-slate-500
            max-h-24 leading-relaxed
            ${isDark ? 'text-white' : 'text-slate-900'}
          `}
          onInput={(e) => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
          }}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
            aria-label="Stop generating"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!value.trim()}
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all shrink-0
              ${value.trim()
                ? 'bg-brand-primary text-white hover:bg-brand-primary/80'
                : `${isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-200 text-slate-400'} cursor-not-allowed`}
            `}
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      <p className={`text-center text-[9px] mt-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        FinFlow AI only answers finance-related questions
      </p>
    </div>
  )
}
