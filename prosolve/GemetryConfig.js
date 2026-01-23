// =========================================================
// ARQUIVO: GeometryConfig.js
// =========================================================

const React = window.React || require('react');
const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = 'http://localhost:5000/api';

// --- 1. VISUALIZADOR ---
const SectionVisualizer = ({ imageSrc, loading, error }) => {
    if (loading) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white">
            <span className="text-3xl mb-2 animate-spin">⚙️</span>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Processing...</span>
        </div>
    );
    if (error) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white text-red-500 p-4 text-center">
            <span className="text-3xl mb-2">⚠️</span>
            <span className="text-xs">{error}</span>
        </div>
    );
    if (!imageSrc) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white text-slate-300 select-none">
            <span className="text-5xl mb-3 opacity-20">📐</span>
            <span className="text-xs font-bold uppercase tracking-widest">No Geometry</span>
        </div>
    );
    return (
        <div className="w-full h-full flex items-center justify-center bg-white overflow-hidden relative">
            <img src={imageSrc} alt="Preview" className="max-w-full max-h-full object-contain" />
            <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center gap-1 bg-white/90 px-1.5 py-0.5 rounded border border-blue-200 shadow-sm">
                    <span className="w-2 h-2 text-blue-600 font-bold">x</span>
                    <span className="text-[9px] text-slate-600 font-bold">Node (0,0)</span>
                </div>
                <div className="flex items-center gap-1 bg-white/90 px-1.5 py-0.5 rounded border border-red-200 shadow-sm">
                    <span className="w-2 h-2 text-red-500 font-bold">+</span>
                    <span className="text-[9px] text-slate-600 font-bold">Centroid</span>
                </div>
                <div className="flex items-center gap-1 bg-white/90 px-1.5 py-0.5 rounded border border-red-400 border-dashed shadow-sm">
                    <span className="w-4 border-t-2 border-red-500 border-dotted h-0"></span>
                    <span className="text-[9px] text-slate-600 font-bold">Offset</span>
                </div>
            </div>
        </div>
    );
};

