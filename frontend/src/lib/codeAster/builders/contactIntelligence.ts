/**
 * Contact Intelligence Module
 * 
 * Generates Code_Aster commands for contact and kinematic relations:
 * - DEFI_CONTACT: True contact mechanics with friction, gap, etc.
 * - AFFE_CHAR_MECA with LIAISON_*: Simplified kinematic constraints
 * 
 * Supports:
 * - DEFI_CONTACT operator with all formulations (DISCRETE, CONTINUE, XFEM, LIAISON_UNIL)
 * - AFFE_CHAR_MECA with LIAISON_DDL, LIAISON_MAIL, LIAISON_GROUP, LIAISON_SOLIDE, LIAISON_ELEM
 * - Zone-based parameter configuration
 * - Real-time validation and error checking
 */

// --- TYPES & INTERFACES ---

export type ContactType = 
    | 'COLLAGE'      // DEFI_CONTACT - bonded contact
    | 'GLISSEMENT'   // DEFI_CONTACT - sliding contact  
    | 'FROTTEMENT'   // DEFI_CONTACT - frictional contact
    | 'LIAISON_DDL'  // AFFE_CHAR_MECA - DOF-to-DOF kinematic relations
    | 'LIAISON_MAIL' // AFFE_CHAR_MECA - mesh-based kinematic relations
    | 'LIAISON_GROUP'// AFFE_CHAR_MECA - group-based kinematic relations
    | 'LIAISON_SOLIDE'// AFFE_CHAR_MECA - rigid body constraints
    | 'LIAISON_ELEM'; // AFFE_CHAR_MECA - element-specific kinematic relations

export interface ContactZone {
    GROUP_MA_MAIT?: string;
    GROUP_MA_ESCL?: string;
    GROUP_NO_MAIT?: string;
    GROUP_NO_ESCL?: string;
    GROUP_NO_1?: string;
    GROUP_NO_2?: string;
    GROUP_MA_1?: string;
    GROUP_MA_2?: string;
    GROUP_NO?: string;
    GROUP_MA?: string;
    SANS_GROUP_MA_MAIT?: string;
    SANS_GROUP_MA_ESCL?: string;
    SANS_GROUP_NO_MAIT?: string;
    SANS_GROUP_NO_ESCL?: string;
    SANS_GROUP_NO?: string;
}

export interface ContactParameters {
    // DEFI_CONTACT parameters
    FORMULATION?: 'DISCRETE' | 'CONTINUE' | 'XFEM' | 'LIAISON_UNIL';
    FROTTEMENT?: 'SANS' | 'COULOMB';
    REAC_GEOM?: 'AUTOMATIQUE' | 'SANS' | 'CONTROLE';
    RESOLUTION?: 'OUI' | 'NON';
    STOP_INTERP?: 'OUI' | 'NON';
    ALGO_CONT?: 'CONTRAINTE' | 'PENALISATION' | 'GCP';
    ALGO_FROT?: 'PENALISATION';
    ALGO_RESO_CONT?: 'NEWTON' | 'POINT_FIXE';
    ALGO_RESO_FROT?: 'NEWTON' | 'POINT_FIXE';
    ALGO_RESO_GEOM?: 'POINT_FIXE' | 'NEWTON';
    ITER_CONT_TYPE?: 'MAXI' | 'MULT';
    ITER_CONT_MULT_GLOBAL?: number;
    ITER_CONT_MAXI?: number;
    ITER_FROT_MAXI?: number;
    ITER_GEOM_MAXI?: number;
    ITER_PRE_MAXI?: number;
    ITER_GCP_MAXI?: number;
    RESI_GEOM?: number;
    RESI_FROT?: number;
    RESI_ABSO?: number;
    COEF_RESI?: number;
    NB_RESOL?: number;
    STOP_SINGULIER?: 'OUI' | 'NON';
    ITER_CONT_MULT_DISCRETE?: number;
    GLISSIERE?: 'OUI' | 'NON';
    ALARME_JEU?: number;
    CONT_STAT_ELAS?: number;
    ADAPTATION?: 'NON' | 'CYCLAGE' | 'ADAPT_COEF' | 'TOUT';
    INTEGRATION?: 'AUTO' | 'GAUSS' | 'SIMPSON' | 'NCOTES';
    ORDRE_INT?: number;
    E_N?: number;
    E_T?: number;
    COULOMB?: number;
    COEF_MATR_FROT?: number;
    CONTACT_INIT?: 'INTERPENETRE' | 'OUI' | 'NON';
    SEUIL_INIT?: number;
    ALGO_CONT_ZONE?: 'STANDARD' | 'PENALISATION';
    COEF_CONT?: number;
    COEF_PENA_CONT?: number;
    PENE_MAXI?: number;
    ALGO_FROT_ZONE?: 'STANDARD' | 'PENALISATION';
    COEF_FROT?: number;
    COEF_PENA_FROT?: number;
    TOLE_INTERP_ZONE?: number;
    FISS_MAIT?: string;
    ELIM_ARETE?: 'DUAL' | 'ELIM';
    ALGO_LAGR?: 'AUTO' | 'VERSION1' | 'VERSION2' | 'VERSION3' | 'NON';
    RELATION?: 'CZM_EXP_REG' | 'CZM_LIN_REG' | 'CZM_TAC_MIX' | 'CZM_OUV_MIX' | 'CZM_LIN_MIX';
    ALGO_CONT_UNIL?: 'CONTRAINTE' | 'PENALISATION';
    COEF_PENA?: number;
    
