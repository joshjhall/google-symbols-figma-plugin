// Shared types between plugin code and UI

export enum PLUGIN_MESSAGES {
  // UI -> Plugin
  START_GENERATION = 'START_GENERATION',
  CHECK_EXISTING = 'CHECK_EXISTING',
  RUN_PERFORMANCE_TEST = 'RUN_PERFORMANCE_TEST',
  TEST_SINGLE_ICON = 'TEST_SINGLE_ICON',
  CANCEL = 'CANCEL',

  // Plugin -> UI
  INIT = 'INIT',
  PROGRESS_UPDATE = 'PROGRESS_UPDATE',
  GENERATION_COMPLETE = 'GENERATION_COMPLETE',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  EXISTING_COMPONENTS = 'EXISTING_COMPONENTS',
  PERFORMANCE_RESULTS = 'PERFORMANCE_RESULTS',
}

export interface GenerationConfig {
  style: 'rounded' | 'sharp' | 'outlined';
  weights: number[];
  pageStrategy: 'category' | 'alphabetical' | 'hybrid';
  iconsPerPage?: number;
  categories?: string[];
  specificIcons?: string[];
}

export interface IconVariantConfig {
  weight: number;
  grade: -25 | 0 | 200;
  opticalSize: 20 | 24 | 40 | 48;
  fill: 0 | 1;
}

export interface PluginMessage {
  type: PLUGIN_MESSAGES;
  config?: GenerationConfig;
  message?: string;
  progress?: number;
  components?: string[];
  count?: number;
  results?: PerformanceTestResult[];
  stats?: GenerationStats;
  // Category generation progress fields
  category?: string;
  categoryData?: {
    name: string;
    count: number;
    components: number;
    firstIcon: string;
    lastIcon: string;
  };
  testOneIcon?: boolean;
  currentIcon?: string;
  completedIcons?: number;
  currentIconProgress?: number;
  totalIcons?: number;
  // Page names for smart category selection
  pageNames?: string[];
}

export interface UIMessage {
  type: PLUGIN_MESSAGES;
  config?: GenerationConfig;
  [key: string]: unknown;
}

export interface PerformanceTestResult {
  iconCount: number;
  time: number;
  responsive: boolean;
}

export interface GenerationStats {
  iconsGenerated: number;
  pagesCreated: number;
  timeElapsed: number;
}

export interface MaterialIcon {
  name: string;
  category: string;
  tags: string[];
  codepoint: string;
}

export interface PagePlan {
  name: string;
  icons: MaterialIcon[];
  startIndex: number;
  endIndex: number;
}
