const AsterButton = ({ restrictions = [], loadedFiles = [], loads = [], loadCases = [], geometries = [] }) => {
    const handleRunCodeAster = () => {
        // Build mesh.json data
        const meshData = {
            unit_start: 80,
            meshes: loadedFiles.map(filename => ({
                name: filename.replace(/\.med$/i, ''),
                format: 'MED'
            }))
        };

        // Filter Node groups only and build ddl_impo format
        const ddlImpo = restrictions
            .filter(r => r.type === 'Node')
            .map(r => {
                const params = {};
                if (r.dx !== 'Free' && r.dx !== '') params.DX = parseFloat(r.dx) || 0.0;
                if (r.dy !== 'Free' && r.dy !== '') params.DY = parseFloat(r.dy) || 0.0;
                if (r.dz !== 'Free' && r.dz !== '') params.DZ = parseFloat(r.dz) || 0.0;
                if (r.mx !== 'Free' && r.mx !== '') params.DRX = parseFloat(r.mx) || 0.0;
                if (r.my !== 'Free' && r.my !== '') params.DRY = parseFloat(r.my) || 0.0;
                if (r.mz !== 'Free' && r.mz !== '') params.DRZ = parseFloat(r.mz) || 0.0;
                return { name: r.name, group: r.group, params };
            });

        // Build pesanteur.json data from all loads in the LOAD tab
        const pesanteurData = {
            pesanteur: loads.map(l => ({
                gravite: l.gravite || 9.81,
                direction: [
                    l.dirX || 0,
                    l.dirY || 0,
                    l.dirZ || -1
                ],
                group_ma: l.group_ma || '',
                name: l.name
            }))
        };

        // Build load_cases.json data
        const loadCasesData = {
            load_cases: loadCases.map(lc => ({
                name: lc.name,
                loads: lc.items
            }))
        };

        const payload = {
            mesh: meshData,
            ddl_impo: ddlImpo,
            pesanteur: pesanteurData,
            load_cases: loadCasesData,
            geometries: geometries // New geometry data
        };

        fetch('/run-aster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => alert("❌ Servidor não encontrado."));
    };

    return React.createElement(
        "div",
        { className: "fixed bottom-6 right-6" },
        React.createElement(
            "button",
            {
                onClick: handleRunCodeAster,
                className: "bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 z-50",
                title: "Executar Code_Aster"
            },
            React.createElement("span", null, "▶️"),
            " Run Code_Aster"
        )
    );
};

export default AsterButton;

