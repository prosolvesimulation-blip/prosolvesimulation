import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Terminal } from 'lucide-react'

// Global event bus for logs
const logListeners: ((log: any) => void)[] = []

const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

// Hook into console
console.log = (...args) => {
    originalLog(...args)
    notifyListeners('log', args)
}

console.error = (...args) => {
    originalError(...args)
    notifyListeners('error', args)
}

console.warn = (...args) => {
    originalWarn(...args)
    notifyListeners('warn', args)
}

function notifyListeners(type: 'log' | 'error' | 'warn', args: any[]) {
    const message = args.map(arg => {
        if (typeof arg === 'object') return JSON.stringify(arg)
        return String(arg)
    }).join(' ')

    const logEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message
    }

    logListeners.forEach(l => l(logEntry))
}

export default function ConsoleOverlay() {
    const [isOpen, setIsOpen] = useState(false)
    const [logs, setLogs] = useState<any[]>([])
    const endRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (newLog: any) => {
            setLogs(prev => [...prev.slice(-100), newLog]) // Keep last 100
        }
        logListeners.push(handler)
        return () => {
            const idx = logListeners.indexOf(handler)
            if (idx !== -1) logListeners.splice(idx, 1)
        }
    }, [])

    useEffect(() => {
        if (isOpen && endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, isOpen])

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-[9999] bg-slate-900 border border-slate-700 p-2 rounded-full shadow-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                title="Open Debug Console"
            >
                <Terminal className="w-5 h-5" />
            </button>
        )
    }

    return (
        <div className="fixed bottom-0 right-0 w-full md:w-2/3 lg:w-1/2 h-1/3 min-h-[300px] z-[9999] bg-slate-950 border-t border-l border-slate-800 shadow-2xl flex flex-col font-mono text-xs">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider">
                    <Terminal className="w-3 h-3" />
                    <span>Debug Console</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setLogs([])}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        title="Clear"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Logs in reverse order (newest at bottom) like real terminal */}
            <div className="flex-1 overflow-auto p-4 space-y-1">
                {logs.map(log => (
                    <div key={log.id} className="flex gap-2 font-mono">
                        <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                        <span className={`break-all whitespace-pre-wrap ${log.type === 'error' ? 'text-red-400' :
                                log.type === 'warn' ? 'text-yellow-400' :
                                    'text-slate-300'
                            }`}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    )
}
