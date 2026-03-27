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
      .channel(`workspace_todos-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workspace_todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setTodos((prev) => {
            // Avoid duplicates (optimistic update may have already added it)
            if (prev.some((t) => t.id === payload.new.id)) return prev
            return [...prev, payload.new as WorkspaceTodo]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workspace_todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setTodos((prev) =>
            prev.map((t) => (t.id === payload.new.id ? (payload.new as WorkspaceTodo) : t))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'workspace_todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setTodos((prev) => prev.filter((t) => t.id !== payload.old.id))
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

    // Optimistic: add immediately with a temp id
    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    const optimistic: WorkspaceTodo = {
      id: tempId,
      user_id: userId,
      text: trimmed,
      is_completed: false,
      created_at: now,
      updated_at: now,
    }
    setTodos((prev) => [...prev, optimistic])

    const supabase = createClient()
    const { data, error } = await supabase
      .from('workspace_todos')
      .insert({ user_id: userId, text: trimmed, is_completed: false })
      .select()
      .single()

    if (error || !data) {
      // Roll back optimistic update
      setTodos((prev) => prev.filter((t) => t.id !== tempId))
      return
    }

    // Replace temp with real record
    setTodos((prev) =>
      prev.map((t) => (t.id === tempId ? (data as WorkspaceTodo) : t))
    )
  }, [userId])

  const toggleTodo = useCallback(async (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return
    // Optimistic toggle
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_completed: !t.is_completed } : t))
    )
    const supabase = createClient()
    const { error } = await supabase
      .from('workspace_todos')
      .update({ is_completed: !todo.is_completed })
      .eq('id', id)
    if (error) {
      // Roll back
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_completed: todo.is_completed } : t))
      )
    }
  }, [todos])

  const clearCompleted = useCallback(async () => {
    if (!userId) return
    const completed = todos.filter((t) => t.is_completed)
    if (completed.length === 0) return
    // Optimistic remove
    setTodos((prev) => prev.filter((t) => !t.is_completed))
    const supabase = createClient()
    const { error } = await supabase
      .from('workspace_todos')
      .delete()
      .eq('user_id', userId)
      .eq('is_completed', true)
    if (error) {
      // Roll back
      setTodos((prev) => [...prev, ...completed].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ))
    }
  }, [userId, todos])

  return { todos, loading, addTodo, toggleTodo, clearCompleted }
}
