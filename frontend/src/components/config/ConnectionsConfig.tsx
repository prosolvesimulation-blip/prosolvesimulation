import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Plus, Trash2, Crosshair, Users, Info } from 'lucide-react'

interface ConnectionsConfigProps {
    projectPath: string | null;
    availableGroups: string[];
    nodeGroups: string[];
    initialConnections?: any[];
    onUpdate: (data: any[]) => void;
}

const ConnectionConfig: React.FC<ConnectionsConfigProps> = ({ projectPath, availableGroups, nodeGroups, initialConnections, onUpdate }) => {
    const [connections, setConnections] = useState<any[]>(initialConnections || [])

    const addConnection = (type: 'RBE2' | 'RBE3') => {
        const newConn = {
            id: `CONN_${Date.now()}`,
            name: `${type}_${connections.length + 1}`,
            type: type,
            master_node: nodeGroups[0] || availableGroups[0] || '',
            slave_groups: [],
            degrees_of_freedom: ['DX', 'DY', 'DZ']
        }
        const updated = [...connections, newConn]
        setConnections(updated)
        onUpdate(updated)
    }

    const removeConnection = (id: string) => {
        const updated = connections.filter(c => c.id !== id)
        setConnections(updated)
        onUpdate(updated)
    }

    const updateConnection = (id: string, field: string, value: any) => {
        const updated = connections.map(c => c.id === id ? { ...c, [field]: value } : c)
        setConnections(updated)
        onUpdate(updated)
    }

    const toggleSlaveGroup = (id: string, group: string) => {
        const conn = connections.find(c => c.id === id)
        if (!conn) return
        const slaves = conn.slave_groups.includes(group)
            ? conn.slave_groups.filter((g: string) => g !== group)
            : [...conn.slave_groups, group]
        updateConnection(id, 'slave_groups', slaves)
    }

    if (!projectPath) return <div className="p-20 text-slate-500 font-mono text-center">NO PROJECT ACTIVE</div>

    return (
        <div className="h-full bg-slate-1000 overflow-y-auto p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <Share2 size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Kinematic Connections</h2>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest opacity-60">RBE2 & RBE3 MPC Elements</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => addConnection('RBE2')}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                        >
                            <Plus size={14} /> Add RBE2 (Rigid)
                        </button>
                        <button
                            onClick={() => addConnection('RBE3')}
                            className="flex items-center gap-2 px-4 py-2 border border-indigo-600/30 text-indigo-400 hover:bg-indigo-600/10 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                        >
                            <Plus size={14} /> Add RBE3 (Interpolation)
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <AnimatePresence>
                        {connections.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-16 border-2 border-dashed border-slate-800 rounded-3xl text-center"
                            >
                                <Share2 size={48} className="text-slate-800 mx-auto mb-4" />
                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">Ready for multi-point constraints</p>
                            </motion.div>
                        ) : (
                            connections.map((conn) => (
                                <motion.div
                                    key={conn.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden group"
                                >
                                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`px-2 py-1 rounded-md text-[8px] font-black tracking-widest ${conn.type === 'RBE2' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-indigo-400 border border-indigo-500/20'}`}>
                                                {conn.type}
                                            </div>
                                            <input
                                                type="text"
                                                value={conn.name}
                                                onChange={(e) => updateConnection(conn.id, 'name', e.target.value)}
                                                className="bg-transparent text-xs font-black text-slate-200 uppercase outline-none focus:text-indigo-400"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeConnection(conn.id)}
                                            className="p-1.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                                                    <Crosshair size={10} className="text-indigo-400" /> Master Node / Origin
                                                </label>
                                                <select
                                                    value={conn.master_node}
                                                    onChange={(e) => updateConnection(conn.id, 'master_node', e.target.value)}
                                                    className="w-full bg-slate-950 border border-white/5 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                                                >
                                                    {[...nodeGroups, ...availableGroups.filter(g => !nodeGroups.includes(g))].map(g => (
                                                        <option key={g} value={g}>{g}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-slate-500 uppercase">Degrees of Freedom (DOFs)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['DX', 'DY', 'DZ', 'DRX', 'DRY', 'DRZ'].map(dof => (
                                                        <button
                                                            key={dof}
                                                            onClick={() => {
                                                                const dofs = conn.degrees_of_freedom.includes(dof)
                                                                    ? conn.degrees_of_freedom.filter((d: string) => d !== dof)
                                                                    : [...conn.degrees_of_freedom, dof]
                                                                updateConnection(conn.id, 'degrees_of_freedom', dofs)
                                                            }}
                                                            className={`
                                                            px-3 py-1.5 rounded-lg text-[9px] font-black tracking-tighter transition-all
                                                            ${conn.degrees_of_freedom.includes(dof) ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950 text-slate-600'}
                                                        `}
                                                        >
                                                            {dof}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                                                <Users size={10} className="text-indigo-400" /> Dependent (Slave) Groups
                                            </label>
                                            <div className="max-h-40 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-slate-950/50 p-2 space-y-1">
                                                {availableGroups.filter(g => g !== conn.master_node).map(group => (
                                                    <button
                                                        key={group}
                                                        onClick={() => toggleSlaveGroup(conn.id, group)}
                                                        className={`
                                                        w-full flex items-center justify-between p-2 rounded-lg text-[10px] font-bold transition-all
                                                        ${conn.slave_groups.includes(group) ? 'bg-indigo-500/10 text-indigo-300' : 'text-slate-600 hover:bg-white/5'}
                                                    `}
                                                    >
                                                        {group}
                                                        {conn.slave_groups.includes(group) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-6 py-3 bg-white/5 flex items-center gap-2">
                                        <Info size={12} className="text-slate-500" />
                                        <span className="text-[9px] text-slate-500 font-medium italic leading-none">
                                            {conn.type === 'RBE2'
                                                ? "RBE2 creates a strictly rigid link. Distances between nodes remain constant."
                                                : "RBE3 creates a load distribution element. It does not add stiffness to the model."
                                            }
                                        </span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

export default ConnectionConfig
