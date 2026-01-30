/**
 * Code_Aster .export Orchestration Service
 * Generates the .export file used by as_run to execute simulations.
 */

export interface ExportConfig {
    folderPath: string
    commPath: string
    meshes: Array<{ path: string; unit: number }>
    simDir: string
}

export class ExportOrchestrator {
    private static instance: ExportOrchestrator

    private constructor() { }

    public static getInstance(): ExportOrchestrator {
        if (!ExportOrchestrator.instance) {
            ExportOrchestrator.instance = new ExportOrchestrator()
        }
        return ExportOrchestrator.instance
    }

    /**
     * Normalizes paths to use backslashes for Windows compatibility in .export file
     */
    private normalizePath(path: string): string {
        return path.replace(/\//g, '\\')
    }

    /**
     * Generates .export content
     * @param config Configuration for the export file
     */
    public generateExportContent(config: ExportConfig): string {
        const { commPath, meshes, simDir } = config

        const tempPath = this.normalizePath(`${simDir}/temp`)
        const messagePath = this.normalizePath(`${simDir}/message`)
        const basePath = this.normalizePath(`${simDir}/base`)
        const resuMedPath = this.normalizePath(`${simDir}/resu.med`)
        const massCsvPath = this.normalizePath(`${simDir}/mass_properties.csv`)
        const reactionsCsvPath = this.normalizePath(`${simDir}/reactions.csv`)
        const winCommPath = this.normalizePath(commPath)

        let exportContent = `P actions make_etude
P rep_trav ${tempPath}
P memory_limit 2048
P time_limit 900.0
P version stable
P ncpus 1
P mpi_nbcpu 1
P mode interactif
F comm ${winCommPath} D 1
F mess ${messagePath} R 6
R base ${basePath} R 0
`

        // Add meshes with synchronized units
        meshes.forEach(mesh => {
            exportContent += `F mmed ${this.normalizePath(mesh.path)} D ${mesh.unit}\n`
        })

        // Add standard result files
        exportContent += `F resu ${resuMedPath} R 8\n`
        exportContent += `F dat ${massCsvPath} R 26\n`
        exportContent += `F dat ${reactionsCsvPath} R 27\n`

        return exportContent
    }
}

export const exportOrchestrator = ExportOrchestrator.getInstance()
