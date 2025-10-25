/**
 * Icon Generator for Material Icons using SVG data
 *
 * NOTE: This file appears to be legacy code and is not currently used.
 * The svg-fetcher module it depends on no longer exists.
 * Consider removing this file or updating to use current modules.
 */

// Local type definition for legacy IconVariant
interface IconVariant {
  name: string;
  style: 'rounded' | 'sharp' | 'outlined';
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  fill: 0 | 1;
  grade: -25 | 0 | 200;
  opticalSize: 20 | 24 | 40 | 48;
}

// Stub class to satisfy legacy references
class MaterialIconSVGFetcher {
  async fetchSVG(_variant: IconVariant): Promise<string> {
    throw new Error('Legacy MaterialIconSVGFetcher - not implemented');
  }
  extractPathData(_svg: string): string {
    throw new Error('Legacy MaterialIconSVGFetcher - not implemented');
  }
}

export interface IconConfig {
  name: string;
  style: 'rounded' | 'sharp' | 'outlined';
  weights: number[]; // e.g., [300, 400]
  fills: (0 | 1)[]; // e.g., [0, 1] for both off and on
  grades: number[]; // e.g., [-25, 0, 200]
  opticalSizes: number[]; // e.g., [20, 24, 40, 48]
}

export interface GeneratorConfig {
  icons: IconConfig[];
  defaultVariant?: {
    weight: number;
    fill: 0 | 1;
    grade: number;
    opticalSize: number;
  };
}

export class MaterialIconGenerator {
  private fetcher = new MaterialIconSVGFetcher();

  // Map numeric values to display strings
  private readonly weightMap: Record<number, string> = {
    100: '100',
    200: '200',
    300: '300',
    400: '400',
    500: '500',
    600: '600',
    700: '700',
  };

  private readonly gradeMap: Record<number, string> = {
    [-25]: 'Dark theme',
    [0]: 'Normal',
    [200]: 'High emphasis',
  };

  private readonly fillMap: Record<number, string> = {
    0: 'Off',
    1: 'On',
  };

