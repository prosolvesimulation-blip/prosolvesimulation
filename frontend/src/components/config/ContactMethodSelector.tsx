/**
 * Contact Method Selector Component
 * 
 * Displays filtered contact methods based on selected group dimensions.
 * Allows users to choose the appropriate contact interaction type.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Settings, Zap, Info } from 'lucide-react';
import type { ContactPair } from '../../types/contact';

interface ContactMethodSelectorProps {
  availableContacts: ContactPair[];
  selectedContact: ContactPair | null;
  onContactSelect: (contact: ContactPair) => void;
  disabled?: boolean;
}

const ContactMethodSelector: React.FC<ContactMethodSelectorProps> = ({
  availableContacts,
  selectedContact,
  onContactSelect,
  disabled = false
}) => {
  const getBehaviorIcon = (behavior: string) => {
    switch (behavior) {
      case 'Linear':
        return <Settings size={14} className="text-blue-400" />;
      case 'Non-Linear':
        return <Zap size={14} className="text-amber-400" />;
      default:
        return <Settings size={14} className="text-gray-400" />;
    }
  };

  const getBehaviorColor = (behavior: string) => {
    switch (behavior) {
      case 'Linear':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'Non-Linear':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getCommandColor = (command: string) => {
    switch (command) {
      case 'AFFE_CHAR_MECA':
        return 'text-green-400';
      case 'DEFI_CONTACT':
        return 'text-purple-400';
      default:
        return 'text-cyan-400';
    }
  };

  if (availableContacts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
            <Link2 size={16} className="text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Contact Method</h3>
            <p className="text-xs text-slate-400">Select interaction type</p>
          </div>
        </div>

        <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center">
          <Info size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
            No Contact Methods Available
          </p>
          <p className="text-[10px] text-slate-600 font-mono">
            Select compatible master and slave groups to see available contact methods
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
          <Link2 size={16} className="text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Contact Method</h3>
          <p className="text-xs text-slate-400">
            {availableContacts.length} available method{availableContacts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Contact Methods List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {availableContacts.map((contact, index) => {
            const isSelected = selectedContact?.label === contact.label;
            const behaviorColor = getBehaviorColor(contact.behavior);
            const commandColor = getCommandColor(contact.command);

            return (
              <motion.div
                key={`${contact.label}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <motion.button
                  whileHover={{ scale: disabled ? 1 : 1.02 }}
                  whileTap={{ scale: disabled ? 1 : 0.98 }}
                  onClick={() => !disabled && onContactSelect(contact)}
                  disabled={disabled}
                  className={`
                    w-full p-4 rounded-lg border transition-all text-left
                    ${isSelected 
                      ? 'bg-cyan-500/10 border-cyan-500/30' 
                      : disabled
                        ? 'bg-slate-900/50 border-slate-800/50 cursor-not-allowed'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon and Behavior */}
                    <div className="flex flex-col items-center gap-2 pt-1">
                      {getBehaviorIcon(contact.behavior)}
                      <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${behaviorColor}`}>
                        {contact.behavior}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-black text-white uppercase tracking-wide">
                          {contact.label}
                        </h4>
                        {isSelected && (
                          <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                        {contact.description}
                      </p>

                      {/* Technical Details */}
                      <div className="flex items-center gap-4 text-[10px] font-mono">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600">Command:</span>
                          <span className={commandColor}>{contact.command}</span>
                        </div>
                        
                        {contact.sub_command && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-600">Sub:</span>
                            <span className="text-cyan-400">{contact.sub_command}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <span className="text-slate-600">Params:</span>
                          <span className="text-slate-400">{Object.keys(contact.parameters).length}</span>
                        </div>
                      </div>

                      {/* Parameter Preview */}
                      {Object.keys(contact.parameters).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(contact.parameters).slice(0, 3).map(([key, value]) => (
                              <div
                                key={key}
                                className="px-2 py-1 bg-slate-950 rounded text-[9px] font-mono text-slate-500"
                              >
                                {key}: {value.includes('${') ? 'variable' : value}
                              </div>
                            ))}
                            {Object.keys(contact.parameters).length > 3 && (
                              <div className="px-2 py-1 bg-slate-950 rounded text-[9px] font-mono text-slate-600">
                                +{Object.keys(contact.parameters).length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center"
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </motion.div>
                    )}
                  </div>
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-600 font-mono pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <Settings size={10} className="text-blue-400" />
          <span>Linear</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={10} className="text-amber-400" />
          <span>Non-Linear</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full" />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
};

export default ContactMethodSelector;
