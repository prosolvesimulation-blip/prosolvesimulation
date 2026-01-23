import { useState } from 'react'
import Dashboard from './components/Dashboard'
import StructuralWorkspace from './components/StructuralWorkspace'

import ConsoleOverlay from './components/ConsoleOverlay'

type View = 'dashboard' | 'structural'

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [projectPath, setProjectPath] = useState<string | null>(null)

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950">
      {/* Title Bar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 shrink-0">
        <h1 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
          ProSolve Professional {currentView === 'structural' && '/ Structural'}
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'dashboard' && (
          <Dashboard onNavigate={(view) => setCurrentView(view as View)} />
        )}
        {currentView === 'structural' && (
          <StructuralWorkspace
            onBack={() => setCurrentView('dashboard')}
            projectPath={projectPath}
            setProjectPath={setProjectPath}
          />
        )}
      </div>

      {/* Global Debug Console */}
      <ConsoleOverlay />
    </div>
  )
}

export default App