  /**
   * Generate a complete icon component set with all variants
   */
  async generateIconSet(config: IconConfig): Promise<ComponentSetNode> {
    const variants: ComponentNode[] = [];

    // Fixed component set size as per user requirement
    const componentSetSize = 56;

    // Generate all variants first
    for (const opticalSize of config.opticalSizes) {
      for (const fill of config.fills) {
        for (const weight of config.weights) {
          for (const grade of config.grades) {
            const variant = await this.createVariant({
              name: config.name,
              style: config.style,
              weight: weight as 100 | 200 | 300 | 400 | 500 | 600 | 700,
              fill,
              grade: grade as -25 | 0 | 200,
              opticalSize: opticalSize as 20 | 24 | 40 | 48,
            });

            if (variant) {
              variants.push(variant);
            }
          }
        }
      }
    }

    // Sort variants to ensure default is first
    // Default: Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp
    variants.sort((a, b) => {
      // Check if either is the default
      const aIsDefault =
        a.name.includes('Weight=400') &&
        a.name.includes('Fill=Off') &&
        a.name.includes('Grade=Normal') &&
        a.name.includes('24dp');
      const bIsDefault =
        b.name.includes('Weight=400') &&
        b.name.includes('Fill=Off') &&
        b.name.includes('Grade=Normal') &&
        b.name.includes('24dp');

      if (aIsDefault) return -1;
      if (bIsDefault) return 1;

      // Sort rest by: optical size, fill, weight, grade
      const getOpticalSize = (name: string) => {
        const match = name.match(/(\d+)dp/);
        return match ? parseInt(match[1]) : 0;
      };
      const getFill = (name: string) => (name.includes('Fill=On') ? 1 : 0);
      const getWeight = (name: string) => {
        const match = name.match(/Weight=(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };
      const getGrade = (name: string) => {
        if (name.includes('Grade=Dark')) return -25;
        if (name.includes('Grade=High')) return 200;
        return 0;
      };

      const aSizeOrder = getOpticalSize(a.name);
      const bSizeOrder = getOpticalSize(b.name);
      if (aSizeOrder !== bSizeOrder) return aSizeOrder - bSizeOrder;

      const aFill = getFill(a.name);
      const bFill = getFill(b.name);
      if (aFill !== bFill) return aFill - bFill;

      const aWeight = getWeight(a.name);
      const bWeight = getWeight(b.name);
      if (aWeight !== bWeight) return aWeight - bWeight;

      const aGrade = getGrade(a.name);
      const bGrade = getGrade(b.name);
      return aGrade - bGrade;
    });

    // Combine as component set
    const componentSet = figma.combineAsVariants(variants, figma.currentPage);
    componentSet.name = config.name;

    // Set component set to exact size
    componentSet.resize(componentSetSize, componentSetSize);

    // Set white background
    componentSet.fills = [
      {
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1 },
        opacity: 1,
      },
    ];

    // Add light gray border stroke
    componentSet.strokes = [
      {
        type: 'SOLID',
        color: { r: 0.8, g: 0.8, b: 0.8 },
        opacity: 1,
      },
    ];
    componentSet.strokeWeight = 1;
    componentSet.strokeAlign = 'INSIDE';

    // Enable clipping
    componentSet.clipsContent = true;

    // Set up auto layout - horizontal wrapping
    componentSet.layoutMode = 'HORIZONTAL';
    componentSet.primaryAxisSizingMode = 'FIXED';
    componentSet.counterAxisSizingMode = 'AUTO';
    componentSet.layoutWrap = 'WRAP';
    componentSet.itemSpacing = 0;
    componentSet.paddingLeft = 0;
    componentSet.paddingRight = 0;
    componentSet.paddingTop = 0;
    componentSet.paddingBottom = 0;

    return componentSet;
  }

  /**
   * Create a single icon variant
   */
  private async createVariant(variant: IconVariant): Promise<ComponentNode | null> {
    try {
      // Fetch SVG from GitHub
      const svgContent = await this.fetcher.fetchSVG(variant);
      const pathData = this.fetcher.extractPathData(svgContent);

      // Create component
      const component = figma.createComponent();

      // Set component name with variant properties
      const variantName = [
        `Style=${this.capitalizeFirst(variant.style)}`,
        `Weight=${this.weightMap[variant.weight]}`,
        `Fill=${this.fillMap[variant.fill]}`,
        `Grade=${this.gradeMap[variant.grade]}`,
        `Optical size=${variant.opticalSize}dp`,
      ].join(', ');

      component.name = variantName;

      // Set component size to match optical size exactly
      component.resize(variant.opticalSize, variant.opticalSize);

      // Remove any fills from the component frame itself
      component.fills = [];

      // Create vector from SVG path
      const vector = figma.createVector();
      vector.vectorPaths = [
        {
          windingRule: 'NONZERO',
          data: pathData,
        },
      ];

      // Set vector name
      vector.name = 'Vector';

      // Set vector constraints to SCALE
      vector.constraints = {
        horizontal: 'SCALE',
        vertical: 'SCALE',
      };

      // Add vector to component
      component.appendChild(vector);

      // Size the vector to fill the entire component (icons are designed to fill their optical size)
      vector.resize(variant.opticalSize, variant.opticalSize);
      vector.x = 0;
      vector.y = 0;

      // Set vector fill only (no stroke)
      vector.fills = [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0 },
          opacity: 1,
        },
      ];

      // Remove any strokes
      vector.strokes = [];

      // Store metadata as plugin data
      component.setPluginData('iconVariant', JSON.stringify(variant));

      return component;
    } catch (error) {
      console.error(`Failed to create variant for ${variant.name}:`, error);
      return null;
    }
  }

  /**
   * No need to arrange - Figma handles variant arrangement automatically
   */

  /**
   * Batch generate multiple icon sets
   */
  async generateBatch(
    configs: IconConfig[],
    onProgress?: (current: number, total: number, iconName: string) => void
  ): Promise<ComponentSetNode[]> {
    const results: ComponentSetNode[] = [];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];

      if (onProgress) {
        onProgress(i, configs.length, config.name);
      }

      try {
        const componentSet = await this.generateIconSet(config);
        results.push(componentSet);
      } catch (error) {
        console.error(`Failed to generate ${config.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Organize icons by category on different pages
   */
  async organizeByCategory(
    icons: Record<string, IconConfig[]>,
    style: 'rounded' | 'sharp' | 'outlined'
  ) {
    for (const [category, iconConfigs] of Object.entries(icons)) {
      // Create or find page for this category
      let page = figma.root.children.find(
        (p) => p.name === `${this.capitalizeFirst(style)} - ${category}`
      ) as PageNode;

      if (!page) {
        page = figma.createPage();
        page.name = `${this.capitalizeFirst(style)} - ${category}`;
      }

      // Switch to the page
      figma.currentPage = page;

      // Generate icons on this page
      const componentSets = await this.generateBatch(iconConfigs, (current, total, name) => {
        console.log(`Generating ${name} (${current + 1}/${total}) in ${category}`);
      });

      // Arrange component sets in a grid on the page
      this.arrangeComponentSetsOnPage(componentSets);
    }
  }

  /**
   * Arrange component sets in a grid on the page
   */
  private arrangeComponentSetsOnPage(componentSets: ComponentSetNode[]) {
    const SPACING = 100;
    const COLUMNS = 15; // Adjust based on typical page width

    componentSets.forEach((set, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);

      set.x = col * (set.width + SPACING);
      set.y = row * (set.height + SPACING);
    });
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
