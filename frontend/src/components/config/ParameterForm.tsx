/**
 * Parameter Form Component
 * 
 * Dynamically generates form fields based on contact method parameters.
 * Handles template variable substitution and validation.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ParameterField } from '../../types/contact';

interface ParameterFormProps {
  parameterFields: ParameterField[];
  parameterValues: Record<string, any>;
  onParameterChange: (name: string, value: any) => void;
  disabled?: boolean;
}

const ParameterForm: React.FC<ParameterFormProps> = ({
  parameterFields,
  parameterValues,
  onParameterChange,
  disabled = false
}) => {
  const renderFormField = (field: ParameterField) => {
    const value = parameterValues[field.name] ?? field.defaultValue ?? '';
    const hasError = field.required && (value === undefined || value === null || value === '');

    switch (field.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={field.name}
              checked={Boolean(value)}
              onChange={(e) => onParameterChange(field.name, e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 bg-slate-950 border-slate-700 rounded text-cyan-500 focus:ring-cyan-500 focus:ring-2"
            />
            <label htmlFor={field.name} className="text-xs text-slate-300">
              {field.placeholder || field.name.replace(/_/g, ' ')}
            </label>
          </div>
        );

      case 'number':
        return (
          <div className="relative">
            <input
              type="number"
              id={field.name}
              value={value}
              onChange={(e) => onParameterChange(field.name, parseFloat(e.target.value) || 0)}
              disabled={disabled}
              placeholder={field.placeholder}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.name.includes('friction') || field.name.includes('coefficient') ? 0.01 : 1}
              className={`
                w-full bg-slate-950 border rounded-lg p-2.5 text-xs text-white outline-none transition-all
                ${hasError 
                  ? 'border-rose-500 focus:border-rose-400' 
                  : 'border-slate-700 focus:border-cyan-500'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            />
            {field.validation && (
              <div className="absolute -bottom-4 right-0 text-[9px] text-slate-600 font-mono">
                {field.validation.min !== undefined && field.validation.max !== undefined
                  ? `[${field.validation.min} - ${field.validation.max}]`
                  : field.validation.min !== undefined
                    ? `≥ ${field.validation.min}`
                    : field.validation.max !== undefined
                      ? `≤ ${field.validation.max}`
                      : ''
                }
              </div>
            )}
          </div>
        );

      case 'select':
        // For select fields, we'll need to define options based on common patterns
        const getSelectOptions = () => {
          const options: string[] = [];
          
          if (field.name.includes('algo') || field.name.includes('algorithm')) {
            options.push('PENALISATION', 'CONTRAINTE', 'LAGRANGE');
          }
          
          if (field.name.includes('formulation') || field.name.includes('formul')) {
            options.push('CONTINUE', 'DISCRETE');
          }
          
          if (field.name.includes('frottement') || field.name.includes('friction')) {
            options.push('SANS', 'COULOMB');
          }
          
          if (field.name.includes('type') || field.name.includes('option')) {
            options.push('MASSIF', 'COQUE_MASSIF', '2D_POU', '3D_POU', '3D_TUYAU', 'COQ_POU');
          }
          
          // Default options if no patterns match
          if (options.length === 0) {
            options.push('OPTION_1', 'OPTION_2', 'OPTION_3');
          }
          
          return options;
        };

        return (
          <select
            id={field.name}
            value={value}
            onChange={(e) => onParameterChange(field.name, e.target.value)}
            disabled={disabled}
            className={`
              w-full bg-slate-950 border rounded-lg p-2.5 text-xs text-white outline-none transition-all
              ${hasError 
                ? 'border-rose-500 focus:border-rose-400' 
                : 'border-slate-700 focus:border-cyan-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <option value="">Select {field.placeholder || field.name.replace(/_/g, ' ')}</option>
            {getSelectOptions().map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      default: // string
        return (
          <input
            type="text"
            id={field.name}
            value={value}
            onChange={(e) => onParameterChange(field.name, e.target.value)}
            disabled={disabled}
            placeholder={field.placeholder}
            className={`
              w-full bg-slate-950 border rounded-lg p-2.5 text-xs text-white outline-none transition-all
              ${hasError 
                ? 'border-rose-500 focus:border-rose-400' 
                : 'border-slate-700 focus:border-cyan-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
        );
    }
  };

  const getValidationStatus = () => {
    const requiredFields = parameterFields.filter(field => field.required);
    const filledRequiredFields = requiredFields.filter(field => {
      const value = parameterValues[field.name] ?? field.defaultValue ?? '';
      return value !== undefined && value !== null && value !== '';
    });

    if (requiredFields.length === 0) {
      return { status: 'complete', message: 'No parameters required' };
    }

    if (filledRequiredFields.length === requiredFields.length) {
      return { status: 'complete', message: 'All required parameters set' };
    }

    const missingCount = requiredFields.length - filledRequiredFields.length;
    return {
      status: 'incomplete',
      message: `${missingCount} required parameter${missingCount !== 1 ? 's' : ''} missing`
    };
  };

  const validationStatus = getValidationStatus();

  if (parameterFields.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
            <Settings size={16} className="text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Parameters</h3>
            <p className="text-xs text-slate-400">Configure contact parameters</p>
          </div>
        </div>

        <div className="p-6 border border-slate-800 rounded-2xl text-center">
          <p className="text-xs text-slate-600 font-mono">
            No parameters required for this contact method
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
          <Settings size={16} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Parameters</h3>
          <p className="text-xs text-slate-400">
            {parameterFields.filter(f => f.required).length} required, {parameterFields.filter(f => !f.required).length} optional
          </p>
        </div>
        
        {/* Validation Status */}
        <div className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider
          ${validationStatus.status === 'complete' 
            ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
          }
        `}>
          {validationStatus.status === 'complete' ? (
            <CheckCircle size={12} />
          ) : (
            <AlertTriangle size={12} />
          )}
          {validationStatus.message}
        </div>
      </div>

      {/* Parameter Fields */}
      <div className="space-y-4">
        <AnimatePresence>
          {parameterFields.map((field, index) => {
            const value = parameterValues[field.name] ?? field.defaultValue ?? '';
            const hasError = field.required && (value === undefined || value === null || value === '');

            return (
              <motion.div
                key={field.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <label htmlFor={field.name} className="text-xs font-black text-slate-500 uppercase">
                    {field.name.replace(/_/g, ' ')}
                  </label>
                  
                  {field.required && (
                    <span className="text-[9px] text-rose-400 font-mono">REQUIRED</span>
                  )}
                  
                  <span className="text-[9px] text-slate-600 font-mono">
                    ({field.type})
                  </span>
                </div>

                {renderFormField(field)}

                {hasError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 text-[10px] text-rose-400"
                  >
                    <AlertTriangle size={10} />
                    This field is required
                  </motion.div>
                )}

                {/* Field Description */}
                {field.placeholder && field.type !== 'boolean' && (
                  <p className="text-[10px] text-slate-600 font-mono">
                    {field.placeholder}
                  </p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Parameter Summary */}
      {Object.keys(parameterValues).length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <div className="text-[10px] text-slate-600 font-mono mb-2">Current Values:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(parameterValues).map(([key, value]) => (
              <div
                key={key}
                className="px-2 py-1 bg-slate-950 rounded text-[9px] font-mono border border-slate-800"
              >
                <span className="text-slate-600">{key}:</span> <span className="text-cyan-400">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParameterForm;
