# Group Selection & Filtering Plan

## Overview
Create intelligent group selection and filtering system for Contact Pairs Tab. When user selects a group (e.g., 1D), the other selector automatically filters to show only compatible groups based on contactPairs.json dimensional combinations.

## Project Type
**WEB** - Frontend React component enhancement for existing ProSolve simulation interface

## Success Criteria
- [ ] User can select master group from all available groups
- [ ] Slave group selector filters based on master selection
- [ ] Filtering follows contactPairs.json rules (1D_2D, 1D_3D, etc.)
- [ ] Visual feedback shows filtering is active
- [ ] No incompatible combinations can be selected
- [ ] Existing functionality preserved

## Tech Stack
- **Frontend**: React with TypeScript
- **State Management**: Custom hooks (useContactPairs)
- **Data Source**: contactPairs.json (existing)
- **UI**: Existing component architecture with Framer Motion
- **Build**: Vite (already configured)

## Current State Analysis
Based on existing codebase:
- ✅ contactPairs.json exists with 1D_2D, 1D_3D, 2D_2D, 2D_3D, 3D_3D pairs
- ✅ GroupSelector component exists with master/slave selection
- ✅ useContactPairs hook manages contact logic
- ✅ Dimensional detection patterns implemented
- ❌ No filtering between master/slave selectors
- ❌ All groups always visible in both selectors

## File Structure
```
frontend/src/
├── components/config/
│   ├── GroupSelector.tsx          # MODIFY: Add filtering props
│   ├── ContactConfig.tsx         # MODIFY: Pass filtered groups
│   └── IntelligentContactCard.tsx # MODIFY: Use filtered groups
├── hooks/
│   └── useContactPairs.ts        # MODIFY: Add filtering logic
├── lib/
│   ├── contactIntelligence.ts     # MODIFY: Add compatibility matrix
│   └── dimensionalCompatibility.ts # NEW: Filtering utilities
└── types/
    └── contact.ts                 # MODIFY: Add filtering types
```

## Task Breakdown

### Phase 1: Foundation (Analysis & Planning)

#### Task 1: Create Compatibility Matrix
**task_id**: filter-001  
**agent**: frontend-specialist  
**priority**: P0  
**dependencies**: none  

**INPUT→OUTPUT→VERIFY**:
- INPUT: contactPairs.json structure
- OUTPUT: dimensionalCompatibility.ts with compatibility matrix logic
- VERIFY: Matrix correctly maps 1D→[2D,3D], 2D→[1D,2,3], 3D→[1D,2,3]

#### Task 2: Extend Type Definitions
**task_id**: filter-002  
**agent**: frontend-specialist  
**priority**: P0  
**dependencies**: filter-001  

**INPUT→OUTPUT→VERIFY**:
- INPUT: UseContactPairsReturn interface
- OUTPUT: Updated types with availableMasterGroups, availableSlaveGroups
- VERIFY: TypeScript compiles without errors

#### Task 3: Enhance useContactPairs Hook
**task_id**: filter-003  
**agent**: frontend-specialist  
**priority**: P1  
**dependencies**: filter-001, filter-002  

**INPUT→OUTPUT→VERIFY**:
- INPUT: Existing hook with group dimensions
- OUTPUT: Hook with filtered group logic and compatibility checking
- VERIFY: Hook returns correct filtered arrays for test scenarios

### Phase 2: UI Integration

#### Task 4: Update GroupSelector Component
**task_id**: filter-004  
**agent**: frontend-specialist  
**priority**: P1  
**dependencies**: filter-003  

**INPUT→OUTPUT→VERIFY**:
- INPUT: GroupSelector with all groups visible
- OUTPUT: GroupSelector with filtered group support and visual indicators
- VERIFY: Component shows only available groups and filtering status

#### Task 5: Update IntelligentContactCard
**task_id**: filter-005  
**agent**: frontend-specialist  
**priority**: P1  
**dependencies**: filter-004  

