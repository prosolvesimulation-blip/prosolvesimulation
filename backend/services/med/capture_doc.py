import sys
import os

try:
    import MEDLoader as ml
except ImportError:
    print("MEDLoader not found")
    sys.exit(1)

# Write help and dir to a file to avoid truncation
with open("medloader_full_doc.txt", "w") as f:
    f.write("--- DIR MEDLOADER ---\n")
    f.write("\n".join(dir(ml)))
    f.write("\n\n--- DOC READFIELDNODE ---\n")
    f.write(str(ml.ReadFieldNode.__doc__))
    f.write("\n\n--- DOC READFIELDCELL ---\n")
    f.write(str(ml.ReadFieldCell.__doc__))
    f.write("\n\n--- DOC GETFIELDITERATIONS ---\n")
    f.write(str(ml.GetFieldIterations.__doc__))

print("Documentation written to medloader_full_doc.txt")
