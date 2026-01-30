/* ===============================
   INTERFACES
================================ */

export interface AsterAffeEntry {
  group: string
  phenomenon?: any
  modelisation?: any
  formulation?: any
}

export interface ModelAsterCommands {
  affe: AsterAffeEntry[]
}

/* ===============================
   BUILDER
================================ */

export function buildModelAsterCommand(
  model: ModelAsterCommands
): string {

  if (!model.affe || model.affe.length === 0) {
    return `# Nenhum grupo configurado`
  }

  const affeBlocks = model.affe
    .map(entry => {
      return `
    _F(
      GROUP_MA='${entry.group}',
      ${entry.phenomenon ? `PHENOMENE='${entry.phenomenon}',` : ``}
      ${entry.modelisation ? `MODELISATION='${entry.modelisation}',` : ``}
      ${entry.formulation ? `FORMULATION='${entry.formulation}',` : ``}
    ),`
    })
    .join("\n")

  return `
MODELE = AFFE_MODELE(
  MAILLAGE=MAIL,
  AFFE=(
${affeBlocks}
  ),
);
`.trim()
}
