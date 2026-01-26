
import { useState, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Center } from '@react-three/drei'
import * as THREE from 'three'

interface ThreeDViewProps {
    projectPath: string | null
    geometries: any[]
    meshes?: string[]
}

// --- GEOMETRY FACTORY ---
const createSectionGeometry = (type: string, params: any) => {
    const length = 1.0
    const shape = new THREE.Shape()

    try {
        if (type === 'RECTANGLE') {
            const hy = parseFloat(params.hy) || 100
            const hz = parseFloat(params.hz) || 50
            shape.moveTo(-hy / 2, -hz / 2)
            shape.lineTo(hy / 2, -hz / 2)
            shape.lineTo(hy / 2, hz / 2)
            shape.lineTo(-hy / 2, hz / 2)
            shape.lineTo(-hy / 2, -hz / 2)
        } else if (type === 'CIRCLE' || type === 'TUBE') {
            const r = parseFloat(params.r) || 50
            shape.absarc(0, 0, r, 0, Math.PI * 2, false)
            if (type === 'TUBE') {
                const hole = new THREE.Path()
                const r_inner = r - (parseFloat(params.t) || 5)
                hole.absarc(0, 0, r_inner, 0, Math.PI * 2, true)
                shape.holes.push(hole)
            }
        } else if (type === 'I_SECTION') {
            const h = parseFloat(params.h) || 200
            const tw = parseFloat(params.tw) || 6
            const bf_top = parseFloat(params.bf_top) || 100
            const bf_bot = parseFloat(params.bf_bot) || 100
            const tf_top_val = parseFloat(params.tf_top) || 10
            const tf_bot_val = parseFloat(params.tf_bot) || 10

            shape.moveTo(-bf_top / 2, h / 2)
            shape.lineTo(bf_top / 2, h / 2)
            shape.lineTo(bf_top / 2, h / 2 - tf_top_val)
            shape.lineTo(tw / 2, h / 2 - tf_top_val)
            shape.lineTo(tw / 2, -h / 2 + tf_bot_val)
            shape.lineTo(bf_bot / 2, -h / 2 + tf_bot_val)
            shape.lineTo(bf_bot / 2, -h / 2)
            shape.lineTo(-bf_bot / 2, -h / 2)
            shape.lineTo(-bf_bot / 2, -h / 2 + tf_bot_val)
            shape.lineTo(-tw / 2, -h / 2 + tf_bot_val)
            shape.lineTo(-tw / 2, h / 2 - tf_top_val)
            shape.lineTo(-bf_top / 2, h / 2 - tf_top_val)
            shape.lineTo(-bf_top / 2, h / 2)
        } else {
            const s = 50
            shape.moveTo(-s, -s)
            shape.lineTo(s, -s)
            shape.lineTo(s, s)
            shape.lineTo(-s, s)
        }

        const extrudeSettings = {
            steps: 1,
            depth: length,
            bevelEnabled: false
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings)

    } catch (e) {
        console.error("Geo Gen Error", e)
        return new THREE.BoxGeometry(10, 10, 100)
    }
}

// --- BEAM INSTANCER ---
const InstancedBeams = ({ groupName, nodes, connectivity, sectionDef }: any) => {
    const meshRef = useRef<THREE.InstancedMesh>(null)
    const geometry = useMemo(() => createSectionGeometry(sectionDef.section_type || 'RECTANGLE', sectionDef.section_params || {}), [sectionDef])

    const matrices = useMemo(() => {
        const mats: THREE.Matrix4[] = []
        const dummy = new THREE.Object3D()
        const v1 = new THREE.Vector3()
        const v2 = new THREE.Vector3()

        connectivity.forEach((elem: number[]) => {
            if (elem.length < 2) return
            const n1 = nodes[elem[0]]
            const n2 = nodes[elem[1]]

            // Safety check for nodes
            if (!n1 || !n2) return

            v1.set(n1[0], n1[1], n1[2])
            v2.set(n2[0], n2[1], n2[2])

            const dist = v1.distanceTo(v2)
            if (dist < 0.0001) return // Avoid zero length issues

            dummy.position.copy(v1)
            dummy.lookAt(v2)
            dummy.scale.set(1, 1, dist)

            const rot = (parseFloat(sectionDef.section_params?.rotation || 0)) * Math.PI / 180
            dummy.rotateZ(rot)

            dummy.updateMatrix()
            mats.push(dummy.matrix.clone())
        })
        return mats
    }, [nodes, connectivity, sectionDef])

    useEffect(() => {
        if (meshRef.current) {
            matrices.forEach((mat, i) => {
                meshRef.current?.setMatrixAt(i, mat)
            })
            if (meshRef.current.instanceMatrix) {
                meshRef.current.instanceMatrix.needsUpdate = true
            }
        }
    }, [matrices])

    if (!sectionDef || matrices.length === 0) return null

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, matrices.length] as any}>
            <meshStandardMaterial color={stringToColor(groupName)} roughness={0.7} metalness={0.1} />
        </instancedMesh>
    )
}

