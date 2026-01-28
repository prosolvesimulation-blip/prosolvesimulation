"""
API Routes for Code_Aster Intelligence Integration
Provides endpoints for LoadConfig frontend integration
"""

from flask import Blueprint, jsonify, request
from services.code_aster_intelligence import code_aster_intelligence, LoadType
import logging

logger = logging.getLogger(__name__)
code_aster_bp = Blueprint('code_aster', __name__, url_prefix='/api/code-aster')

@code_aster_bp.route('/load-types', methods=['GET'])
def get_load_types():
    """Get all available load types with metadata"""
    try:
        load_types = []
        for load_type in LoadType:
            metadata = code_aster_intelligence.get_frontend_metadata(load_type)
            load_types.append(metadata)
        
        return jsonify({
            "status": "success",
            "load_types": load_types
        })
    except Exception as e:
        logger.error(f"Error getting load types: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@code_aster_bp.route('/validate-parameters', methods=['POST'])
def validate_parameters():
    """Validate load parameters against Code_Aster rules"""
    try:
        data = request.get_json()
        
        if not data or 'load_type' not in data or 'parameters' not in data:
            return jsonify({
                "status": "error",
                "message": "Missing required fields: load_type, parameters"
            }), 400
        
        load_type_str = data['load_type']
        try:
            load_type = LoadType(load_type_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "message": f"Invalid load type: {load_type_str}"
            }), 400
        
        parameters = data['parameters']
        is_valid, errors = code_aster_intelligence.validate_load_parameters(load_type, parameters)
        
        return jsonify({
            "status": "success",
            "is_valid": is_valid,
            "errors": errors,
            "warnings": code_aster_intelligence.warnings
        })
        
    except Exception as e:
        logger.error(f"Error validating parameters: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@code_aster_bp.route('/generate-command', methods=['POST'])
def generate_command():
    """Generate complete AFFE_CHAR_MECA command syntax"""
    try:
        data = request.get_json()
        
        if not data or 'load_type' not in data or 'parameters' not in data:
            return jsonify({
                "status": "error",
                "message": "Missing required fields: load_type, parameters"
            }), 400
        
        load_type_str = data['load_type']
        try:
            load_type = LoadType(load_type_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "message": f"Invalid load type: {load_type_str}"
            }), 400
        
        parameters = data['parameters']
        target_group = data.get('target_group', '')
        result_name = data.get('result_name', 'load_1')
        
        command_result = code_aster_intelligence.generate_command_syntax(
            load_type, parameters, target_group, result_name
        )
        
        return jsonify(command_result)
        
    except Exception as e:
        logger.error(f"Error generating command: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@code_aster_bp.route('/load-metadata/<load_type_str>', methods=['GET'])
def get_load_metadata(load_type_str):
    """Get detailed metadata for specific load type"""
    try:
        try:
            load_type = LoadType(load_type_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "message": f"Invalid load type: {load_type_str}"
            }), 404
        
        metadata = code_aster_intelligence.get_frontend_metadata(load_type)
        
        return jsonify({
            "status": "success",
            "metadata": metadata
        })
        
    except Exception as e:
        logger.error(f"Error getting load metadata: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@code_aster_bp.route('/syntax-help', methods=['GET'])
def get_syntax_help():
    """Get Code_Aster syntax help and examples"""
    try:
        help_data = {
            "affe_char_meca": {
                "description": "Assign loads and boundary conditions to mechanical model",
                "syntax": "char_meca = AFFE_CHAR_MECA(MODELE=mo, ...)",
                "common_parameters": {
                    "MODELE": "Mechanical model (required)",
                    "DOUBLE_LAGRANGE": "Double Lagrange method ('OUI'/'NON')",
                    "INFO": "Information level (1/2)",
                    "VERI_NORM": "Normal verification ('OUI'/'NON')",
                    "VERI_AFFE": "Assignment verification ('OUI'/'NO')"
                },
                "load_types": {
                    "FORCE_NODALE": "Point loads on nodes",
                    "FORCE_ARETE": "Linear loads on edges",
                    "FORCE_FACE": "Surface traction on faces",
                    "PRES_REP": "Normal pressure",
                    "PESANTEUR": "Gravity field"
                }
            }
        }
        
        return jsonify({
            "status": "success",
            "help": help_data
        })
        
    except Exception as e:
        logger.error(f"Error getting syntax help: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