    // AFFE_CHAR_MECA LIAISON_* parameters
    TYPE_RACCORD?: 'MASSIF' | 'COQUE' | 'MASSIF_COQUE' | 'COQUE_MASSIF';
    NOM_CMP?: string[];
    COEF_MULT?: number[];
    COEF_IMPO?: string | number;
    OPTION?: '3D_POU' | '3D_POU_ARLEQUIN' | '2D_POU' | 'COQ_POU' | '3D_TUYAU' | 'COQ_TUYAU' | 'PLAQ_POUT_ORTH';
    
    // Additional parameters for compatibility
    ELIM_MULT?: 'OUI' | 'NON';
    LISSAGE?: 'OUI' | 'NON';
    DISTANCE_MAX?: number;
}

export interface ContactDefinition {
    name: string;
    zone: ContactZone;
    parameters: ContactParameters;
    type: ContactType;
}

export interface ContactCommandResult {
    command: string;
    validation: {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
    metadata: {
        operator: 'DEFI_CONTACT' | 'AFFE_CHAR_MECA';
        formulation: string;
        frictionEnabled: boolean;
        zoneCount: number;
    };
}

// --- VALIDATION FUNCTIONS ---

function validateContactDefinition(contact: ContactDefinition): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Determine operator type based on contact type
    const isDefiContact = ['COLLAGE', 'GLISSEMENT', 'FROTTEMENT'].includes(contact.type);
    const isLiaison = ['LIAISON_DDL', 'LIAISON_MAIL', 'LIAISON_GROUP', 'LIAISON_SOLIDE', 'LIAISON_ELEM'].includes(contact.type);
    
    if (!isDefiContact && !isLiaison) {
        errors.push('Invalid contact type');
        return { isValid: false, errors, warnings };
    }
    
