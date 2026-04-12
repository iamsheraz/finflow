import { useState, useCallback, useRef } from 'react'
import { CHAT_TOOLS } from '@/lib/chatTools'
import { executeToolCall } from '@/lib/chatToolExecutor'

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || '/api/chat'

/**
 * Chat hook with tool_use support and full conversation memory.
 *
 * Maintains two message arrays:
 * - `messages` (display) — what the user sees (user text + bot text)
 * - `apiHistory` (ref) — full API conversation including tool_use/tool_result blocks
 *
 * This ensures Claude has context of all previous questions and tool calls.
 */
export function useChatBot(financeContext) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolStatus, setToolStatus] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const apiHistoryRef = useRef([]) // Full API message history with tool blocks

  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || isStreaming) return

    const userMsg = { id: Date.now(), role: 'user', content: userMessage.trim() }
    const botMsg = { id: Date.now() + 1, role: 'bot', content: '' }

    setMessages(prev => [...prev, userMsg, botMsg])
    setIsStreaming(true)
    setError(null)
    setToolStatus(null)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      // Add user message to API history
      apiHistoryRef.current.push({ role: 'user', content: userMessage.trim() })

      // Working copy of messages for this turn's tool loop
      let turnMessages = [...apiHistoryRef.current]

      // Step 1: Call with tools (non-streaming)
      let claudeResponse = await callAPI(turnMessages, true, abortController.signal)

      // Step 2: Tool use loop
      let maxIterations = 5
      while (claudeResponse.stop_reason === 'tool_use' && maxIterations > 0) {
        maxIterations--

        const toolUseBlocks = claudeResponse.content.filter(b => b.type === 'tool_use')
        const textBlocks = claudeResponse.content.filter(b => b.type === 'text')

        // Show intermediate text
        if (textBlocks.length > 0) {
          const intermediateText = textBlocks.map(b => b.text).join('')
          if (intermediateText.trim()) {
            setMessages(prev =>
              prev.map(m => m.id === botMsg.id ? { ...m, content: intermediateText } : m)
            )
          }
        }

        // Execute tools client-side
        const toolResults = []
        for (const toolCall of toolUseBlocks) {
          setToolStatus(getToolStatusMessage(toolCall.name))
          const result = await executeToolCall(toolCall.name, toolCall.input)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: result,
          })
        }

        // Add assistant + tool results to turn messages
        turnMessages.push({ role: 'assistant', content: claudeResponse.content })
        turnMessages.push({ role: 'user', content: toolResults })

        setToolStatus('Analyzing your data...')

        // Call again with tool results
        claudeResponse = await callAPI(turnMessages, true, abortController.signal)
      }

      setToolStatus(null)

      // Step 3: Extract final text
      const finalText = claudeResponse.content
        ?.filter(b => b.type === 'text')
        .map(b => b.text)
        .join('') || ''

      // Save the full turn to API history (assistant response + any tool blocks from this turn)
      // We store the intermediate tool messages and the final response
      const turnNewMessages = turnMessages.slice(apiHistoryRef.current.length)
      apiHistoryRef.current.push(...turnNewMessages)
      apiHistoryRef.current.push({ role: 'assistant', content: claudeResponse.content })

      // Trim API history to prevent context overflow (keep last ~30 messages)
      if (apiHistoryRef.current.length > 30) {
        apiHistoryRef.current = apiHistoryRef.current.slice(-30)
      }

      if (finalText) {
        setMessages(prev =>
          prev.map(m => m.id === botMsg.id ? { ...m, content: finalText } : m)
        )
      } else {
        setMessages(prev =>
          prev.map(m => m.id === botMsg.id
            ? { ...m, content: 'Sorry, I couldn\'t generate a response. Please try again.' }
            : m
          )
        )
      }
    } catch (err) {
      if (err.name === 'AbortError') return

      setError(err.message)
      setMessages(prev =>
        prev.map(m => m.id === botMsg.id
          ? { ...m, content: `Error: ${err.message}. Please try again.`, isError: true }
          : m
        )
      )
    } finally {
      setIsStreaming(false)
      setToolStatus(null)
      abortRef.current = null
    }
  }, [messages, isStreaming, financeContext])

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      setIsStreaming(false)
      setToolStatus(null)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    apiHistoryRef.current = []
    setError(null)
    setToolStatus(null)
  }, [])

  return {
    messages,
    isStreaming,
    toolStatus,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  }

  /** Helper to call the chat API */
  async function callAPI(msgs, withTools, signal) {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: msgs,
        financeContext: financeContext || null,
        tools: withTools ? CHAT_TOOLS : undefined,
        stream: false,
      }),
      signal,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || `API error: ${response.status}`)
    }

    return response.json()
  }
}

function getToolStatusMessage(toolName) {
  const labels = {
    search_transactions: 'Searching your transactions...',
    sum_spending: 'Calculating your spending...',
    get_spending_by_category: 'Breaking down by category...',
    get_budget_status: 'Checking your budgets...',
    get_account_summary: 'Looking up your accounts...',
    get_recurring_expenses: 'Finding recurring expenses...',
    get_top_merchants: 'Finding top merchants...',
    get_income_summary: 'Checking your income...',
  }
  return labels[toolName] || 'Looking up your data...'
}
