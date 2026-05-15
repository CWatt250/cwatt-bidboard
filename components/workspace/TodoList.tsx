'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Check, Trash2 } from 'lucide-react'
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
  onComplete,
  onDelete,
}: {
  todo: WorkspaceTodo
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 rounded-md transition-colors group">
      <span
        className={`text-sm flex-1 min-w-0 truncate transition-colors ${
          todo.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}
      >
        {todo.text}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!todo.is_completed && (
          <button
            onClick={() => onComplete(todo.id)}
            className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"
            aria-label="Mark complete"
            title="Complete"
          >
            <Check size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(todo.id)}
          className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Delete task"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export function TodoList() {
  const { todos, loading, addTodo, completeTodo, deleteTodo, clearCompleted } = useTodos()
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const incomplete = todos.filter((t) => !t.is_completed)
  const completed = todos.filter((t) => t.is_completed)

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
        <h2 className="text-sm font-semibold">To-Do List</h2>
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
        ) : todos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center px-4 py-6">
            No tasks yet. Add one above.
          </p>
        ) : (
          <div className="p-2 space-y-0.5">
            {/* Incomplete tasks */}
            {incomplete.length > 0 && (
              <div className="space-y-0.5">
                {incomplete.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onComplete={completeTodo} onDelete={deleteTodo} />
                ))}
              </div>
            )}

            {/* Completed section */}
            {completed.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-1">
                  <div className="flex-1 h-px bg-muted" />
                  <span className="text-xs text-muted-foreground shrink-0">
                    Completed ({completed.length})
                  </span>
                  <div className="flex-1 h-px bg-muted" />
                </div>
                <div className="space-y-0.5">
                  {completed.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} onComplete={completeTodo} onDelete={deleteTodo} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div className="flex items-center justify-between px-3 py-2 border-t shrink-0">
          <span className="text-xs text-muted-foreground">
            {incomplete.length} {incomplete.length === 1 ? 'task' : 'tasks'} remaining
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {completed.length > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
