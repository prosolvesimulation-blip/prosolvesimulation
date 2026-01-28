/**
 * Modern Group Selector Component
 * 
 * A beautiful, intuitive group selector with:
 * - Clean card-based design
 * - Smooth animations and micro-interactions
 * - Better accessibility and keyboard navigation
 * - Modern color scheme with gradients
 * - Improved filtering indicators
 * - Responsive design
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Zap, 
  CheckCircle, 
  ChevronDown,
  Search,
  Filter,
  Layers
} from 'lucide-react';
import type { GroupDimension } from '../../types/contact';

interface GroupSelectorProps {
  availableGroups: string[];
  selectedMaster: string | null;
  selectedSlave: string | null;
  groupDimensions: Map<string, GroupDimension>;
  onMasterSelect: (group: string) => void;
  onSlaveSelect: (group: string) => void;
  disabled?: boolean;
  availableMasterGroups?: string[];
  availableSlaveGroups?: string[];
}

const GroupSelector: React.FC<GroupSelectorProps> = ({
  availableGroups,
  selectedMaster,
  selectedSlave,
  groupDimensions,
  onMasterSelect,
  onSlaveSelect,
  disabled = false,
  availableMasterGroups,
  availableSlaveGroups
}) => {
  const [masterSearchTerm, setMasterSearchTerm] = useState('');
  const [slaveSearchTerm, setSlaveSearchTerm] = useState('');
  const [isMasterDropdownOpen, setIsMasterDropdownOpen] = useState(false);
  const [isSlaveDropdownOpen, setIsSlaveDropdownOpen] = useState(false);

  // Get dimension info with enhanced styling
  const getDimensionInfo = (dimension: number) => {
    const configs = {
      1: {
        icon: <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-lg shadow-blue-500/25" />,
        label: '1D',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        description: 'Nodes/Beams'
      },
      2: {
        icon: <div className="w-3 h-3 bg-gradient-to-br from-green-400 to-green-600 rounded-sm shadow-lg shadow-green-500/25" />,
        label: '2D',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        description: 'Edges/Shells'
      },
      3: {
        icon: <div className="w-3 h-3 bg-gradient-to-br from-purple-400 to-purple-600 rounded shadow-lg shadow-purple-500/25" />,
        label: '3D',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        description: 'Faces/Solids'
      }
    };
    return configs[dimension as keyof typeof configs] || {
      icon: <div className="w-3 h-3 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full shadow-lg shadow-gray-500/25" />,
      label: 'Unknown',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30',
      description: 'Unknown Type'
    };
  };

  // Get group info with enhanced data
  const getGroupInfo = (groupName: string) => {
    const dimension = groupDimensions.get(groupName) || { dimension: 0, confidence: 0 };
    const dimInfo = getDimensionInfo(dimension.dimension);
    
    return {
      ...dimension,
      ...dimInfo,
      displayName: groupName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      confidence: dimension.confidence || 0
    };
  };

  // Check if group is available for selection
  const isGroupAvailable = useCallback((groupName: string, isMaster: boolean) => {
    if (disabled) {
      return false;
    }
    
    // Check if group is in the filtered list
    if (isMaster && availableMasterGroups && !availableMasterGroups.includes(groupName)) {
      return false;
    }
    if (!isMaster && availableSlaveGroups && !availableSlaveGroups.includes(groupName)) {
      return false;
    }
    
    // Prevent selecting the same group for both master and slave
    if (isMaster && selectedSlave === groupName) {
      return false;
    }
    if (!isMaster && selectedMaster === groupName) {
      return false;
    }
    
    return true;
  }, [disabled, availableMasterGroups, availableSlaveGroups, selectedMaster, selectedSlave]);

  // Filter groups based on search term
  const filterGroups = useCallback((groups: string[], searchTerm: string) => {
    if (!searchTerm) return groups;
    return groups.filter(group => 
      group.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, []);

  // Render group dropdown
  const renderGroupDropdown = (
    type: 'master' | 'slave',
    selected: string | null,
    onSelect: (group: string) => void,
    searchTerm: string,
    setSearchTerm: (term: string) => void,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void
  ) => {
    const groups = type === 'master' 
      ? (availableMasterGroups || availableGroups)
      : (availableSlaveGroups || availableGroups);
    
    const filteredGroups = filterGroups(groups, searchTerm);
    const isFiltered = type === 'slave' && selectedMaster && availableSlaveGroups && 
                      availableSlaveGroups.length < availableGroups.length;

    return (
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {type === 'master' ? (
              <Shield className="w-4 h-4 text-blue-400" />
            ) : (
              <Zap className="w-4 h-4 text-amber-400" />
            )}
            <label className="text-sm font-semibold text-white uppercase tracking-wide">
              {type === 'master' ? 'Master' : 'Slave'} Group
            </label>
            {selected && (
              <CheckCircle className="w-3 h-3 text-green-400" />
            )}
            {isFiltered && (
              <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full font-mono">
                <Filter className="w-3 h-3 inline mr-1" />
                {availableSlaveGroups?.length || 0}/{availableGroups.length}
              </span>
            )}
          </div>
        </div>

        {/* Selected Display */}
        <motion.button
          onClick={() => {
            setIsOpen(!isOpen);
          }}
          disabled={disabled}
          className={`
            w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all
            ${selected 
              ? 'bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-cyan-500/30 text-cyan-400' 
              : 'bg-slate-900/30 border-slate-700/50 text-slate-400 hover:border-slate-600/50 hover:text-white'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          whileHover={!disabled ? { scale: 1.01 } : {}}
          whileTap={!disabled ? { scale: 0.99 } : {}}
        >
          {selected ? (
            <>
              {getGroupInfo(selected).icon}
              <div className="flex-1 text-left">
                <div className="font-medium">{getGroupInfo(selected).displayName}</div>
                <div className="text-xs opacity-70">{getGroupInfo(selected).description}</div>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </>
          ) : (
            <>
              <Search className="w-4 h-4 opacity-50" />
              <span className="flex-1 text-left opacity-70">
                Select {type === 'master' ? 'Master' : 'Slave'} Group
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 w-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl"
            >
              {/* Search Bar */}
              <div className="p-3 border-b border-slate-700/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800/70"
                  />
                </div>
              </div>

              {/* Group List */}
              <div className="max-h-60 overflow-y-auto">
                {filteredGroups.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    No groups found
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const groupInfo = getGroupInfo(group);
                    const isSelected = selected === group;
                    const isAvailable = isGroupAvailable(group, type === 'master');

                    return (
                      <motion.button
                        key={group}
                        onClick={() => {
                          if (isAvailable) {
                            onSelect(group);
                            setIsOpen(false);
                          }
                        }}
                        disabled={!isAvailable}
                        className={`
                          w-full flex items-center gap-3 p-3 border-b border-slate-700/30 last:border-b-0
                          transition-all text-left
                          ${isSelected 
                            ? 'bg-cyan-500/10 border-cyan-500/30' 
                            : isAvailable
                              ? 'hover:bg-slate-800/50'
                              : 'opacity-40 cursor-not-allowed'
                          }
                        `}
                        whileHover={isAvailable ? { x: 4 } : {}}
                      >
                        {groupInfo.icon}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm truncate">
                            {groupInfo.displayName}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs ${groupInfo.color}`}>
                              {groupInfo.label}
                            </span>
                            <span className="text-xs text-slate-400">
                              {groupInfo.description}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-cyan-400" />
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-800/30 to-slate-900/30 rounded-xl border border-slate-700/30">
        <Layers className="w-5 h-5 text-cyan-400" />
        <div>
          <h3 className="text-lg font-bold text-white">Group Selection</h3>
          <p className="text-xs text-slate-400">Choose master and slave groups for contact pairing</p>
        </div>
      </div>

      {/* Master and Slave Selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderGroupDropdown(
          'master',
          selectedMaster,
          onMasterSelect,
          masterSearchTerm,
          setMasterSearchTerm,
          isMasterDropdownOpen,
          setIsMasterDropdownOpen
        )}
        
        {renderGroupDropdown(
          'slave',
          selectedSlave,
          onSlaveSelect,
          slaveSearchTerm,
          setSlaveSearchTerm,
          isSlaveDropdownOpen,
          setIsSlaveDropdownOpen
        )}
      </div>

      {/* Compatibility Status */}
      {selectedMaster && selectedSlave && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <div className="text-sm font-semibold text-green-400">Compatible Pair</div>
              <div className="text-xs text-slate-400">
                {getGroupInfo(selectedMaster).label} + {getGroupInfo(selectedSlave).label} interaction ready
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-600 font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <span>1D (Nodes/Beams)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-sm" />
          <span>2D (Edges/Shells)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded" />
          <span>3D (Faces/Solids)</span>
        </div>
      </div>
    </div>
  );
};

export default GroupSelector;