    // Validate based on operator type
    if (isDefiContact) {
        // DEFI_CONTACT validation
        if (!contact.zone.GROUP_MA_MAIT) {
            errors.push('Master group (GROUP_MA_MAIT) is required for DEFI_CONTACT');
        }
        
        if (!contact.zone.GROUP_MA_ESCL) {
            errors.push('Slave group (GROUP_MA_ESCL) is required for DEFI_CONTACT');
        }
        
        if (contact.zone.GROUP_MA_MAIT === contact.zone.GROUP_MA_ESCL) {
            errors.push('Master and slave groups must be different');
        }
        
        // Validate formulation
        const formulation = contact.parameters.FORMULATION || 'DISCRETE';
        if (!['DISCRETE', 'CONTINUE', 'XFEM', 'LIAISON_UNIL'].includes(formulation)) {
            errors.push('Invalid formulation. Must be DISCRETE, CONTINUE, XFEM, or LIAISON_UNIL');
        }
        
        // Validate friction parameters
        if (contact.parameters.FROTTEMENT === 'COULOMB') {
            const coulombValue = contact.parameters.COULOMB;
            if (coulombValue === undefined || coulombValue < 0) {
                errors.push('Friction coefficient (COULOMB) must be defined and non-negative when friction is enabled');
            }
            
            if (coulombValue !== undefined && coulombValue > 1) {
                warnings.push('Friction coefficient > 1 is unusual for most materials');
            }
        }
        
        // Validate algorithm combinations
        if (formulation === 'DISCRETE') {
            const algoCont = contact.parameters.ALGO_CONT;
            const algoFrot = contact.parameters.ALGO_FROT;
            
            if (algoCont === 'CONTRAINTE' && algoFrot === 'PENALISATION') {
                errors.push('CONTRAINTE algorithm cannot be combined with friction in DISCRETE formulation');
            }
            
            if (algoCont === 'GCP' && algoFrot === 'PENALISATION') {
                errors.push('GCP algorithm cannot be combined with friction in DISCRETE formulation');
            }
        }
        
    } else if (isLiaison) {
        // AFFE_CHAR_MECA LIAISON_* validation
        switch (contact.type) {
            case 'LIAISON_DDL':
                if (!contact.zone.GROUP_NO_1 || !contact.zone.GROUP_NO_2) {
                    errors.push('Both GROUP_NO_1 and GROUP_NO_2 are required for LIAISON_DDL');
                }
                if (!contact.parameters.NOM_CMP || contact.parameters.NOM_CMP.length === 0) {
                    errors.push('NOM_CMP (component list) is required for LIAISON_DDL');
                }
                if (contact.parameters.NOM_CMP && contact.parameters.COEF_MULT && 
                    contact.parameters.NOM_CMP.length !== contact.parameters.COEF_MULT.length) {
                    errors.push('NOM_CMP and COEF_MULT must have the same length');
                }
                break;
                
            case 'LIAISON_MAIL':
                if (!contact.zone.GROUP_MA_1 || !contact.zone.GROUP_MA_2) {
                    errors.push('Both GROUP_MA_1 and GROUP_MA_2 are required for LIAISON_MAIL');
                }
                if (!contact.parameters.TYPE_RACCORD) {
                    errors.push('TYPE_RACCORD is required for LIAISON_MAIL');
                }
                break;
                
            case 'LIAISON_GROUP':
                if (!contact.zone.GROUP_NO_1 || !contact.zone.GROUP_NO_2) {
                    errors.push('Both GROUP_NO_1 and GROUP_NO_2 are required for LIAISON_GROUP');
                }
                if (!contact.parameters.NOM_CMP || contact.parameters.NOM_CMP.length === 0) {
                    errors.push('NOM_CMP (component list) is required for LIAISON_GROUP');
                }
                break;
                
            case 'LIAISON_SOLIDE':
                if (!contact.zone.GROUP_NO) {
                    errors.push('GROUP_NO is required for LIAISON_SOLIDE');
                }
                break;
                
            case 'LIAISON_ELEM':
                if (!contact.zone.GROUP_MA) {
                    errors.push('GROUP_MA is required for LIAISON_ELEM');
                }
                if (!contact.parameters.OPTION) {
                    errors.push('OPTION is required for LIAISON_ELEM');
                }
                break;
        }
    }
    
    // Validate convergence criteria
    if (contact.parameters.RESI_GEOM !== undefined && contact.parameters.RESI_GEOM <= 0) {
        errors.push('Geometric convergence criterion (RESI_GEOM) must be positive');
    }
    
    if (contact.parameters.RESI_FROT !== undefined && contact.parameters.RESI_FROT <= 0) {
        errors.push('Friction convergence criterion (RESI_FROT) must be positive');
    }
    
    // Validate penalty coefficients
    if (contact.parameters.E_N !== undefined && contact.parameters.E_N <= 0) {
        errors.push('Normal penalty coefficient (E_N) must be positive');
    }
    
