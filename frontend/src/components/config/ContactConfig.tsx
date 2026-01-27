import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Plus, Trash2, Shield, Zap, Anchor } from 'lucide-react'

interface ContactConfigProps {
    projectPath: string | null;
    availableGroups: string[];
    initialContacts?: any[];
    onUpdate: (data: any[]) => void;
}

const CONTACT_TYPES = [
    { id: 'COLLAGE', label: 'Bonded', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'GLISSEMENT', label: 'Sliding', color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 'FROTTEMENT', label: 'Friction', color: 'text-rose-400', bg: 'bg-rose-400/10' }
]

const ContactConfig: React.FC<ContactConfigProps> = ({ projectPath, availableGroups, initialContacts, onUpdate }) => {
    const [contacts, setContacts] = useState<any[]>(initialContacts || [])

    const addContact = () => {
        const newContact = {
            id: `CONTACT_${Date.now()}`,
            name: `Contact_${contacts.length + 1}`,
            master: availableGroups[0] || '',
            slave: availableGroups[1] || '',
            type: 'COLLAGE',
            friction_coeff: 0.0
        }
        const updated = [...contacts, newContact]
        setContacts(updated)
        onUpdate(updated)
    }

    const removeContact = (id: string) => {
        const updated = contacts.filter(c => c.id !== id)
        setContacts(updated)
        onUpdate(updated)
    }

    const updateContact = (id: string, field: string, value: any) => {
        const updated = contacts.map(c => c.id === id ? { ...c, [field]: value } : c)
        setContacts(updated)
        onUpdate(updated)
    }

    if (!projectPath) return <div className="p-20 text-slate-500 font-mono text-center">NO PROJECT ACTIVE</div>

    return (
        <div className="h-full bg-slate-1000 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                            <Link2 size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Contact Pairs</h2>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest opacity-60">Master/Slave Surface Interactions</p>
                        </div>
                    </div>
                    <button
                        onClick={addContact}
                        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
                    >
                        <Plus size={16} /> New Contact
                    </button>
                </div>

                <div className="space-y-4">
                    <AnimatePresence>
                        {contacts.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-12 border-2 border-dashed border-slate-800 rounded-2xl text-center"
                            >
                                <Anchor size={40} className="text-slate-800 mx-auto mb-4" />
                                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">No Contacts Defined</p>
                            </motion.div>
                        ) : (
                            contacts.map((contact) => (
                                <motion.div
                                    key={contact.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm group hover:border-slate-700 transition-all"
                                >
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <input
                                                    type="text"
                                                    value={contact.name}
                                                    onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                                                    className="bg-transparent text-sm font-black text-white uppercase tracking-wide outline-none focus:text-cyan-400 transition-colors"
                                                />
                                                <span className="text-[10px] font-mono text-slate-600">ID: {contact.id}</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                                                        <Shield size={10} className="text-blue-400" /> Master Group
                                                    </label>
                                                    <select
                                                        value={contact.master}
                                                        onChange={(e) => updateContact(contact.id, 'master', e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                                                    >
                                                        {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                                                        <Zap size={10} className="text-amber-400" /> Slave Group
                                                    </label>
                                                    <select
                                                        value={contact.slave}
                                                        onChange={(e) => updateContact(contact.id, 'slave', e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                                                    >
                                                        {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-px bg-slate-800 hidden md:block" />

                                        <div className="md:w-64 space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase">Interaction Type</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {CONTACT_TYPES.map(type => (
                                                        <button
                                                            key={type.id}
                                                            onClick={() => updateContact(contact.id, 'type', type.id)}
                                                            className={`
                                                                px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all
                                                                ${contact.type === type.id ? `${type.bg} ${type.color} border border-${type.color}/30 shadow-lg shadow-${type.color}/5` : 'bg-slate-950 text-slate-600 border border-transparent'}
                                                            `}
                                                        >
                                                            {type.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {contact.type === 'FROTTEMENT' && (
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase">Friction Coeff (μ)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={contact.friction_coeff}
                                                        onChange={(e) => updateContact(contact.id, 'friction_coeff', parseFloat(e.target.value))}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                            )}

                                            <button
                                                onClick={() => removeContact(contact.id)}
                                                className="w-full mt-2 flex items-center justify-center gap-2 p-2 rounded-lg bg-rose-500/5 text-rose-500 hover:bg-rose-500/10 text-[10px] uppercase font-black tracking-widest transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={12} /> Remove Pair
                                            </button>
                                        </div>
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

export default ContactConfig
