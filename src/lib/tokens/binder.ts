/**
 * Styling utilities for Figma icon components
 *
 * This module provides hardcoded styling for icon components to keep them
 * portable and free from external variable dependencies.
 */

/**
 * Convert hex color to RGB values (0-1 range)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Apply hardcoded styling to a component set
 * Uses fixed values to keep components portable without variable dependencies
 */
export async function applyMUIVariables(componentSet: ComponentSetNode): Promise<void> {
  console.log('Applying hardcoded styling to component set...');

  // Corner radius: 12px
  componentSet.cornerRadius = 12;

  // Fill color: #FAF9FD (surface-bright)
  const fillColor = hexToRgb('#FAF9FD');
  componentSet.fills = [
    {
      type: 'SOLID',
      color: fillColor,
    },
  ];

  // Stroke color: #9747FF (primary accent)
  const strokeColor = hexToRgb('#9747FF');
  componentSet.strokes = [
    {
      type: 'SOLID',
      color: strokeColor,
    },
  ];

  console.log('Successfully applied hardcoded styling');
}
