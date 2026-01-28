import type { Meta, StoryObj } from '@storybook/react'
import SummaryConfig from './SummaryConfig'

const meta: Meta<typeof SummaryConfig> = {
  title: 'Config/SummaryConfig',
  component: SummaryConfig,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const mockProjectConfig = {
  geometries: [
    {
      group: 'beam_group',
      type: 'POU_D_T',
      _meshFile: 'test.med',
      phenomenon: 'MECANIQUE',
      _category: '1D',
      count: 10
    },
    {
      group: 'shell_group',
      type: 'COQUE_3D',
      _meshFile: 'test.med',
      phenomenon: 'MECANIQUE',
      _category: '2D',
      count: 20
    }
  ],
  materials: [
    {
      id: '1',
      name: 'Steel S235',
      E: '210000',
      nu: '0.3',
      rho: '7850',
      assignedGroups: ['beam_group']
    },
    {
      id: '2',
      name: 'Aluminum 6061',
      E: '70000',
      nu: '0.33',
      rho: '2710',
      assignedGroups: ['shell_group']
    }
  ],
  restrictions: [
    {
      id: '1',
      name: 'Fixed Support',
      group: 'beam_group',
      dofs: 'UX,UY,UZ,RX,RY,RZ'
    },
    {
      id: '2',
      name: 'Pinned Support',
      group: 'shell_group',
      dofs: 'UX,UY,UZ'
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
    },
    {
      id: '2',
      name: 'Pressure Load',
      type: 'PRESSURE',
      group: 'shell_group',
      magnitude: '0.5',
      direction: 'Z'
    }
  ],
  load_cases: [
    {
      id: '1',
      name: 'Load Case 1',
      loads: ['1', '2'],
      restrictions: ['1', '2']
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
      master: 'beam_group',
      slave: 'shell_group',
      type: 'COLLAGE'
    }
  ]
}

export const Complete: Story = {
  args: {
    projectConfig: mockProjectConfig,
  },
}

export const Incomplete: Story = {
  args: {
    projectConfig: {
      geometries: [],
      materials: [
        { id: '1', name: 'Incomplete Material', E: '210000' } // Missing nu and rho
      ],
      restrictions: [],
      loads: [],
      load_cases: [],
      analysis: {},
      contacts: []
    },
  },
}

export const Empty: Story = {
  args: {
    projectConfig: {
      geometries: [],
      materials: [],
      restrictions: [],
      loads: [],
      load_cases: [],
      analysis: {},
      contacts: []
    },
  },
}
