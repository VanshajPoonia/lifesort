export const motionDurations = {
  quick: "150ms",
  base: "220ms",
  slow: "350ms",
  journal: "650ms",
} as const

export const motionEasing = {
  standard: "ease-out",
  soft: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const

export const reducedMotionSafe = "motion-reduce:animate-none motion-reduce:transform-none motion-reduce:transition-none"

export const motionPresets = {
  fadeIn: `animate-in fade-in-0 duration-200 ease-out ${reducedMotionSafe}`,
  fadeInUp: `animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out ${reducedMotionSafe}`,
  staggerContainer: "motion-stagger",
  scaleIn: `animate-in fade-in-0 zoom-in-95 duration-200 ease-out ${reducedMotionSafe}`,
  tabContent: `tab-enter ${reducedMotionSafe}`,
  modalPanel: `duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ${reducedMotionSafe}`,
  listItem: `list-item-enter ${reducedMotionSafe}`,
  journalEntrance: `journal-enter ${reducedMotionSafe}`,
  pressable: `transition-transform duration-150 ease-out active:scale-[0.98] ${reducedMotionSafe}`,
} as const