// Simple Line Renderer
const LineGroup = ({ groupName, nodes, connectivity }: any) => {
    const positionBuffer = useMemo(() => {
        const p: number[] = []
        connectivity.forEach((c: number[]) => {
            if (c.length >= 2) {
                const n1 = nodes[c[0]]
                const n2 = nodes[c[1]]
                if (n1 && n2) {
                    p.push(n1[0], n1[1], n1[2])
                    p.push(n2[0], n2[1], n2[2])
                }
            }
        })
        return new Float32Array(p)
    }, [nodes, connectivity])

    if (positionBuffer.length === 0) return null

    return (
        <lineSegments>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positionBuffer.length / 3}
                    args={[positionBuffer, 3]}
                />
            </bufferGeometry>
            <lineBasicMaterial color={stringToColor(groupName)} linewidth={2} />
        </lineSegments>
    )
}

export default function ThreeDModel({ projectPath, geometries, meshes = [] }: ThreeDViewProps) {
    const [allMeshData, setAllMeshData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!projectPath) return

        const fetchAllMeshes = async () => {
            setLoading(true)
            setAllMeshData([])
            setError(null)
            try {
                // Default to empty array if meshes is undefined
                const filesToLoad = (meshes && meshes.length > 0) ? meshes : []

                if (filesToLoad.length === 0) {
                    const res = await fetch('/api/get_mesh_data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder_path: projectPath })
                    })
                    const data = await res.json()
                    if (data.status === 'success') {
                        setAllMeshData([data])
                    }
                } else {
                    const promises = filesToLoad.map(m =>
                        fetch('/api/get_mesh_data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folder_path: projectPath, mesh_filename: m })
                        }).then(r => r.json())
                    )

                    const results = await Promise.all(promises)
                    const validData = results.filter(r => r.status === 'success')
                    if (validData.length > 0) {
                        setAllMeshData(validData)
                    } else {
                        // Fallback
                        const res = await fetch('/api/get_mesh_data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folder_path: projectPath })
                        })
                        const data = await res.json()
                        if (data.status === 'success') {
                            setAllMeshData([data])
                        }
                    }
                }

            } catch (e: any) {
                console.error(e)
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        fetchAllMeshes()
    }, [projectPath, meshes])

    if (loading) return <div className="text-white flex items-center justify-center h-full gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        Loading 3D Meshes...
    </div>
    if (error) return <div className="text-red-500 flex items-center justify-center h-full p-10 text-center">
        Error loading 3D Model: {typeof error === 'string' ? error : JSON.stringify(error)}
    </div>

    const allGroupsFlat = useMemo(() => {
        const list: { name: string, hasGeo: boolean, color: string }[] = []
        allMeshData.forEach(mesh => {
            if (mesh && mesh.groups) {
                Object.keys(mesh.groups).forEach(g => {
                    if (!list.find(i => i.name === g)) {
                        const hasGeo = geometries.find((geo: any) => geo.group === g)
                        list.push({
                            name: g,
                            hasGeo: !!hasGeo,
                            color: stringToColor(g)
                        })
                    }
                })
            }
        })
        return list
    }, [allMeshData, geometries])

    return (
        <div className="w-full h-full bg-slate-900 overflow-hidden relative">
            <div className="absolute top-4 right-4 z-10 bg-slate-800/80 p-2 rounded text-xs text-white backdrop-blur max-h-[80%] overflow-y-auto">
                <h4 className="font-bold mb-1">Groups ({allGroupsFlat.length})</h4>
                {allGroupsFlat.map((g, idx) => (
                    <div key={`${g.name}-${idx}`} className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full" style={{ background: String(g.color || '#ccc') }}></span>
                        <span>{String(g.name || 'Unknown')} {g.hasGeo ? '(Beam)' : ''}</span>
                    </div>
                ))}
            </div>

            <Canvas camera={{ position: [1000, 1000, 1000], fov: 45, far: 100000 }}>
                <color attach="background" args={['#0f172a']} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[1000, 2000, 1000]} intensity={1.5} />
                <Center>
                    <group>
                        {allMeshData.map((mesh, i) => (
                            <group key={i}>
                                {mesh && mesh.groups && Object.entries(mesh.groups).map(([name, data]: [string, any]) => {
                                    const geoDef = geometries.find((g: any) => g.group === name)
                                    const isBeam = geoDef && (geoDef.type?.includes('POU') || geoDef.type?.includes('BARRE'))

                                    // Safety: Check if data.type and data.elements exist
                                    if (!data || !data.elements) return null

                                    if (isBeam && data.type === 'line') {
                                        return (
                                            <InstancedBeams
                                                key={`${i}-${name}-beam`}
                                                groupName={name}
                                                nodes={mesh.nodes}
                                                connectivity={data.elements}
                                                sectionDef={geoDef}
                                            />
                                        )
                                    } else {
                                        if (data.type === 'line') {
                                            return (
                                                <LineGroup
                                                    key={`${i}-${name}-line`}
                                                    groupName={name}
                                                    nodes={mesh.nodes}
                                                    connectivity={data.elements}
                                                />
                                            )
                                        }
                                        return null
                                    }
                                })}
                            </group>
                        ))}
                    </group>
                </Center>
                <OrbitControls makeDefault />
            </Canvas>
        </div >
    )
}

function stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}
