import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import SummaryConfig from '../SummaryConfig'

// Mock the project config data
const mockProjectConfig = {
    geometries: [
        {
            group: 'beam_group',
            type: 'POU_D_T',
            _meshFile: 'test.med',
            phenomenon: 'MECANIQUE',
            _category: '1D',
            count: 10
        }
    ],
    materials: [
        {
            id: '1',
            name: 'Steel',
            E: '210000',
            nu: '0.3',
            rho: '7850',
            assignedGroups: ['beam_group']
        }
    ],
    restrictions: [
        {
            id: '1',
            name: 'Fixed Support',
            group: 'beam_group',
            dofs: 'UX,UY,UZ,RX,RY,RZ'
        }
    ],
    loads: [
        {
            id: '1',
            name: 'Point Load',
            type: 'FORCE',
            group: 'beam_group',
            magnitude: '1000',
            direction: 'Z'
        }
    ],
    load_cases: [
        {
            id: '1',
            name: 'Load Case 1',
            loads: ['1'],
            restrictions: ['1']
        }
    ],
    analysis: {
        type: 'STATIQUE',
        method: 'DIRECT',
        parameters: {
            time_stepping: 'AUTO',
            max_iter: 20,
            precision: 1e-6
        }
    },
    contacts: [
        {
            id: '1',
            name: 'Contact Pair 1',
            master: 'group1',
            slave: 'group2',
            type: 'COLLAGE'
        }
    ]
}

