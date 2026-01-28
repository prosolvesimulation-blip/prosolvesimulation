"""
Code_Aster Command Intelligence Module
Provides intelligent command generation, validation, and parameter mapping
for AFFE_CHAR_MECA operations in ProSolve simulation.
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import re
import json

class LoadType(Enum):
    FORCE_NODALE = "FORCE_NODALE"
    FORCE_ARETE = "FORCE_ARETE"
    FORCE_FACE = "FORCE_FACE"
    PRES_REP = "PRES_REP"
    PESANTEUR = "PESANTEUR"

class MeshTopology(Enum):
    NODE = "NODE"
    WIRE = "WIRE"
    SURFACE = "SURFACE"
    VOLUME = "VOLUME"

@dataclass
class ParameterRule:
    """Validation rule for Code_Aster parameters"""
    name: str
    required: bool = False
    type_hint: str = "float"
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    depends_on: Optional[List[str]] = None
    conflicts_with: Optional[List[str]] = None
    default_value: Optional[Any] = None

@dataclass
class LoadDefinition:
    """Enhanced load definition with Code_Aster intelligence"""
    load_type: LoadType
    label: str
    description: str
    allowed_topology: List[MeshTopology]
    group_prefix: str  # GROUP_NO or GROUP_MA
    parameter_rules: List[ParameterRule]
    template_name: str
    requires_modele: bool = True
    optional_params: List[str] = None

class CodeAsterIntelligence:
    """Core intelligence engine for Code_Aster command generation"""
    
    def __init__(self):
        self.load_definitions = self._initialize_load_definitions()
        self.validation_errors = []
        self.warnings = []
    
    def _initialize_load_definitions(self) -> Dict[LoadType, LoadDefinition]:
        """Initialize enhanced load definitions with Code_Aster syntax rules"""
        
        return {
            LoadType.FORCE_NODALE: LoadDefinition(
                load_type=LoadType.FORCE_NODALE,
                label="Nodal Force",
                description="Point loads on nodes (AFFE_CHAR_MECA/FORCE_NODALE)",
                allowed_topology=[MeshTopology.NODE],
                group_prefix="GROUP_NO",
                parameter_rules=[
                    ParameterRule("FX", required=False, type_hint="float"),
                    ParameterRule("FY", required=False, type_hint="float"),
                    ParameterRule("FZ", required=False, type_hint="float"),
                    ParameterRule("MX", required=False, type_hint="float"),
                    ParameterRule("MY", required=False, type_hint="float"),
                    ParameterRule("MZ", required=False, type_hint="float"),
                ],
                template_name="force_nodale.j2"
            ),
            
            LoadType.FORCE_ARETE: LoadDefinition(
                load_type=LoadType.FORCE_ARETE,
                label="Edge Force",
                description="Linear load on edges (AFFE_CHAR_MECA/FORCE_ARETE)",
                allowed_topology=[MeshTopology.WIRE],
                group_prefix="GROUP_MA",
                parameter_rules=[
                    ParameterRule("FX", required=False, type_hint="float"),
                    ParameterRule("FY", required=False, type_hint="float"),
                    ParameterRule("FZ", required=False, type_hint="float"),
                ],
                template_name="force_arete.j2"
            ),
            
            LoadType.FORCE_FACE: LoadDefinition(
                load_type=LoadType.FORCE_FACE,
                label="Face Force",
                description="Surface traction vector (AFFE_CHAR_MECA/FORCE_FACE)",
                allowed_topology=[MeshTopology.SURFACE],
                group_prefix="GROUP_MA",
                parameter_rules=[
                    ParameterRule("FX", required=False, type_hint="float"),
                    ParameterRule("FY", required=False, type_hint="float"),
                    ParameterRule("FZ", required=False, type_hint="float"),
                ],
                template_name="force_face.j2"
            ),
            
            LoadType.PRES_REP: LoadDefinition(
                load_type=LoadType.PRES_REP,
                label="Pressure",
                description="Normal pressure (AFFE_CHAR_MECA/PRES_REP)",
                allowed_topology=[MeshTopology.SURFACE, MeshTopology.VOLUME],
                group_prefix="GROUP_MA",
                parameter_rules=[
                    ParameterRule("PRES", required=True, type_hint="float", min_value=0),
                ],
                template_name="pres_rep.j2"
            ),
            
            LoadType.PESANTEUR: LoadDefinition(
                load_type=LoadType.PESANTEUR,
                label="Gravity",
                description="Global acceleration field (AFFE_CHAR_MECA/PESANTEUR)",
                allowed_topology=[MeshTopology.VOLUME],
                group_prefix="GROUP_MA",
                parameter_rules=[
                    ParameterRule("GRAVITE", required=True, type_hint="float", min_value=0, default_value=9.81),
                    ParameterRule("DIRECTION", required=True, type_hint="vector3d", default_value=[0, 0, -1]),
                ],
                template_name="pesanteur.j2",
                optional_params=["GROUP_MA"]  # Optional for global gravity
            )
        }
    
    def validate_load_parameters(self, load_type: LoadType, parameters: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate parameters against Code_Aster rules"""
        self.validation_errors.clear()
        self.warnings.clear()
        
        if load_type not in self.load_definitions:
            self.validation_errors.append(f"Unknown load type: {load_type}")
            return False, self.validation_errors
        
        definition = self.load_definitions[load_type]
        
        # Check required parameters
        for rule in definition.parameter_rules:
            if rule.required and rule.name not in parameters:
                self.validation_errors.append(f"Required parameter '{rule.name}' is missing")
            elif rule.name in parameters:
                value = parameters[rule.name]
                
                # Type validation
                if rule.type_hint == "float":
                    try:
                        float_value = float(value)
                        parameters[rule.name] = float_value  # Normalize to float
                        
                        # Range validation
                        if rule.min_value is not None and float_value < rule.min_value:
                            self.validation_errors.append(f"{rule.name} must be >= {rule.min_value}")
                        if rule.max_value is not None and float_value > rule.max_value:
                            self.validation_errors.append(f"{rule.name} must be <= {rule.max_value}")
                    except (ValueError, TypeError):
                        self.validation_errors.append(f"{rule.name} must be a numeric value")
                
                elif rule.type_hint == "vector3d":
                    if isinstance(value, list) and len(value) == 3:
                        try:
                            parameters[rule.name] = [float(v) for v in value]
                        except (ValueError, TypeError):
                            self.validation_errors.append(f"{rule.name} must be a 3-element numeric vector")
                    else:
                        self.validation_errors.append(f"{rule.name} must be a 3-element vector")
        
        # Check for at least one force component for force loads
        if load_type in [LoadType.FORCE_NODALE, LoadType.FORCE_ARETE, LoadType.FORCE_FACE]:
            has_force = any(param in parameters for param in ["FX", "FY", "FZ"])
            if not has_force:
                self.warnings.append("No force components specified. Load will have no effect.")
        
        return len(self.validation_errors) == 0, self.validation_errors
    
    def generate_command_syntax(self, load_type: LoadType, parameters: Dict[str, Any], 
                               target_group: str = "", result_name: str = "load_1") -> Dict[str, Any]:
        """Generate complete AFFE_CHAR_MECA command syntax"""
        
        # Validate first
        is_valid, errors = self.validate_load_parameters(load_type, parameters)
        if not is_valid:
            return {
                "status": "error",
                "errors": errors,
                "command": None
            }
        
        definition = self.load_definitions[load_type]
        
        # Build command structure
        command = {
            "status": "success",
            "load_type": load_type.value,
            "result_name": result_name,
            "template": definition.template_name,
            "parameters": {}
        }
        
        # Add MODELE if required
        if definition.requires_modele:
            command["parameters"]["MODELE"] = "{{ modele }}"  # Jinja2 template variable
        
        # Add group specification
        if target_group or load_type != LoadType.PESANTEUR:
            group_key = definition.group_prefix
            command["parameters"][group_key] = f"'{target_group}'"
        
        # Add load-specific parameters
        load_block = {}
        for rule in definition.parameter_rules:
            if rule.name in parameters:
                value = parameters[rule.name]
                if rule.type_hint == "vector3d":
                    load_block[rule.name] = f"({value[0]}, {value[1]}, {value[2]})"
                else:
                    load_block[rule.name] = value
        
        # Add the load block
        command["parameters"][load_type.value] = f"_F({', '.join([f'{k}={v}' for k, v in load_block.items()])})"
        
        # Add optional AFFE_CHAR_MECA parameters
        optional_params = {
            "DOUBLE_LAGRANGE": "'NON'",
            "INFO": 1,
            "VERI_NORM": "'NON'",
            "VERI_AFFE": "'NON'"
        }
        command["parameters"].update(optional_params)
        
        return command
    
    def get_frontend_metadata(self, load_type: LoadType) -> Dict[str, Any]:
        """Get metadata for frontend LoadConfig component"""
        if load_type not in self.load_definitions:
            return {}
        
        definition = self.load_definitions[load_type]
        
        return {
            "load_type": load_type.value,
            "label": definition.label,
            "description": definition.description,
            "allowed_topology": [t.value for t in definition.allowed_topology],
            "group_prefix": definition.group_prefix,
            "parameter_rules": [
                {
                    "name": rule.name,
                    "required": rule.required,
                    "type_hint": rule.type_hint,
                    "min_value": rule.min_value,
                    "max_value": rule.max_value,
                    "default_value": rule.default_value
                }
                for rule in definition.parameter_rules
            ],
            "validation_hints": self._get_validation_hints(load_type)
        }
    
    def _get_validation_hints(self, load_type: LoadType) -> List[str]:
        """Get validation hints for frontend"""
        hints = []
        
        if load_type == LoadType.PRES_REP:
            hints.append("Pressure must be positive (Pa)")
        elif load_type == LoadType.PESANTEUR:
            hints.append("Gravity typically 9.81 m/s²")
            hints.append("Direction: (0,0,-1) for standard Earth gravity")
        elif load_type in [LoadType.FORCE_NODALE, LoadType.FORCE_ARETE, LoadType.FORCE_FACE]:
            hints.append("At least one force component required")
            if load_type == LoadType.FORCE_NODALE:
                hints.append("Moments only available for nodal forces")
        
        return hints

# Singleton instance
code_aster_intelligence = CodeAsterIntelligence()
