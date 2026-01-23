
import os
import meshio
import numpy as np

def read_mesh_file(file_path):
    """
    Reads a MED file and returns nodes and elements organized by group.
    
    Returns:
    {
        "status": "success",
        "nodes": [[x, y, z], ...],
        "groups": {
            "Group_Name": {
                "type": "line", # or 'triangle', 'quad'
                "elements": [[n1, n2], ...] # Indices into nodes array
            }
        }
    }
    """
    try:
        if not os.path.exists(file_path):
            return {"status": "error", "message": "File not found"}

        mesh = meshio.read(file_path)
        
        # Nodes coordinates
        nodes = mesh.points.tolist()
        
        groups_data = {}

        # meshio organizes data by cell blocks.
        # We need to map groups to cells.
        # In MED files via meshio, groups are often in cell_data_dict['med:group_name'] or similar tags.
        # However, meshio behavior for MED varies. Let's try a robust approach.
        
        # 1. Inspect Cell Data for Groups
        # Usually cell_data contains "med:group" or similar keys mapping to group names?
        # A common way meshio loads MED groups is putting them in mesh.cell_sets (dict of name -> list of cell arrays)
        # OR mesh.cell_data dictionary.
        
        # Let's try to extract logic based on typical meshio 5.x behavior
        
        # Structure to fill:
        # groups_data = { "GroupA": { "lines": [], "triangles": [] } }
        
        for cell_block in mesh.cells:
            cell_type = cell_block.type
            data = cell_block.data.tolist()
            
            # If no groups defined, we might just dump everything as "Default" (but user needs groups)
            # Let's check subsets/groups
            pass

        # Better approach for Code_Aster MED files specifically:
        # Usually meshio puts groups in mesh.cell_sets
        # mesh.cell_sets[group_name] = [ array_of_indices_for_block_0, array_of_indices_for_block_1, ... ]
        
        if hasattr(mesh, 'cell_sets') and mesh.cell_sets:
            for group_name, cell_indices_list in mesh.cell_sets.items():
                if group_name not in groups_data:
                    groups_data[group_name] = {"elements": [], "type": "unknown"}
                
                # Iterate through blocks (mesh.cells) and corresponding indices
                all_elements = []
                primary_type = "unknown"
                
                for i, indices in enumerate(cell_indices_list):
                    if len(indices) == 0: continue
                    
                    cell_block = mesh.cells[i]
                    c_type = cell_block.type
                    c_data = cell_block.data
                    
                    # Store type (simplification: last seen type wins, or prefer lines for beams)
                    if c_type == "line":
                        primary_type = "line"
                    elif c_type in ["triangle", "quad"] and primary_type != "line":
                        primary_type = "surface"
                    
                    # Extract elements belonging to this group
                    # indices is a list/array of indices *valid for this block* (?) 
                    # Actually mesh.cell_sets usually maps to the global index or block index?
                    # In meshio < 5 it was dict of group -> list of arrays (one per cell block).
                    # In meshio >= 5 it is... let's assume it matches the `mesh.cells` list order.
                    
                    # Filter elements
                    # meshio 5.x: cell_sets[name] is a list of numpy arrays. 
                    # The i-th array corresponds to the i-th block in mesh.cells.
                    # The values in the array are boolean (mask) or indices?
                    # Usually it's boolean mask if using latest standards, OR list of indices.
                    # Let's assume generic logic:
                    
                    subset = c_data[indices] # If indices are integer indices
                    # If indices is boolean:
                    # subset = c_data[indices]
                    
                    # We simply convert to list and extend
                    if len(subset) > 0:
                        all_elements.extend(subset.tolist())
                
                if len(all_elements) > 0:
                    groups_data[group_name] = {
                        "type": primary_type,
                        "elements": all_elements
                    }
        else:
            # No groups found, valid fallback?
            # Return everything as "All"
            all_lines = []
            for cell_block in mesh.cells:
                if cell_block.type == "line":
                   all_lines.extend(cell_block.data.tolist())
            
            if all_lines:
                groups_data["All_Lines"] = { "type": "line", "elements": all_lines }

        return {
            "status": "success",
            "nodes": nodes,
            "groups": groups_data
        }

    except Exception as e:
        print(f"Mesh Read Error: {e}")
        return {"status": "error", "message": str(e)}
