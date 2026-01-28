/**
 * Intelligent Contact Card Component
 * 
 * Displays a single intelligent contact with all its components:
 * - Group selection
 * - Contact method selection  
 * - Parameter configuration
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import GroupSelector from './GroupSelector';
import ContactMethodSelector from './ContactMethodSelector';
import ParameterForm from './ParameterForm';
import { useContactSystem } from '../../hooks/useContactSystem';

interface IntelligentContact {
    id: string;
    name: string;
    masterGroup: string | null;
    slaveGroup: string | null;
    contactMethod: any | null;
    parameters: Record<string, any>;
    isValid: boolean;
}

interface IntelligentContactCardProps {
  contact: IntelligentContact;
  availableGroups: string[];
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
}

const IntelligentContactCard: React.FC<IntelligentContactCardProps> = ({
  contact,
  availableGroups,
  onUpdate,
  onRemove
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Initialize contact system with current selections
  const contactSystem = useContactSystem(availableGroups, contact.masterGroup, contact.slaveGroup);

  const handleMasterGroupSelect = useCallback((group: string) => {
    console.log('🔍 [PARENT] handleMasterGroupSelect called:', { 
      group, 
      contactId: contact.id,
      timestamp: new Date().toISOString()
    });
    onUpdate('masterGroup', group);
    // Reset dependent selections
    onUpdate('slaveGroup', null);
    onUpdate('contactMethod', null);
    onUpdate('parameters', {});
  }, [contact.id, onUpdate]);

  const handleSlaveGroupSelect = useCallback((group: string) => {
    console.log('🔍 [PARENT] handleSlaveGroupSelect called:', { 
      group, 
      contactId: contact.id,
      timestamp: new Date().toISOString()
    });
    onUpdate('slaveGroup', group);
    // Reset dependent selections
    onUpdate('contactMethod', null);
    onUpdate('parameters', {});
  }, [contact.id, onUpdate]);

  const handleContactMethodSelect = (contactMethod: any) => {
    onUpdate('contactMethod', contactMethod);
    // Reset parameters when method changes
    onUpdate('parameters', {});
  };

  const handleParameterChange = (name: string, value: any) => {
    onUpdate('parameters', {
      ...contact.parameters,
      [name]: value
    });
  };

  const isComplete = contact.masterGroup && contact.slaveGroup && contact.contactMethod;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm group hover:border-slate-700 transition-all"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <Settings size={16} className="text-cyan-400" />
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={contact.name}
                onChange={(e) => onUpdate('name', e.target.value)}
                className="bg-transparent text-sm font-black text-white uppercase tracking-wide outline-none focus:text-cyan-400 transition-colors"
                placeholder="Contact Name"
              />
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[9px] font-mono text-slate-600">ID: {contact.id}</span>
                {isComplete && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-[9px] text-green-400 font-mono">Complete</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Expand/Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Remove Button */}
            <button
              onClick={onRemove}
              className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 space-y-6">
              {/* Group Selection */}
              <GroupSelector
                availableGroups={availableGroups}
                selectedMaster={contact.masterGroup}
                selectedSlave={contact.slaveGroup}
                groupDimensions={contactSystem.groupDimensions || new Map()}
                availableMasterGroups={contactSystem.availableMasterGroups}
                availableSlaveGroups={contactSystem.availableSlaveGroups}
                onMasterSelect={handleMasterGroupSelect}
                onSlaveSelect={handleSlaveGroupSelect}
                disabled={false}
              />

              {/* Contact Method Selection */}
              {contact.masterGroup && contact.slaveGroup && (
                <ContactMethodSelector
                  availableContacts={contactSystem.availableContacts}
                  selectedContact={contact.contactMethod}
                  onContactSelect={handleContactMethodSelect}
                  disabled={false}
                />
              )}

              {/* Parameter Form */}
              {contact.contactMethod && (
                <ParameterForm
                  parameterFields={contactSystem.parameterFields}
                  parameterValues={contact.parameters}
                  onParameterChange={handleParameterChange}
                  disabled={false}
                />
              )}

              {/* Status Summary */}
              <div className="pt-4 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Master:</span>
                    <span className={contact.masterGroup ? 'text-cyan-400' : 'text-slate-700'}>
                      {contact.masterGroup || 'Not selected'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Slave:</span>
                    <span className={contact.slaveGroup ? 'text-cyan-400' : 'text-slate-700'}>
                      {contact.slaveGroup || 'Not selected'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Method:</span>
                    <span className={contact.contactMethod ? 'text-cyan-400' : 'text-slate-700'}>
                      {contact.contactMethod?.label || 'Not selected'}
                    </span>
                  </div>
                </div>

                {Object.keys(contact.parameters).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <div className="text-[10px] text-slate-600 font-mono mb-2">Parameters:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(contact.parameters).map(([key, value]) => (
                        <div
                          key={key}
                          className="px-2 py-1 bg-slate-950 rounded text-[9px] font-mono border border-slate-800"
                        >
                          <span className="text-slate-600">{key}:</span>{' '}
                          <span className="text-cyan-400">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default IntelligentContactCard;