// --- 2. CONFIGURADOR ---
const GeometryConfig = () => {
    const [geometries, setGeometries] = useState([]);
    const [library, setLibrary] = useState([]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Results
    const [sectionImage, setSectionImage] = useState(null);
    const [calculatedProps, setCalculatedProps] = useState(null);
    const [calcLoading, setCalcLoading] = useState(false);
    const [calcError, setCalcError] = useState(null);
    
    const [autoCalc, setAutoCalc] = useState(true);
    const [splitRatio, setSplitRatio] = useState(55);
    const containerRef = useRef(null);
    const isResizing = useRef(false);
    const debounceTimer = useRef(null);

    // BEAM DEFAULTS
    const PROFILE_TYPES = {
        'RECTANGLE': { label: 'Solid Rectangle', default: { hy: 100, hz: 50, offset_y: 0, offset_z: 0, rotation: 0 } },
        'BOX':       { label: 'Rectangular Tube', default: { hy: 100, hz: 50, t: 5, offset_y: 0, offset_z: 0, rotation: 0 } },
        'CIRCLE':    { label: 'Solid Circle', default: { r: 50, offset_y: 0, offset_z: 0, rotation: 0 } },
        'TUBE':      { label: 'Circular Tube', default: { r: 50, t: 5, offset_y: 0, offset_z: 0, rotation: 0 } },
        'I_SECTION': { label: 'I-Section', default: { h: 200, tw: 6.3, bf_top: 100, tf_top: 8, bf_bot: 100, tf_bot: 8, offset_y: 0, offset_z: 0, rotation: 0 } }
    };

    // SHELL DEFAULTS (VECTEUR Default = 1,0,0 que é o padrão do Aster se omitido, mas aqui deixamos explicito)
    const SHELL_DEFAULT = { thickness: 10.0, offset: 0.0, vx: 1.0, vy: 0.0, vz: 0.0 };

    // Load Data
    useEffect(() => {
        const load = async () => {
            try {
                const resp = await fetch('section.json');
                if (resp.ok) setLibrary(await resp.json());
            } catch (e) {}

            const globalGeoms = window.projectState?.geometries || [];
            const initialized = globalGeoms

                .filter(g => {
                    // Se category não existir, tenta inferir, mas idealmente já vem correta
                    const cat = g._category || (g.type.includes('POU') ? '1D' : '3D');
                    return cat === '1D' || cat === '2D';
                })

                .map(g => {
                    const isBeam = g.type.includes('POU') || g.type.includes('BARRE') || g.type.includes('1D');
                    const isShell = g.type.includes('DKT') || g.type.includes('DST') || g.type.includes('COQUE');
                
                let params = {};
                
                if (isBeam) {
                    params = { ...PROFILE_TYPES['I_SECTION'].default, ...(g.section_params || {}) };
                } else if (isShell) {
                    // Se já tiver params, usa. Se não, usa o default de Shell.
                    params = { ...SHELL_DEFAULT, ...(g.section_params || {}) };
                }

                return {
                    ...g,
                    section_type: g.section_type || (isBeam ? 'I_SECTION' : 'SHELL'),
                    profile_name: g.profile_name || 'Custom',
                    section_params: params,
                    // Mantendo compatibilidade legada se necessário, mas preferindo section_params
                    thickness: g.thickness || "10", 
                    offset: g.offset || "0"
                };
            });
            setGeometries(initialized);
            setLoading(false);
        };
        load();
    }, []);

    // Sync Global
    useEffect(() => {
        if(window.projectState && geometries.length > 0) window.projectState.geometries = geometries;
    }, [geometries]);

    // API Call
    const calculateSection = async () => {
        if (geometries.length === 0) return;
        const selected = geometries[selectedIdx];
        const isBeam = selected.type.includes('POU') || selected.type.includes('BARRE') || selected.type.includes('1D');

        if (!isBeam) { setSectionImage(null); setCalculatedProps(null); return; }

        setCalcLoading(true);
        setCalcError(null);
        try {
            const response = await fetch(`${API_BASE}/calculate_section`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: selected.section_type, params: selected.section_params })
            });
            const data = await response.json();
            if (data.status === 'success') {
                setSectionImage(data.image);
                setCalculatedProps(data.properties);
            } else {
                throw new Error(data.message);
            }
        } catch (e) {
            setCalcError("Error: " + e.message);
        } finally {
            setCalcLoading(false);
        }
    };

    // Auto Trigger
    useEffect(() => {
        if (geometries.length === 0) return;
        const selected = geometries[selectedIdx];
        const isBeam = selected && (selected.type.includes('POU') || selected.type.includes('BARRE') || selected.type.includes('1D'));
        
        if (isBeam && autoCalc) {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => { calculateSection(); }, 800);
        }
    }, [selectedIdx, geometries, autoCalc]);

    // Handlers
    const updateGeometry = (idx, field, val) => setGeometries(prev => prev.map((g, i) => i === idx ? { ...g, [field]: val } : g));
    const handleParamEdit = (idx, k, v) => setGeometries(prev => prev.map((g, i) => i === idx ? { ...g, profile_name: 'Custom', section_params: { ...g.section_params, [k]: v } } : g));
    const handleSectionTypeChange = (idx, v) => setGeometries(prev => prev.map((g, i) => i === idx ? { ...g, section_type: v, profile_name: 'Custom', section_params: { ...PROFILE_TYPES[v].default } } : g));
    const handleProfileSelect = (idx, v) => {
        if(v==='Custom') { updateGeometry(idx, 'profile_name', 'Custom'); return; }
        const lib = library.find(l => l.name === v);
        if(lib) setGeometries(prev => prev.map((g, i) => i === idx ? { ...g, profile_name: lib.name, section_type: lib.type, 
            section_params: { ...Object.fromEntries(Object.entries(lib.params).map(([k,v])=>[k,String(v)])), offset_y: 0, offset_z: 0, rotation: 0 } 
        } : g));
    };

    // Resizer Logic
    const handleMouseDown = () => { isResizing.current = true; document.body.style.cursor = 'col-resize'; };
    const handleMouseUp = () => { isResizing.current = false; document.body.style.cursor = ''; };
    const handleMouseMove = useCallback((e) => {
        if (!isResizing.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let w = ((e.clientX - rect.left) / rect.width) * 100;
        if (w < 30) w = 30; if (w > 70) w = 70;
        setSplitRatio(w);
    }, []);
    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        return () => { window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('mousemove', handleMouseMove); };
    }, [handleMouseMove]);

    if (loading) return <div className="p-10 text-blue-500 animate-pulse">Loading...</div>;
    if (geometries.length === 0) return <div className="p-10 text-slate-500">No Groups Found</div>;

    const selected = geometries[selectedIdx] || geometries[0];
    const isBeam = selected.type.includes('POU') || selected.type.includes('BARRE') || selected.type.includes('1D');
    const isShell = selected.type.includes('DKT') || selected.type.includes('DST') || selected.type.includes('COQUE');
    const filteredLibrary = library.filter(lib => lib.type === selected.section_type);

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-200 text-sm overflow-hidden border-t border-slate-900 font-sans">
            
            {/* SIDEBAR */}
            <div className="w-56 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
                <div className="h-10 border-b border-slate-800 flex items-center px-4 bg-slate-950 shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mesh Groups</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {geometries.map((geo, idx) => (
                        <div key={idx} onClick={() => setSelectedIdx(idx)}
                             className={`px-4 py-3 border-b border-slate-800/50 cursor-pointer flex justify-between items-center transition-colors ${selectedIdx === idx ? 'bg-blue-600/10 border-l-2 border-l-blue-500 text-white' : 'hover:bg-slate-900 text-slate-400 border-l-2 border-l-transparent'}`}>
                            <span className="text-xs font-medium truncate w-28" title={geo.group}>{geo.group}</span>
                            <span className="text-[9px] font-mono text-slate-500">{geo.type}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* SPLIT AREA */}
            <div className="flex-1 flex overflow-hidden relative" ref={containerRef}>
                
                {/* PAINEL INPUTS */}
                <div style={{ width: `${splitRatio}%` }} className="flex flex-col border-r border-slate-800 bg-slate-900 h-full min-w-[350px]">
                    <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900 shrink-0">
                        <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                             <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Definition</span>
                             <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 ml-2">{selected.group}</span>
                        </div>
                        {isBeam && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 cursor-pointer group select-none" onClick={() => setAutoCalc(!autoCalc)} title="Automatic Calculation">
                                    <span className={`text-[9px] font-bold uppercase transition-colors ${autoCalc ? 'text-green-500' : 'text-slate-500'}`}>Auto</span>
                                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors border border-slate-700 ${autoCalc ? 'bg-green-900/50' : 'bg-slate-800'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${autoCalc ? 'translate-x-4 bg-green-400' : 'translate-x-0 bg-slate-400'}`}></div>
                                    </div>
                                </div>
                                <button onClick={calculateSection} disabled={calcLoading} className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wide border transition-all active:scale-95 flex items-center gap-1 ${autoCalc ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-lg'}`}>CALCULATE</button>
                            </div>
                        )}
                        {/* Shell não tem cálculo de seção 2D */}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {/* --- CONFIGURAÇÃO DE VIGAS (BEAMS) --- */}
                        {isBeam && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-blue-400 uppercase mb-1.5 block">Profile Type</label>
                                        <select className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded p-2.5 outline-none focus:border-blue-500"
                                            value={selected.section_type || 'I_SECTION'} onChange={(e) => handleSectionTypeChange(selectedIdx, e.target.value)}>
                                            {Object.entries(PROFILE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Library Preset</label>
                                        <select className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded p-2.5 outline-none focus:border-blue-500"
                                            value={selected.profile_name || 'Custom'} onChange={(e) => handleProfileSelect(selectedIdx, e.target.value)}>
                                            <option value="Custom">-- Custom --</option>
                                            {filteredLibrary.length > 0 && <optgroup label="Library">{filteredLibrary.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</optgroup>}
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block border-b border-slate-800 pb-1">Dimensions & Position (mm / deg)</label>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        {Object.entries(selected.section_params || {}).map(([k, v]) => {
                                            // Estilização condicional dos inputs
                                            const isOffset = k.includes('offset');
                                            const isRotation = k === 'rotation';
                                            
                                            let badgeClass = 'bg-slate-800 border-slate-700 text-slate-400';
                                            let inputClass = 'border-slate-700 focus:border-blue-500';
                                            let labelText = k;

                                            if (isOffset) {
                                                badgeClass = 'bg-purple-900/30 border-purple-800 text-purple-400';
                                                inputClass = 'border-purple-800 focus:border-purple-500';
                                                labelText = k.replace('offset_', 'off_');
                                            } else if (isRotation) {
                                                badgeClass = 'bg-orange-900/30 border-orange-800 text-orange-400';
                                                inputClass = 'border-orange-800 focus:border-orange-500';
                                                labelText = 'rot°';
                                            }

                                            return (
                                                <div key={k} className="relative group">
                                                    <div className={`absolute inset-y-0 left-0 w-16 rounded-l border-y border-l flex items-center justify-center text-[9px] font-bold pointer-events-none uppercase ${badgeClass}`}>
                                                        {labelText}
                                                    </div>
                                                    <input type="text" className={`w-full bg-slate-900 border text-white text-sm rounded pl-20 pr-2 py-1.5 outline-none font-mono transition-all ${inputClass}`}
                                                        value={v} onChange={(e) => handleParamEdit(selectedIdx, k, e.target.value)} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* TABELA DE PROPRIEDADES COMPLETA */}
                                {calculatedProps && (
                                    <div className="mt-8 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-2">
                                                <span>✓</span> Calculated Properties
                                            </label>
                                            <span className="text-[9px] text-slate-500">Full Analysis Report</span>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {/* GRUPO 1: Geometria Básica */}
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 border-b border-slate-800 pb-0.5">Basic Geometry</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <PropRow label="Area (A)" value={calculatedProps["Area (A)"]} />
                                                    <PropRow label="Centroid Y" value={calculatedProps["Centroid Y (cy)"]} color="text-yellow-300" />
                                                    <PropRow label="Centroid Z" value={calculatedProps["Centroid Z (cx)"]} color="text-yellow-300" />
                                                    <PropRow label="Stat. Mom Qy (0,0)" value={calculatedProps["Static Moment Qy (at 0,0)"]} color="text-slate-400" />
                                                    <PropRow label="Stat. Mom Qz (0,0)" value={calculatedProps["Static Moment Qz (at 0,0)"]} color="text-slate-400" />
                                                </div>
                                            </div>

                                            {/* GRUPO 2: Rigidez Nodal (Global 0,0) - Steiner agora é nativo */}
                                            <div>
                                                <div className="flex justify-between items-end mb-1 border-b border-slate-800 pb-0.5">
                                                    <span className="text-[9px] font-bold text-purple-400 uppercase">Global Stiffness (at Node 0,0)</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <PropRow label="Iyy (Node)" value={calculatedProps["Iyy (Node 0,0)"]} highlight />
                                                    <PropRow label="Izz (Node)" value={calculatedProps["Izz (Node 0,0)"]} highlight />
                                                    <PropRow label="Iyz (Node)" value={calculatedProps["Iyz (Node 0,0)"]} highlight />
                                                </div>
                                            </div>

                                            {/* GRUPO 3: Rigidez Local (Centroidal) */}
                                            <div>
                                                <div className="text-[9px] font-bold text-blue-400 uppercase mb-1 border-b border-slate-800 pb-0.5">Section Stiffness (Centroidal)</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <PropRow label="Iyy (Local)" value={calculatedProps["Iyy (Local)"]} />
                                                    <PropRow label="Izz (Local)" value={calculatedProps["Izz (Local)"]} />
                                                    <PropRow label="Iyz (Local)" value={calculatedProps["Iyz (Local)"]} />
                                                    <PropRow label="Angle (deg)" value={calculatedProps["Angle (deg)"]} />
                                                    <PropRow label="I1 (Principal)" value={calculatedProps["I1 (Principal)"]} color="text-blue-200" />
                                                    <PropRow label="I2 (Principal)" value={calculatedProps["I2 (Principal)"]} color="text-blue-200" />
                                                </div>
                                            </div>

                                            {/* GRUPO 4: Torção e Cisalhamento */}
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1 border-b border-slate-800 pb-0.5">Torsion & Shear</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <PropRow label="J (Torsion)" value={calculatedProps["Torsion J"]} />
                                                    <PropRow label="Iw (Warping)" value={calculatedProps["Warping Iw"]} />
                                                    <PropRow label="Ay (Shear)" value={calculatedProps["Shear Area Ay"]} />
                                                    <PropRow label="Az (Shear)" value={calculatedProps["Shear Area Az"]} />
                                                </div>
                                            </div>

                                            {/* GRUPO 5: Resistência (Moduli) e Outros */}
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1 border-b border-slate-800 pb-0.5">Strength & Others</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <PropRow label="Wy (Elastic)" value={calculatedProps["Elastic Mod. Wy (Zxx)"]} />
                                                    <PropRow label="Wz (Elastic)" value={calculatedProps["Elastic Mod. Wz (Zyy)"]} />
                                                    <PropRow label="Zy (Plastic)" value={calculatedProps["Plastic Mod. Zy (Sxx)"]} />
                                                    <PropRow label="Zz (Plastic)" value={calculatedProps["Plastic Mod. Zz (Syy)"]} />
                                                    <PropRow label="ry (Gyration)" value={calculatedProps["Radius Gyration ry"]} color="text-slate-400" />
                                                    <PropRow label="rz (Gyration)" value={calculatedProps["Radius Gyration rz"]} color="text-slate-400" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* --- CONFIGURAÇÃO DE CASCAS (SHELLS) --- */}
                        {isShell && (
                            <div className="space-y-6">
                                {/* Physical Properties */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Physical Properties</span>
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 w-24 rounded-l border-y border-l bg-slate-800 border-slate-700 text-slate-400 flex items-center justify-center text-[9px] font-bold pointer-events-none uppercase">
                                                Thickness
                                            </div>
                                            <input type="text" className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 text-white text-sm rounded pl-28 pr-2 py-1.5 outline-none font-mono transition-all"
                                                value={selected.section_params?.thickness || 0}
                                                onChange={(e) => handleParamEdit(selectedIdx, 'thickness', e.target.value)}
                                            />
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 w-24 rounded-l border-y border-l bg-purple-900/30 border-purple-800 text-purple-400 flex items-center justify-center text-[9px] font-bold pointer-events-none uppercase">
                                                Eccentricity
                                            </div>
                                            <input type="text" className="w-full bg-slate-900 border border-purple-800 focus:border-purple-500 text-white text-sm rounded pl-28 pr-2 py-1.5 outline-none font-mono transition-all"
                                                value={selected.section_params?.offset || 0}
                                                onChange={(e) => handleParamEdit(selectedIdx, 'offset', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Reference Vector */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Reference Orientation (Local X)</span>
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                    </div>
                                    
                                    <div className="p-3 bg-slate-900/50 rounded border border-slate-800 mb-3">
                                        <div className="flex items-center gap-2 mb-2 text-slate-500 text-[9px]">
                                            <span className="text-xl">↳</span>
                                            <p className="leading-tight">
                                                Vector projected onto the surface to define the element's <strong className="text-slate-300">Local X Axis</strong>.
                                                <br/>Typical: <strong>(1, 0, 0)</strong> for Floors, <strong>(0, 1, 0)</strong> for Walls.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        {['vx', 'vy', 'vz'].map((axis, i) => (
                                            <div key={axis} className="relative group">
                                                <div className="absolute inset-y-0 left-0 w-10 rounded-l border-y border-l bg-orange-900/20 border-orange-800/50 text-orange-400 flex items-center justify-center text-[9px] font-bold pointer-events-none uppercase">
                                                    {axis.toUpperCase()}
                                                </div>
                                                <input type="text" className="w-full bg-slate-900 border border-orange-800/50 focus:border-orange-500 text-white text-sm rounded pl-12 pr-2 py-1.5 outline-none font-mono transition-all text-center"
                                                    value={selected.section_params?.[axis] || 0}
                                                    onChange={(e) => handleParamEdit(selectedIdx, axis, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* RESIZER */}
                <div className="w-1 bg-slate-950 hover:bg-blue-600 cursor-col-resize flex items-center justify-center z-20 border-l border-slate-800 shadow-xl" onMouseDown={handleMouseDown}><div className="h-8 w-0.5 bg-slate-700 rounded-full pointer-events-none"></div></div>

                {/* PREVIEW */}
                <div className="flex-1 flex flex-col bg-white relative min-w-[200px]">
                    <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50 shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Section Preview</span>
                    </div>
                    <div className="flex-1 relative overflow-hidden bg-white flex items-center justify-center">
                         {isBeam ? (
                             <SectionVisualizer imageSrc={sectionImage} loading={calcLoading} error={calcError} />
                         ) : (
                             <div className="text-center text-slate-300 select-none">
                                <span className="text-6xl mb-4 block opacity-20">⬡</span>
                                <span className="text-xs font-bold uppercase tracking-widest">3D Shell Element</span>
                                <p className="text-[10px] mt-2 max-w-[200px] mx-auto opacity-60">Visualized in the main 3D Viewport</p>
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Component for Property Rows with Enhanced Formatting
const PropRow = ({ label, value, highlight, color }) => {
    // Formata o número de forma inteligente
    const formatVal = (v) => {
        if (v === undefined || v === null) return '-';
        if (typeof v !== 'number') return v;
        // Zero efetivo
        if (Math.abs(v) < 1e-9) return '0.00';
        // Notação científica para números muito pequenos ou muito grandes
        if (Math.abs(v) < 1e-3 || Math.abs(v) > 1e5) return v.toExponential(3);
        // Decimal padrão para dimensões normais
        return v.toFixed(2);
    };

    return (
        <div className={`flex justify-between items-center px-2 py-1.5 rounded border transition-colors ${highlight ? 'bg-purple-900/20 border-purple-500/30' : 'bg-slate-950/50 border-slate-800'}`}>
            <span className={`text-[9px] font-medium truncate mr-2 ${highlight ? 'text-purple-300' : 'text-slate-500'}`}>{label}</span>
            <span className={`text-[10px] font-mono ${highlight ? 'text-white font-bold' : (color || 'text-blue-300')}`}>
                {formatVal(value)}
            </span>
        </div>
    );
};

window.GeometryConfig = GeometryConfig;