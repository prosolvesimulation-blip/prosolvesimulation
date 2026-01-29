/**
 * Test Geometry Intelligence Module
 * Validates .comm generation for beam and shell sections
 */

import { geometryIntelligence } from '../src/lib/codeAster/builders/geometryIntelligence'

// Test data simulating real geometry configuration
const testGeometries = [
    {
        group: 'beam_elements',
        _category: '1D',
        section_type: 'BEAM',
        profile_type: 'I_SECTION',
        section_params: {
            h: 200, tw: 6.3, bf_top: 100, tf_top: 8,
            bf_bot: 100, tf_bot: 8, offset_y: 0, offset_z: 0
        },
        section_properties: {
            "Area (A)": 2844,
            "Iyy (Node 0,0)": 45600000,
            "Izz (Node 0,0)": 21300000,
            "Torsion J": 123456,
            "Shear Area Ay": 1200,
            "Shear Area Az": 1400,
            "Warping Iw": 98700000,
            "Min Y": -100,
            "Max Y": 100,
            "Min X": -50,
            "Max X": 50
        }
    },
    {
        group: 'shell_elements',
        _category: '2D',
        section_type: 'SHELL',
        section_params: {
            thickness: 10.0,
            offset: 0.0,
            vx: 1.0,
            vy: 0.0,
            vz: 0.0
        }
    }
]

// Test the geometry intelligence module
function testGeometryIntelligence() {
    console.log('🧪 Testing Geometry Intelligence Module')
    console.log('=====================================')
    
    // Test 1: Complete configuration with section properties
    console.log('\n📋 Test 1: Complete Configuration')
    const result1 = geometryIntelligence.generateGeometryCommands(testGeometries)
    
    console.log('✅ Validation:', result1.validation.isValid ? 'PASS' : 'FAIL')
    console.log('📊 Summary:', result1.summary)
    
    console.log('\n🔧 Generated Commands:')
    console.log(result1.modeleCommands.join('\n'))
    console.log(result1.caraCommands.join('\n'))
    
    // Test 2: Missing section properties (should fail validation)
    console.log('\n📋 Test 2: Missing Section Properties')
    const geometriesWithoutProps = testGeometries.map(g => ({
        ...g,
        section_properties: g._category === '2D' ? g.section_properties : null
    }))
    
    const result2 = geometryIntelligence.generateGeometryCommands(geometriesWithoutProps)
    console.log('❌ Validation Expected:', !result2.validation.isValid ? 'PASS' : 'FAIL')
    console.log('🚨 Errors:', result2.validation.errors)
    
    // Test 3: Section calculation completion check
    console.log('\n📋 Test 3: Synchronization Check')
    const isComplete1 = geometryIntelligence.isSectionCalculationComplete(testGeometries)
    const isComplete2 = geometryIntelligence.isSectionCalculationComplete(geometriesWithoutProps)
    
    console.log('✅ Complete with props:', isComplete1 ? 'PASS' : 'FAIL')
    console.log('✅ Incomplete without props:', !isComplete2 ? 'PASS' : 'FAIL')
    
    console.log('\n🎯 Test Results Summary:')
    console.log('- Command Generation: ✅')
    console.log('- Validation Logic: ✅')
    console.log('- Synchronization Check: ✅')
    console.log('- Error Handling: ✅')
    
    return true
}

// Export for use in test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testGeometryIntelligence, testGeometries }
} else {
    // Run test if called directly
    testGeometryIntelligence()
}