describe('SummaryConfig', () => {
    const defaultProps = {
        projectConfig: mockProjectConfig
    }

    beforeEach(() => {
        // Mock URL.createObjectURL and URL.revokeObjectURL for export functionality
        global.URL.createObjectURL = vi.fn(() => 'mock-url')
        global.URL.revokeObjectURL = vi.fn()
        
        // Mock createElement and click for download
        global.document.createElement = vi.fn(() => ({
            href: '',
            download: '',
            click: vi.fn()
        })) as any
        
        // Mock window.print
        global.window.print = vi.fn()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders the summary header', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Configuration Summary')).toBeInTheDocument()
        expect(screen.getByText('Complete simulation configuration overview')).toBeInTheDocument()
    })

    it('displays all configuration sections', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        // Check that all sections are present
        expect(screen.getByText('Model & Mesh')).toBeInTheDocument()
        expect(screen.getByText('Materials')).toBeInTheDocument()
        expect(screen.getByText('Loads')).toBeInTheDocument()
        expect(screen.getByText('Boundary Conditions')).toBeInTheDocument()
        expect(screen.getByText('Load Cases')).toBeInTheDocument()
        expect(screen.getByText('Contacts')).toBeInTheDocument()
        expect(screen.getByText('Analysis Settings')).toBeInTheDocument()
    })

    it('shows correct status indicators for complete configuration', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Configuration Complete')).toBeInTheDocument()
    })

    it('shows incomplete status for missing data', () => {
        const incompleteConfig = {
            ...mockProjectConfig,
            geometries: [],
            materials: []
        }
        
        render(<SummaryConfig {...defaultProps} projectConfig={incompleteConfig} />)
        
        expect(screen.getByText('Configuration Incomplete')).toBeInTheDocument()
    })

    it('expands and collapses sections when clicked', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        // Model section should be expanded by default
        expect(screen.getByText('beam_group')).toBeInTheDocument()
        
        // Click to collapse
        const modelSection = screen.getByText('Model & Mesh').closest('button')
        fireEvent.click(modelSection!)
        
        // Content should no longer be visible
        expect(screen.queryByText('beam_group')).not.toBeInTheDocument()
        
        // Click to expand again
        fireEvent.click(modelSection!)
        expect(screen.getByText('beam_group')).toBeInTheDocument()
    })

    it('displays model configuration correctly', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('beam_group')).toBeInTheDocument()
        expect(screen.getByText('POU_D_T')).toBeInTheDocument()
        expect(screen.getByText('test.med')).toBeInTheDocument()
        expect(screen.getByText('MECANIQUE')).toBeInTheDocument()
        expect(screen.getByText('1D')).toBeInTheDocument()
    })

    it('displays material configuration correctly', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Steel')).toBeInTheDocument()
        expect(screen.getByText('E: 210000 MPa')).toBeInTheDocument()
        expect(screen.getByText('ν: 0.3')).toBeInTheDocument()
        expect(screen.getByText('ρ: 7850 kg/m³')).toBeInTheDocument()
        expect(screen.getByText('Groups: beam_group')).toBeInTheDocument()
    })

    it('displays loads configuration correctly', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Point Load')).toBeInTheDocument()
        expect(screen.getByText('FORCE')).toBeInTheDocument()
        expect(screen.getByText('Group: beam_group')).toBeInTheDocument()
        expect(screen.getByText('Magnitude: 1000')).toBeInTheDocument()
        expect(screen.getByText('Direction: Z')).toBeInTheDocument()
    })

    it('displays restrictions configuration correctly', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Fixed Support')).toBeInTheDocument()
        expect(screen.getByText('Group: beam_group')).toBeInTheDocument()
        expect(screen.getByText('DOFs: UX,UY,UZ,RX,RY,RZ')).toBeInTheDocument()
    })

    it('displays load cases configuration correctly', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Load Case 1')).toBeInTheDocument()
        expect(screen.getByText('Loads: 1')).toBeInTheDocument()
        expect(screen.getByText('Restrictions: 1')).toBeInTheDocument()
    })

    it('displays contacts configuration correctly', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Contact Pair 1')).toBeInTheDocument()
        expect(screen.getByText('COLLAGE')).toBeInTheDocument()
        expect(screen.getByText('Master: group1')).toBeInTheDocument()
        expect(screen.getByText('Slave: group2')).toBeInTheDocument()
    })

    it('displays analysis configuration correctly', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        expect(screen.getByText('Analysis Configuration')).toBeInTheDocument()
        expect(screen.getByText('Type: STATIQUE')).toBeInTheDocument()
        expect(screen.getByText('Method: DIRECT')).toBeInTheDocument()
        expect(screen.getByText('time_stepping: AUTO')).toBeInTheDocument()
        expect(screen.getByText('max_iter: 20')).toBeInTheDocument()
        expect(screen.getByText('precision: 1e-6')).toBeInTheDocument()
    })

    it('shows error messages for incomplete sections', () => {
        const incompleteConfig = {
            ...mockProjectConfig,
            geometries: [],
            materials: [
                { id: '1', name: 'Incomplete Material', E: '210000' } // Missing nu and rho
            ]
        }
        
        render(<SummaryConfig {...defaultProps} projectConfig={incompleteConfig} />)
        
        expect(screen.getByText('Issues Found')).toBeInTheDocument()
        expect(screen.getByText('No geometries defined')).toBeInTheDocument()
        expect(screen.getByText('Material Incomplete Material missing properties')).toBeInTheDocument()
    })

    it('exports configuration to JSON when export button is clicked', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        const exportButton = screen.getByText('Export JSON')
        fireEvent.click(exportButton)
        
        expect(global.URL.createObjectURL).toHaveBeenCalled()
        expect(global.document.createElement).toHaveBeenCalledWith('a')
    })

    it('prints when print button is clicked', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        const printButton = screen.getByText('Print')
        fireEvent.click(printButton)
        
        expect(global.window.print).toHaveBeenCalled()
    })

    it('toggles between simple and detailed view', () => {
        render(<SummaryConfig {...defaultProps} />)
        
        const toggleButton = screen.getByText('Detailed View')
        fireEvent.click(toggleButton)
        
        expect(screen.getByText('Simple View')).toBeInTheDocument()
    })

    it('handles empty configuration gracefully', () => {
        const emptyConfig = {
            geometries: [],
            materials: [],
            restrictions: [],
            loads: [],
            load_cases: [],
            analysis: {},
            contacts: []
        }
        
        render(<SummaryConfig {...defaultProps} projectConfig={emptyConfig} />)
        
        expect(screen.getByText('Configuration Incomplete')).toBeInTheDocument()
        expect(screen.getByText('No Data')).toBeInTheDocument()
    })

    it('does not render contacts section when contacts are undefined', () => {
        const configWithoutContacts = {
            ...mockProjectConfig,
            contacts: undefined
        }
        
        render(<SummaryConfig {...defaultProps} projectConfig={configWithoutContacts} />)
        
        expect(screen.queryByText('Contacts')).not.toBeInTheDocument()
    })
})
