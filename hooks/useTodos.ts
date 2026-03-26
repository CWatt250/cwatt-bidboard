'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkspaceTodo } from '@/lib/supabase/types'

interface UseTodosResult {
  todos: WorkspaceTodo[]
  loading: boolean
  addTodo: (text: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  clearCompleted: () => Promise<void>
}

export function useTodos(): UseTodosResult {
  const [todos, setTodos] = useState<WorkspaceTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  const fetchTodos = useCallback(async (uid: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('workspace_todos')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })

    if (!error) {
      setTodos(data ?? [])
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    setLoading(true)
    fetchTodos(userId).finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel('workspace_todos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTodos((prev) => [...prev, payload.new as WorkspaceTodo])
          } else if (payload.eventType === 'UPDATE') {
            setTodos((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as WorkspaceTodo) : t))
            )
          } else if (payload.eventType === 'DELETE') {
            setTodos((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchTodos])

  const addTodo = useCallback(async (text: string) => {
    if (!userId) return
    const trimmed = text.trim()
    if (!trimmed) return
    const supabase = createClient()
    await supabase.from('workspace_todos').insert({
      user_id: userId,
      text: trimmed,
      is_completed: false,
    })
  }, [userId])

  const toggleTodo = useCallback(async (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return
    const supabase = createClient()
    await supabase
      .from('workspace_todos')
      .update({ is_completed: !todo.is_completed })
      .eq('id', id)
  }, [todos])

  const clearCompleted = useCallback(async () => {
    if (!userId) return
    const supabase = createClient()
    await supabase
      .from('workspace_todos')
      .delete()
      .eq('user_id', userId)
      .eq('is_completed', true)
  }, [userId])

  return { todos, loading, addTodo, toggleTodo, clearCompleted }
}