**INPUT→OUTPUT→VERIFY**:
- INPUT: Card using unfiltered GroupSelector
- OUTPUT: Card passing filtered groups to GroupSelector
- VERIFY: Card correctly passes master/slave filtered arrays

#### Task 6: Update ContactConfig Integration
**task_id**: filter-006  
**agent**: frontend-specialist  
**priority**: P2  
**dependencies**: filter-005  

**INPUT→OUTPUT→VERIFY**:
- INPUT: ContactConfig with existing contact system
- OUTPUT: ContactConfig using enhanced filtering system
- VERIFY: All contact cards use filtered group selection

### Phase 3: Testing & Polish

#### Task 7: Create Test Scenarios
**task_id**: filter-007  
**agent**: test-engineer  
**priority**: P2  
**dependencies**: filter-006  

**INPUT→OUTPUT→VERIFY**:
- INPUT: Working filtering system
- OUTPUT: Test cases for all dimensional combinations
- VERIFY: All scenarios pass (1D→excludes 1D, 2D→shows all, 3D→shows all)

#### Task 8: Visual Feedback Enhancement
**task_id**: filter-008  
**agent**: frontend-specialist  
**priority**: P3  
**dependencies**: filter-007  

**INPUT→OUTPUT→VERIFY**:
- INPUT: Functional filtering with basic UI
- OUTPUT: Enhanced visual indicators and animations
- VERIFY: Clear feedback when filtering is active

## Phase X: Verification

### Pre-Launch Checklist
- [ ] **Build Test**: `npm run build` completes without errors
- [ ] **Type Check**: `npx tsc --noEmit` passes
- [ ] **Filter Logic**: 1D selection excludes other 1D groups
- [ ] **Filter Logic**: 2D selection shows all compatible groups  
- [ ] **Filter Logic**: 3D selection shows all compatible groups
- [ ] **UI Feedback**: Filtering indicator appears correctly
- [ ] **Backwards Compatibility**: Existing functionality preserved
- [ ] **Edge Cases**: Empty groups, same group selection handled

### Manual Testing Steps
1. **Test 1D Filtering**:
   - Select 1D group (beam_nodes)
   - Verify slave selector shows only 2D/3D groups
   - Verify 1D groups are hidden/disabled

2. **Test 2D Filtering**:
   - Select 2D group (shell_edges)  
   - Verify slave selector shows all compatible groups
   - Verify selected master group is excluded

3. **Test 3D Filtering**:
   - Select 3D group (solid_faces)
   - Verify slave selector shows all compatible groups
   - Verify selected master group is excluded

4. **Test Visual Feedback**:
   - Verify "Filtered (X/Y)" indicator appears
   - Verify disabled state for incompatible groups
   - Verify animations work smoothly

### Success Metrics
- **Zero TypeScript errors**
- **All filtering scenarios work correctly**
- **Visual feedback is clear and intuitive**
- **No regression in existing functionality**
- **Build completes successfully**

## Implementation Notes

### Key Decisions
1. **Bidirectional Filtering**: Only slave selector filtered (master shows all options)
2. **Visual Priority**: Subtle filtering indicator to avoid UI clutter
3. **Performance**: Memoized filtering to prevent unnecessary recalculations
4. **Backwards Compatibility**: All existing props and functionality preserved

### Risk Mitigation
- **Rollback**: Existing GroupSelector logic preserved as fallback
- **Testing**: Comprehensive test coverage for all dimensional combinations
- **Performance**: Filtering logic is O(n) and memoized
- **UX**: Clear visual feedback prevents user confusion

## Dependencies
- **Existing**: contactPairs.json, React, TypeScript, Framer Motion
- **New**: None (uses existing tech stack)
- **External**: None (self-contained enhancement)

---

*This plan focuses on intelligent group filtering while maintaining the existing robust contact system architecture.*