    if (contact.parameters.E_T !== undefined && contact.parameters.E_T <= 0) {
        errors.push('Tangential penalty coefficient (E_T) must be positive');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

// --- COMMAND GENERATION ---

function generateDefiContactCommand(contact: ContactDefinition): string {
    const globalParams = generateGlobalParameters(contact.parameters);
    const zoneParams = generateZoneParameters(contact.zone);
    const zoneSpecificParams = generateZoneParametersList(contact.parameters);
    
    // Build command structure
    let command = `${contact.name} = DEFI_CONTACT(\n`;
    
    // Add global parameters
    if (globalParams.length > 0) {
        command += `    ${globalParams.join(',\n    ')},\n`;
    }
    
    // Add zone definition
    command += `    ZONE = _F(\n`;
    command += `        ${zoneParams.concat(zoneSpecificParams).join(',\n        ')}\n`;
    command += `    )\n`;
    command += `);`;
    
    return command;
}

function generateLiaisonCommand(contact: ContactDefinition): string {
    switch (contact.type) {
        case 'LIAISON_DDL':
            return generateLiaisonDdlCommand(contact);
        case 'LIAISON_MAIL':
            return generateLiaisonMailCommand(contact);
        case 'LIAISON_GROUP':
            return generateLiaisonGroupCommand(contact);
        case 'LIAISON_SOLIDE':
            return generateLiaisonSolideCommand(contact);
        case 'LIAISON_ELEM':
            return generateLiaisonElemCommand(contact);
        default:
            return `// Error: Unknown LIAISON type: ${contact.type}`;
    }
}

function generateLiaisonDdlCommand(contact: ContactDefinition): string {
    const args: string[] = [];
    
    args.push(`GROUP_NO_1 = '${contact.zone.GROUP_NO_1}'`);
    args.push(`GROUP_NO_2 = '${contact.zone.GROUP_NO_2}'`);
    
    if (contact.parameters.NOM_CMP) {
        const cmpList = contact.parameters.NOM_CMP.map(c => `'${c}'`).join(', ');
        args.push(`NOM_CMP = (${cmpList})`);
    }
    
    if (contact.parameters.COEF_MULT) {
        args.push(`COEF_MULT = (${contact.parameters.COEF_MULT.join(', ')})`);
    }
    
    if (contact.parameters.COEF_IMPO !== undefined) {
        args.push(`COEF_IMPO = ${contact.parameters.COEF_IMPO}`);
    }
    
    return `${contact.name} = AFFE_CHAR_MECA(\n    MODELE = MODELE,\n    LIAISON_DDL = _F(\n        ${args.join(',\n        ')}\n    )\n);`;
}

function generateLiaisonMailCommand(contact: ContactDefinition): string {
    const args: string[] = [];
    
    args.push(`GROUP_MA_1 = '${contact.zone.GROUP_MA_1}'`);
    args.push(`GROUP_MA_2 = '${contact.zone.GROUP_MA_2}'`);
    
    if (contact.parameters.TYPE_RACCORD) {
        args.push(`TYPE_RACCORD = '${contact.parameters.TYPE_RACCORD}'`);
    }
    
    if (contact.parameters.ELIM_MULT === 'OUI') {
        args.push('ELIM_MULT = OUI');
    }
    
    if (contact.parameters.DISTANCE_MAX && contact.parameters.DISTANCE_MAX > 0) {
        args.push(`DISTANCE_MAX = ${contact.parameters.DISTANCE_MAX}`);
    }
    
    return `${contact.name} = AFFE_CHAR_MECA(\n    MODELE = MODELE,\n    LIAISON_MAIL = _F(\n        ${args.join(',\n        ')}\n    )\n);`;
}

function generateLiaisonGroupCommand(contact: ContactDefinition): string {
    const args: string[] = [];
    
    args.push(`GROUP_NO_1 = '${contact.zone.GROUP_NO_1}'`);
    args.push(`GROUP_NO_2 = '${contact.zone.GROUP_NO_2}'`);
    
    if (contact.parameters.NOM_CMP) {
        const cmpList = contact.parameters.NOM_CMP.map(c => `'${c}'`).join(', ');
        args.push(`NOM_CMP = (${cmpList})`);
    }
    
    if (contact.parameters.COEF_MULT) {
        args.push(`COEF_MULT = (${contact.parameters.COEF_MULT.join(', ')})`);
    }
    
    if (contact.parameters.COEF_IMPO !== undefined) {
        args.push(`COEF_IMPO = ${contact.parameters.COEF_IMPO}`);
    }
    
    return `${contact.name} = AFFE_CHAR_MECA(\n    MODELE = MODELE,\n    LIAISON_GROUP = _F(\n        ${args.join(',\n        ')}\n    )\n);`;
}

function generateLiaisonSolideCommand(contact: ContactDefinition): string {
    const args: string[] = [];
    
    args.push(`GROUP_NO = '${contact.zone.GROUP_NO}'`);
    
    if (contact.zone.SANS_GROUP_NO) {
        args.push(`SANS_GROUP_NO = '${contact.zone.SANS_GROUP_NO}'`);
    }
    
    return `${contact.name} = AFFE_CHAR_MECA(\n    MODELE = MODELE,\n    LIAISON_SOLIDE = _F(\n        ${args.join(',\n        ')}\n    )\n);`;
}

function generateLiaisonElemCommand(contact: ContactDefinition): string {
    const args: string[] = [];
    
    args.push(`GROUP_MA = '${contact.zone.GROUP_MA}'`);
    
    if (contact.parameters.OPTION) {
        args.push(`OPTION = '${contact.parameters.OPTION}'`);
    }
    
    return `${contact.name} = AFFE_CHAR_MECA(\n    MODELE = MODELE,\n    LIAISON_ELEM = _F(\n        ${args.join(',\n        ')}\n    )\n);`;
}

function generateZoneParameters(zone: ContactZone): string[] {
    const params: string[] = [];
    
    // Required parameters for DEFI_CONTACT
    if (zone.GROUP_MA_MAIT) params.push(`GROUP_MA_MAIT = '${zone.GROUP_MA_MAIT}'`);
    if (zone.GROUP_MA_ESCL) params.push(`GROUP_MA_ESCL = '${zone.GROUP_MA_ESCL}'`);
    
    // Optional group parameters
    if (zone.GROUP_NO_MAIT) params.push(`GROUP_NO_MAIT = '${zone.GROUP_NO_MAIT}'`);
    if (zone.GROUP_NO_ESCL) params.push(`GROUP_NO_ESCL = '${zone.GROUP_NO_ESCL}'`);
    if (zone.SANS_GROUP_MA_MAIT) params.push(`SANS_GROUP_MA_MAIT = '${zone.SANS_GROUP_MA_MAIT}'`);
    if (zone.SANS_GROUP_MA_ESCL) params.push(`SANS_GROUP_MA_ESCL = '${zone.SANS_GROUP_MA_ESCL}'`);
    if (zone.SANS_GROUP_NO_MAIT) params.push(`SANS_GROUP_NO_MAIT = '${zone.SANS_GROUP_NO_MAIT}'`);
    if (zone.SANS_GROUP_NO_ESCL) params.push(`SANS_GROUP_NO_ESCL = '${zone.SANS_GROUP_NO_ESCL}'`);
    
    // Parameters for LIAISON_* types
    if (zone.GROUP_NO_1) params.push(`GROUP_NO_1 = '${zone.GROUP_NO_1}'`);
    if (zone.GROUP_NO_2) params.push(`GROUP_NO_2 = '${zone.GROUP_NO_2}'`);
    if (zone.GROUP_MA_1) params.push(`GROUP_MA_1 = '${zone.GROUP_MA_1}'`);
    if (zone.GROUP_MA_2) params.push(`GROUP_MA_2 = '${zone.GROUP_MA_2}'`);
    if (zone.GROUP_NO) params.push(`GROUP_NO = '${zone.GROUP_NO}'`);
    if (zone.GROUP_MA) params.push(`GROUP_MA = '${zone.GROUP_MA}'`);
    
    return params;
}

function generateGlobalParameters(parameters: ContactParameters): string[] {
    const params: string[] = [];
    
    // Formulation
    if (parameters.FORMULATION) {
        params.push(`FORMULATION = '${parameters.FORMULATION}'`);
    }
    
    // Friction
    if (parameters.FROTTEMENT) {
        params.push(`FROTTEMENT = '${parameters.FROTTEMENT}'`);
    }
    
    // Geometric reactualization
    if (parameters.REAC_GEOM) {
        params.push(`REAC_GEOM = '${parameters.REAC_GEOM}'`);
    }
    
    // Resolution mode
    if (parameters.RESOLUTION) {
        params.push(`RESOLUTION = '${parameters.RESOLUTION}'`);
    }
    
    // Algorithm selection
    if (parameters.ALGO_CONT) params.push(`ALGO_CONT = '${parameters.ALGO_CONT}'`);
    if (parameters.ALGO_FROT) params.push(`ALGO_FROT = '${parameters.ALGO_FROT}'`);
    if (parameters.ALGO_RESO_CONT) params.push(`ALGO_RESO_CONT = '${parameters.ALGO_RESO_CONT}'`);
    if (parameters.ALGO_RESO_FROT) params.push(`ALGO_RESO_FROT = '${parameters.ALGO_RESO_FROT}'`);
    if (parameters.ALGO_RESO_GEOM) params.push(`ALGO_RESO_GEOM = '${parameters.ALGO_RESO_GEOM}'`);
    
    // Iteration controls
    if (parameters.ITER_CONT_TYPE) params.push(`ITER_CONT_TYPE = '${parameters.ITER_CONT_TYPE}'`);
    if (parameters.ITER_CONT_MULT_GLOBAL !== undefined) params.push(`ITER_CONT_MULT = ${parameters.ITER_CONT_MULT_GLOBAL}`);
    if (parameters.ITER_CONT_MAXI !== undefined) params.push(`ITER_CONT_MAXI = ${parameters.ITER_CONT_MAXI}`);
    if (parameters.ITER_FROT_MAXI !== undefined) params.push(`ITER_FROT_MAXI = ${parameters.ITER_FROT_MAXI}`);
    if (parameters.ITER_GEOM_MAXI !== undefined) params.push(`ITER_GEOM_MAXI = ${parameters.ITER_GEOM_MAXI}`);
    if (parameters.ITER_PRE_MAXI !== undefined) params.push(`ITER_PRE_MAXI = ${parameters.ITER_PRE_MAXI}`);
    if (parameters.ITER_GCP_MAXI !== undefined) params.push(`ITER_GCP_MAXI = ${parameters.ITER_GCP_MAXI}`);
    
    // Convergence criteria
    if (parameters.RESI_GEOM !== undefined) params.push(`RESI_GEOM = ${parameters.RESI_GEOM}`);
    if (parameters.RESI_FROT !== undefined) params.push(`RESI_FROT = ${parameters.RESI_FROT}`);
    if (parameters.RESI_ABSO !== undefined) params.push(`RESI_ABSO = ${parameters.RESI_ABSO}`);
    if (parameters.COEF_RESI !== undefined) params.push(`COEF_RESI = ${parameters.COEF_RESI}`);
    
    // Discrete formulation specific
    if (parameters.NB_RESOL !== undefined) params.push(`NB_RESOL = ${parameters.NB_RESOL}`);
    if (parameters.STOP_SINGULIER) params.push(`STOP_SINGULIER = '${parameters.STOP_SINGULIER}'`);
    if (parameters.ITER_CONT_MULT_DISCRETE !== undefined) params.push(`ITER_CONT_MULT = ${parameters.ITER_CONT_MULT_DISCRETE}`);
    if (parameters.GLISSIERE) params.push(`GLISSIERE = '${parameters.GLISSIERE}'`);
    if (parameters.ALARME_JEU !== undefined) params.push(`ALARME_JEU = ${parameters.ALARME_JEU}`);
    
    // Continuous formulation specific
    if (parameters.CONT_STAT_ELAS !== undefined) params.push(`CONT_STAT_ELAS = ${parameters.CONT_STAT_ELAS}`);
    if (parameters.ADAPTATION) params.push(`ADAPTATION = '${parameters.ADAPTATION}'`);
    if (parameters.INTEGRATION) params.push(`INTEGRATION = '${parameters.INTEGRATION}'`);
    if (parameters.ORDRE_INT !== undefined) params.push(`ORDRE_INT = ${parameters.ORDRE_INT}`);
    
    // Global tolerance
    if (parameters.TOLE_INTERP_ZONE !== undefined) params.push(`TOLE_INTERP = ${parameters.TOLE_INTERP_ZONE}`);
    if (parameters.STOP_INTERP) params.push(`STOP_INTERP = '${parameters.STOP_INTERP}'`);
    
    return params;
}

function generateZoneParametersList(parameters: ContactParameters): string[] {
    const params: string[] = [];
    
    // Zone-specific parameters
    if (parameters.E_N !== undefined) params.push(`E_N = ${parameters.E_N}`);
    if (parameters.E_T !== undefined) params.push(`E_T = ${parameters.E_T}`);
    if (parameters.COULOMB !== undefined) params.push(`COULOMB = ${parameters.COULOMB}`);
    if (parameters.COEF_MATR_FROT !== undefined) params.push(`COEF_MATR_FROT = ${parameters.COEF_MATR_FROT}`);
    if (parameters.CONTACT_INIT) params.push(`CONTACT_INIT = '${parameters.CONTACT_INIT}'`);
    if (parameters.SEUIL_INIT !== undefined) params.push(`SEUIL_INIT = ${parameters.SEUIL_INIT}`);
    if (parameters.ALGO_CONT_ZONE) params.push(`ALGO_CONT = '${parameters.ALGO_CONT_ZONE}'`);
    if (parameters.COEF_CONT !== undefined) params.push(`COEF_CONT = ${parameters.COEF_CONT}`);
    if (parameters.COEF_PENA_CONT !== undefined) params.push(`COEF_PENA_CONT = ${parameters.COEF_PENA_CONT}`);
    if (parameters.PENE_MAXI !== undefined) params.push(`PENE_MAXI = ${parameters.PENE_MAXI}`);
    if (parameters.ALGO_FROT_ZONE) params.push(`ALGO_FROT = '${parameters.ALGO_FROT_ZONE}'`);
    if (parameters.COEF_FROT !== undefined) params.push(`COEF_FROT = ${parameters.COEF_FROT}`);
    if (parameters.COEF_PENA_FROT !== undefined) params.push(`COEF_PENA_FROT = ${parameters.COEF_PENA_FROT}`);
    if (parameters.TOLE_INTERP_ZONE !== undefined) params.push(`TOLE_INTERP = ${parameters.TOLE_INTERP_ZONE}`);
    
    // XFEM specific
    if (parameters.FISS_MAIT) params.push(`FISS_MAIT = ${parameters.FISS_MAIT}`);
    if (parameters.ELIM_ARETE) params.push(`ELIM_ARETE = '${parameters.ELIM_ARETE}'`);
    if (parameters.ALGO_LAGR) params.push(`ALGO_LAGR = '${parameters.ALGO_LAGR}'`);
    if (parameters.RELATION) params.push(`RELATION = '${parameters.RELATION}'`);
    
    // LIAISON_UNIL specific
    if (parameters.NOM_CMP) params.push(`NOM_CMP = (${parameters.NOM_CMP.map(c => `'${c}'`).join(', ')})`);
    if (parameters.COEF_IMPO) params.push(`COEF_IMPO = ${parameters.COEF_IMPO}`);
    if (parameters.COEF_MULT) params.push(`COEF_MULT = (${parameters.COEF_MULT.join(', ')})`);
    if (parameters.ALGO_CONT_UNIL) params.push(`ALGO_CONT = '${parameters.ALGO_CONT_UNIL}'`);
    if (parameters.COEF_PENA !== undefined) params.push(`COEF_PENA = ${parameters.COEF_PENA}`);
    
    return params;
}

export class ContactIntelligence {
    
    /**
     * Generate complete Code_Aster command for a contact definition
     */
    generateContactCommand(contact: ContactDefinition): ContactCommandResult {
        const validation = validateContactDefinition(contact);
        
        if (!validation.isValid) {
            return {
                command: `// Error: Invalid contact definition\n${validation.errors.join('\n')}`,
                validation,
                metadata: {
                    operator: 'DEFI_CONTACT',
                    formulation: contact.parameters.FORMULATION || 'DISCRETE',
                    frictionEnabled: contact.parameters.FROTTEMENT === 'COULOMB',
                    zoneCount: 1
                }
            };
        }
        
        // Determine command type based on contact type
        const isDefiContact = ['COLLAGE', 'GLISSEMENT', 'FROTTEMENT'].includes(contact.type);
        let command: string;
        let operator: 'DEFI_CONTACT' | 'AFFE_CHAR_MECA';
        
        if (isDefiContact) {
            command = generateDefiContactCommand(contact);
            operator = 'DEFI_CONTACT';
        } else {
            command = generateLiaisonCommand(contact);
            operator = 'AFFE_CHAR_MECA';
        }
        
        return {
            command,
            validation,
            metadata: {
                operator,
                formulation: contact.parameters.FORMULATION || 'DISCRETE',
                frictionEnabled: contact.parameters.FROTTEMENT === 'COULOMB',
                zoneCount: 1
            }
        };
    }
    
    /**
     * Generate multiple contact commands for an array of contact definitions
     */
    generateMultipleContactCommands(contacts: ContactDefinition[]): ContactCommandResult[] {
        return contacts.map(contact => this.generateContactCommand(contact));
    }
    
    /**
     * Get default parameters for different contact types
     */
    getDefaultParameters(type: ContactType): ContactParameters {
        const baseParams: ContactParameters = {};
        
        switch (type) {
            case 'COLLAGE':
                return {
                    ...baseParams,
                    FORMULATION: 'DISCRETE',
                    ALGO_CONT: 'CONTRAINTE',
                    ELIM_MULT: 'OUI',
                    DISTANCE_MAX: 0.0
                };
                
            case 'GLISSEMENT':
                return {
                    ...baseParams,
                    FORMULATION: 'CONTINUE',
                    ALGO_RESO_GEOM: 'POINT_FIXE',
                    LISSAGE: 'OUI',
                    CONT_STAT_ELAS: 0
                };
                
            case 'FROTTEMENT':
                return {
                    ...baseParams,
                    FORMULATION: 'CONTINUE',
                    FROTTEMENT: 'COULOMB',
                    COULOMB: 0.3,
                    ALGO_RESO_FROT: 'NEWTON',
                    ALGO_RESO_GEOM: 'POINT_FIXE',
                    LISSAGE: 'OUI',
                    CONT_STAT_ELAS: 0,
                    RESI_FROT: 0.0001
                };
                
            case 'LIAISON_DDL':
                return {
                    ...baseParams,
                    NOM_CMP: ['DX', 'DY', 'DZ'],
                    COEF_MULT: [1.0, -1.0]
                };
                
            case 'LIAISON_MAIL':
                return {
                    ...baseParams,
                    TYPE_RACCORD: 'MASSIF',
                    ELIM_MULT: 'OUI'
                };
                
            case 'LIAISON_GROUP':
                return {
                    ...baseParams,
                    NOM_CMP: ['DX', 'DY', 'DZ']
                };
                
            case 'LIAISON_SOLIDE':
                return {
                    ...baseParams
                };
                
            case 'LIAISON_ELEM':
                return {
                    ...baseParams,
                    OPTION: '3D_POU'
                };
                
            default:
                return baseParams;
        }
    }
    
    /**
     * Validate contact configuration against mesh topology
     */
    validateContactTopology(
        masterGroup: string, 
        slaveGroup: string, 
        groupDimensions: Record<string, number>
    ): { isValid: boolean; recommendations: string[] } {
        const recommendations: string[] = [];
        let isValid = true;
        
        const masterDim = groupDimensions[masterGroup] ?? 3;
        const slaveDim = groupDimensions[slaveGroup] ?? 3;
        
        // Check for incompatible dimensional combinations
        if (masterDim === 0 && slaveDim === 0) {
            isValid = false;
            recommendations.push('Node-to-node contacts are not supported. Use at least one surface or volume group.');
        }
        
        // Provide recommendations based on dimensional analysis
        if (masterDim === 3 && slaveDim === 1) {
            recommendations.push('Consider using MASSIF_COQUE for embedding beam elements in solid volume.');
        }
        
        if (masterDim === 2 && slaveDim === 2) {
            recommendations.push('Shell-to-shell contact is well supported. Consider CONTINUE formulation for curved surfaces.');
        }
        
        if (masterDim === 1 && slaveDim === 1) {
            recommendations.push('Beam-to-beam contact requires careful alignment. Ensure beams are properly oriented.');
        }
        
        return { isValid, recommendations };
    }
}

// --- UTILITY FUNCTIONS ---

/**
 * Create a contact definition from simplified contact configuration
 */
export function createContactDefinition(
    name: string,
    masterGroup: string,
    slaveGroup: string,
    type: 'COLLAGE' | 'GLISSEMENT' | 'FROTTEMENT',
    additionalParams: Partial<ContactParameters> = {}
): ContactDefinition {
    const intelligence = new ContactIntelligence();
    
    return {
        name,
        zone: {
            GROUP_MA_MAIT: masterGroup,
            GROUP_MA_ESCL: slaveGroup
        },
        parameters: {
            ...intelligence.getDefaultParameters(type),
            ...additionalParams
        },
        type
    };
}

/**
 * Extract contact type from parameters
 */
export function determineContactType(parameters: ContactParameters): 'COLLAGE' | 'GLISSEMENT' | 'FROTTEMENT' {
    if (parameters.FROTTEMENT === 'COULOMB') {
        return 'FROTTEMENT';
    }
    
    if (parameters.FORMULATION === 'CONTINUE' || parameters.FORMULATION === 'XFEM') {
        return 'GLISSEMENT';
    }
    
    return 'COLLAGE';
}

// Export singleton instance
export const contactIntelligence = new ContactIntelligence();
