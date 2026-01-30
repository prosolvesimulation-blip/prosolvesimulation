import type { Meta, StoryObj } from '@storybook/react';
import ModelConfig from '../components/config/ModelConfig';
import type { ProjectConfig } from '../components/StructuralWorkspace';

// Mock data for project config
const mockProjectConfig: ProjectConfig = {
    geometries: [],
    materials: [],
    restrictions: [],
    loads: [],
    load_cases: [],
    analysis: { type: 'STATIQUE', parameters: { time_stepping: 'AUTO', max_iter: 20, precision: 1e-6 } },
    contacts: [],
    connections: [],
    post_elem_mass: { mass_calculations: [] },
    post_releve_t_reactions: { reaction_cases: [] },
    geometry_commands: { modeleCommands: [], caraCommands: [], validation: { isValid: false }, summary: {} },
    mesh_commands: { lireCommands: [], asseCommands: [], validation: { isValid: false }, finalMeshName: '' },
    model_commands: { commPreview: '', caraCommands: [] },
    material_commands: { defiCommands: [], affeCommands: [], validation: { isValid: false } },
    load_commands: { forceCommands: [], pressureCommands: [], gravityCommands: [], totalLoadName: 'CHARGE_TOTAL' },
    restriction_commands: { ddlCommands: [], faceCommands: [], edgeCommands: [], validation: { isValid: false } },
    mesh: {
        'mesh_v1.med': {
            'Group_1': {
                count: 100,
                types: { 'SEG3': 100 },
                category: '1D'
            },
            'Group_2': {
                count: 50,
                types: { 'TRIA3': 50 },
                category: '2D'
            }
        }
    }
};

const meta = {
    title: 'Config/ModelConfig',
    component: ModelConfig,
    parameters: {
        layout: 'padded',
        backgrounds: {
            default: 'dark',
        },
    },
    tags: ['autodocs'],
    args: {
        projectConfig: mockProjectConfig
    },
} satisfies Meta<typeof ModelConfig>;

export default meta;
type Story = StoryObj<typeof meta>;

// 1. Default state: No project path
export const Default: Story = {};

// 2. Empty State: Project selected but no mesh groups
export const EmptyGroups: Story = {
    args: {
        projectConfig: { ...mockProjectConfig, mesh: {} }
    }
};

// 3. Populated: Standard use case with mesh groups detected
export const WithData: Story = {
    args: {
        projectConfig: mockProjectConfig
    }
};

// 4. Pre-configured: Some groups already have configurations saved
export const WithSavedConfig: Story = {
    args: {
        projectConfig: mockProjectConfig
    }
};
