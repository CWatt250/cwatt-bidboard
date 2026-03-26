'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { useTodos } from '@/hooks/useTodos'
import type { WorkspaceTodo } from '@/lib/supabase/types'

function Skeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-8 rounded bg-muted animate-pulse" />
      ))}
    </div>
  )
}

function TodoItem({
  todo,
  onToggle,
}: {
  todo: WorkspaceTodo
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 rounded-md transition-colors group">
      <button
        onClick={() => onToggle(todo.id)}
        className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
          todo.is_completed
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/40 hover:border-primary'
        }`}
        aria-label={todo.is_completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {todo.is_completed && (
          <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            />
          </svg>
        )}
      </button>
      <span
        className={`text-sm flex-1 min-w-0 truncate transition-colors ${
          todo.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}
      >
        {todo.text}
      </span>
    </div>
  )
}

export function TodoList() {
  const { todos, loading, addTodo, toggleTodo, clearCompleted } = useTodos()
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const incomplete = todos.filter((t) => !t.is_completed)
  const completed = todos.filter((t) => t.is_completed)
  const sorted = [...incomplete, ...completed]

  function handleAdd() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    addTodo(trimmed)
    setInputValue('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div className="bg-card border rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold">To-Do</h2>
        {!loading && incomplete.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
            {incomplete.length}
          </span>
        )}
      </div>

      {/* Add input */}
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task…"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
        />
        <button
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Add task"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <Skeleton />
        ) : sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center px-4 py-6">
            No tasks yet. Add one above.
          </p>
        ) : (
          <div className="p-2 space-y-0.5">
            {sorted.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div className="flex items-center justify-between px-3 py-2 border-t shrink-0">
          <span className="text-xs text-muted-foreground">
            {incomplete.length} {incomplete.length === 1 ? 'task' : 'tasks'} remaining
          </span>
          {completed.length > 0 && (
            <button
              onClick={clearCompleted}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear Completed
            </button>
          )}
        </div>
      )}
    </div>
  )
}
