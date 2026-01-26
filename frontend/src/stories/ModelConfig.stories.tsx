import type { Meta, StoryObj } from '@storybook/react';
import ModelConfig from '../components/config/ModelConfig';

// Mock data for mesh groups
const mockMeshGroups = {
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
        },
        'Group_3': {
            count: 200,
            types: { 'HEXA8': 200 },
            category: '3D'
        },
        'Node_Group': {
            count: 10,
            types: { 'Node': 10 },
            category: 'Node'
        }
    },
    'mesh_v2.med': {
        'Beam_Main': {
            count: 120,
            types: { 'SEG2': 120 },
            category: '1D'
        }
    }
};

const mockCurrentGeometries = [
    {
        group: 'Group_1',
        _meshFile: 'mesh_v1.med',
        type: 'POU_D_E',
        phenomenon: 'MECANIQUE',
        _category: '1D'
    }
];

const meta = {
    title: 'Config/ModelConfig',
    component: ModelConfig,
    parameters: {
        layout: 'padded', // or 'fullscreen'
        backgrounds: {
            default: 'dark',
        },
    },
    tags: ['autodocs'],
    argTypes: {
        onUpdate: { action: 'updated' },
    },
} satisfies Meta<typeof ModelConfig>;

export default meta;
type Story = StoryObj<typeof meta>;

// 1. Default state: No project path (should show "Please select a project")
export const Default: Story = {
    args: {
        projectPath: null,
        meshGroups: {},
        currentGeometries: [],
    },
};

// 2. Empty State: Project selected but no mesh groups (should show "No Mesh Groups Detected")
export const EmptyGroups: Story = {
    args: {
        projectPath: '/path/to/project',
        meshGroups: {},
        currentGeometries: [],
    },
};

// 3. Populated: Standard use case with mesh groups detected
export const WithData: Story = {
    args: {
        projectPath: '/path/to/project',
        meshGroups: mockMeshGroups,
        currentGeometries: [],
    },
};

// 4. Pre-configured: Some groups already have configurations saved
export const WithSavedConfig: Story = {
    args: {
        projectPath: '/path/to/project',
        meshGroups: mockMeshGroups,
        currentGeometries: mockCurrentGeometries,
    },
};
