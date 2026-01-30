import { useState } from "react"

interface CommandPreviewProps {
  code: string
}

export default function CommandPreview({ code }: CommandPreviewProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0
        bg-slate-950 border-t border-slate-800
        transition-all duration-200
        ${open ? "h-64" : "h-10"}
      `}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-10
                   cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-mono text-cyan-400">
          Command Preview (.comm)
        </span>

        <span className="text-slate-400 text-xs">
          {open ? "▼" : "▲"}
        </span>
      </div>

      {/* Body */}
      {open && (
        <pre
          className="h-[calc(100%-2.5rem)] overflow-auto
                     p-4 text-xs font-mono text-slate-200"
        >
{code}
        </pre>
      )}
    </div>
  )
}
