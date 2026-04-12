import { useState, useCallback, useRef } from 'react'

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || '/api/chat'

/**
 * Chat hook with SSE streaming support.
 * Manages conversation history, streaming state, and error handling.
 */
export function useChatBot(financeContext) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || isStreaming) return

    const userMsg = { id: Date.now(), role: 'user', content: userMessage.trim() }
    const botMsg = { id: Date.now() + 1, role: 'bot', content: '' }

    setMessages(prev => [...prev, userMsg, botMsg])
    setIsStreaming(true)
    setError(null)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      // Build messages array for API (all history + new message)
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content,
      }))

      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          financeContext: financeContext || null,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `API error: ${response.status}`)
      }

      // Read SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              fullText += parsed.text
              setMessages(prev =>
                prev.map(m => m.id === botMsg.id ? { ...m, content: fullText } : m)
              )
            }
            if (parsed.error) {
              throw new Error(parsed.error)
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') {
              // Only throw real errors, not parse failures from partial chunks
              if (e.message && !e.message.includes('JSON')) throw e
            }
          }
        }
      }

      // If we got no content at all, show an error
      if (!fullText) {
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
      abortRef.current = null
    }
  }, [messages, isStreaming, financeContext])

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      setIsStreaming(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  }
}
