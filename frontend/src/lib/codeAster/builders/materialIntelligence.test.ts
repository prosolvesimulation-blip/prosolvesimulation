/**
 * Test suite for Material Intelligence Module
 */

import { materialIntelligence } from './materialIntelligence'
import type { MaterialDefinition } from './materialIntelligence'

describe('MaterialIntelligence', () => {
    test('should generate valid DEFI_MATERIAU commands', () => {
        const materials: MaterialDefinition[] = [
            {
                id: '1',
                name: 'Steel S355',
                props: {
                    E: 210000,
                    NU: 0.3,
                    RHO: 7850
                },
                assignedGroups: ['beam_group']
            }
        ]

        const result = materialIntelligence.generateMaterialCommands(materials)

        expect(result.defiCommands).toHaveLength(1)
        expect(result.defiCommands[0]).toContain('M_STEEL_S355 = DEFI_MATERIAU(')
        expect(result.defiCommands[0]).toContain('E=210000')
        expect(result.defiCommands[0]).toContain('NU=0.3')
        expect(result.defiCommands[0]).toContain('RHO=7850')
        expect(result.validation.isValid).toBe(true)
    })

    test('should generate valid AFFE_MATERIAU command', () => {
        const materials: MaterialDefinition[] = [
            {
                id: '1',
                name: 'Steel',
                props: { E: 210000, NU: 0.3, RHO: 7850 },
                assignedGroups: ['beam_group', 'shell_group']
            },
            {
                id: '2',
                name: 'Concrete',
                props: { E: 32000, NU: 0.2, RHO: 2400 },
                assignedGroups: ['foundation_group']
            }
        ]

        const result = materialIntelligence.generateMaterialCommands(materials)

        expect(result.affeCommands).toHaveLength(1)
        expect(result.affeCommands[0]).toContain('CHAM_MATER = AFFE_MATERIAU(')
        expect(result.affeCommands[0]).toContain('M_STEEL')
        expect(result.affeCommands[0]).toContain('M_CONCRETE')
        expect(result.affeCommands[0]).toContain("'beam_group', 'shell_group'")
        expect(result.affeCommands[0]).toContain("'foundation_group'")
    })

    test('should validate material properties correctly', () => {
        const invalidMaterials: MaterialDefinition[] = [
            {
                id: '1',
                name: 'Invalid Material',
                props: {
                    E: -1000, // Invalid: negative
                    NU: 0.6,   // Invalid: > 0.5
                    RHO: 0     // Invalid: zero
                },
                assignedGroups: []
            }
        ]

        const result = materialIntelligence.generateMaterialCommands(invalidMaterials)

        expect(result.validation.isValid).toBe(false)
        expect(result.validation.errors.length).toBeGreaterThan(0)
        expect(result.validation.errors.some(e => e.includes('Young\'s Modulus'))).toBe(true)
        expect(result.validation.errors.some(e => e.includes('Poisson\'s Ratio'))).toBe(true)
        expect(result.validation.errors.some(e => e.includes('Density'))).toBe(true)
    })

    test('should sanitize material names correctly', () => {
        const materials: MaterialDefinition[] = [
            {
                id: '1',
                name: 'Steel S235 (High Quality)',
                props: { E: 210000000000, NU: 0.3, RHO: 7850 },
                assignedGroups: []
            }
        ]

        const result = materialIntelligence.generateMaterialCommands(materials)

        expect(result.materialVariables['Steel S235 (High Quality)']).toBe('M_STEEL_S235_HIGH_QUALITY')
        expect(result.defiCommands[0]).toContain('M_STEEL_S235_HIGH_QUALITY = DEFI_MATERIAU(')
    })

    test('should detect duplicate material names', () => {
        const duplicateMaterials: MaterialDefinition[] = [
            {
                id: '1',
                name: 'Steel',
                props: { E: 210000000000, NU: 0.3, RHO: 7850 },
                assignedGroups: ['group1']
            },
            {
                id: '2',
                name: 'steel', // Same name, different case
                props: { E: 200000000000, NU: 0.3, RHO: 7850 },
                assignedGroups: ['group2']
            }
        ]

        const result = materialIntelligence.generateMaterialCommands(duplicateMaterials)

        expect(result.validation.isValid).toBe(false)
        expect(result.validation.errors.some(e => e.includes('Duplicate material names'))).toBe(true)
    })

    test('should detect group assignment conflicts', () => {
        const conflictMaterials: MaterialDefinition[] = [
            {
                id: '1',
                name: 'Steel',
                props: { E: 210000000000, NU: 0.3, RHO: 7850 },
                assignedGroups: ['shared_group']
            },
            {
                id: '2',
                name: 'Concrete',
                props: { E: 30000000000, NU: 0.2, RHO: 2400 },
                assignedGroups: ['shared_group'] // Same group assigned to both materials
            }
        ]

        const result = materialIntelligence.generateMaterialCommands(conflictMaterials)

        expect(result.validation.isValid).toBe(false)
        expect(result.validation.errors.some(e => e.includes('Groups assigned to multiple materials'))).toBe(true)
    })

    test('should provide material presets', () => {
        const presets = materialIntelligence.getMaterialPresets()

        expect(presets).toHaveProperty('Steel S235')
        expect(presets).toHaveProperty('Aluminum 6061')
        expect(presets).toHaveProperty('Concrete C30')

        const steelPreset = presets['Steel S235']
        expect(steelPreset.E).toBe(210000)
        expect(steelPreset.NU).toBe(0.3)
        expect(steelPreset.RHO).toBe(7850)
    })

    test('should provide validation hints', () => {
        const hints = materialIntelligence.getValidationHints()

        expect(hints).toHaveProperty('E')
        expect(hints).toHaveProperty('NU')
        expect(hints).toHaveProperty('RHO')
        expect(hints).toHaveProperty('assignments')

        expect(hints.E.length).toBeGreaterThan(0)
        expect(hints.NU.length).toBeGreaterThan(0)
        expect(hints.RHO.length).toBeGreaterThan(0)
        expect(hints.assignments.length).toBeGreaterThan(0)
    })
})
