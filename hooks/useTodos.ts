'use client'

import { useEffect, useState, useCallback } from 'react'
import { startOfWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { WorkspaceTodo } from '@/lib/supabase/types'

interface UseTodosResult {
  todos: WorkspaceTodo[]
  loading: boolean
  addTodo: (text: string) => Promise<void>
  completeTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
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
      // Dismissed tasks stay in the DB for recaps but are hidden from the list.
      .is('dismissed_from_list_at', null)
      .order('created_at', { ascending: true })

    if (!error) {
      setTodos(data ?? [])
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    const uid = userId

    setLoading(true)

    // On load, auto-dismiss completed tasks finished before this week's Monday
    // so the list doesn't accumulate crossed-out items week after week. They
    // stay in the DB (and in past Weekly Recaps) — only hidden from the list.
    async function init() {
      const supabase = createClient()
      const startOfThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
      await supabase
        .from('workspace_todos')
        .update({ dismissed_from_list_at: new Date().toISOString() })
        .eq('user_id', uid)
        .not('completed_at', 'is', null)
        .lt('completed_at', startOfThisWeek.toISOString())
        .is('dismissed_from_list_at', null)
      await fetchTodos(uid)
    }
    init().finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel(`workspace_todos-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workspace_todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setTodos((prev) => {
            if (prev.some((t) => t.id === payload.new.id)) return prev
            return [...prev, payload.new as WorkspaceTodo]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workspace_todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as WorkspaceTodo
          setTodos((prev) => {
            // A task dismissed from the list (in another tab, or by the weekly
            // auto-clear) drops out of the list view here too.
            if (updated.dismissed_from_list_at) {
              return prev.filter((t) => t.id !== updated.id)
            }
            return prev.map((t) => (t.id === updated.id ? updated : t))
          })
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
      setTodos((prev) => prev.filter((t) => t.id !== tempId))
      return
    }

    setTodos((prev) =>
      prev.map((t) => (t.id === tempId ? (data as WorkspaceTodo) : t))
    )
  }, [userId])

  const completeTodo = useCallback(async (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (!todo || todo.is_completed) return

    const now = new Date().toISOString()
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, is_completed: true, completed_at: now } : t
      )
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('workspace_todos')
      .update({ is_completed: true, completed_at: now })
      .eq('id', id)

    if (error) {
      // Roll back
      setTodos((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, is_completed: false, completed_at: undefined as unknown as string } : t
        )
      )
    }
  }, [todos])

  const deleteTodo = useCallback(async (id: string) => {
    const prevTodo = todos.find((t) => t.id === id)
    if (!prevTodo) return

    // Optimistic remove from the list — both paths below hide it from the list.
    setTodos((prev) => prev.filter((t) => t.id !== id))

    const supabase = createClient()

    // A completed task must survive in the DB so the Weekly Recap can still
    // show it for the week it was completed — dismiss it instead of deleting.
    // An incomplete task never reached a recap, so a hard delete is fine.
    const isCompleted = prevTodo.completed_at != null
    const { error } = isCompleted
      ? await supabase
          .from('workspace_todos')
          .update({ dismissed_from_list_at: new Date().toISOString() })
          .eq('id', id)
      : await supabase.from('workspace_todos').delete().eq('id', id)

    if (error) {
      // Roll back
      setTodos((prev) => {
        const next = [...prev, prevTodo]
        next.sort((a, b) => a.created_at.localeCompare(b.created_at))
        return next
      })
    }
  }, [todos])

  const clearCompleted = useCallback(async () => {
    if (!userId) return
    const completed = todos.filter((t) => t.is_completed)
    if (completed.length === 0) return

    setTodos((prev) => prev.filter((t) => !t.is_completed))

    const supabase = createClient()
    // Dismiss (not delete) — completed tasks must survive for the Weekly Recap.
    const { error } = await supabase
      .from('workspace_todos')
      .update({ dismissed_from_list_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_completed', true)
      .is('dismissed_from_list_at', null)

    if (error) {
      setTodos((prev) => [...prev, ...completed].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ))
    }
  }, [userId, todos])

  return { todos, loading, addTodo, completeTodo, deleteTodo, clearCompleted }
}
