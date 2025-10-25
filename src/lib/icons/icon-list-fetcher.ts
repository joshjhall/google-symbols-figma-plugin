/**
 * @module @figma/icons/icon-list-fetcher
 *
 * Legacy GitHub API-based icon list fetcher.
 *
 * **NOTE**: This module is legacy code and not currently used in production.
 * The plugin now uses a pre-validated icon list (all-icons-data.json) instead
 * of fetching from GitHub API at runtime.
 *
 * **Why Legacy**:
 * - GitHub API rate limiting (60/hour unauthenticated, 5000/hour with token)
 * - Slower startup (API calls on every plugin launch)
 * - Network dependency (fails offline)
 * - Pre-validated list is faster and more reliable
 *
 * **Original Purpose**:
 * - Fetch icon list from Material Symbols repository
 * - Support pagination for 3900+ icons
 * - Categorize icons by patterns
 * - Provide fallback for offline scenarios
 *
 * @deprecated Use `all-icons.ts` module with pre-validated list instead
 *
 * @example Current approach (preferred)
 * ```typescript
 * import { getAllIcons } from './all-icons';
 * const icons = getAllIcons(); // 3933 icons instantly
 * ```
 *
 * @example Legacy approach (not recommended)
 * ```typescript
 * const fetcher = new IconListFetcher({ token: 'ghp_...' });
 * const icons = await fetcher.getAvailableIcons(); // Slow, rate-limited
 * ```
 */

export interface GitHubAPIConfig {
  token?: string; // Optional GitHub token for higher rate limits
}

export class IconListFetcher {
  private baseApiUrl =
    'https://api.github.com/repos/google/material-design-icons/contents/symbols/web';
  private headers: HeadersInit;
  private rateLimitRemaining: number | null = null;
  private rateLimitReset: Date | null = null;

  constructor(config?: GitHubAPIConfig) {
    console.log('IconListFetcher constructor called with config:', config);

    this.headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Figma-Material-Icons-Plugin', // GitHub requires User-Agent
    };

    if (config?.token) {
      this.headers['Authorization'] = `Bearer ${config.token}`;
      console.log(
        `Using GitHub token for higher rate limits (5000/hour) - Token length: ${config.token.length}`
      );
    } else {
      console.log('No GitHub token provided. Using unauthenticated API (60/hour limit)');
    }
  }

  /**
   * Get list of all available icon names
   * This only needs to be called once, not for each variant
   */
  async getAvailableIcons(): Promise<string[]> {
    try {
      console.log('Fetching icon list from GitHub API...');

      // GitHub API pagination - fetch all pages
      const allIcons: string[] = [];
      let page = 1;
      const perPage = 100; // GitHub's max per page

      while (true) {
        const url = `${this.baseApiUrl}?per_page=${perPage}&page=${page}`;
        console.log(`Fetching page ${page} from GitHub API...`);

        const response = await fetch(url, { headers: this.headers });

        // Track rate limits (check if headers are accessible in Figma environment)
        try {
          if (response.headers && response.headers.get) {
            const remaining = response.headers.get('X-RateLimit-Remaining');
            const reset = response.headers.get('X-RateLimit-Reset');
            if (remaining) {
              this.rateLimitRemaining = parseInt(remaining);
              console.log(`GitHub API rate limit remaining: ${this.rateLimitRemaining}`);
            }
            if (reset) {
              this.rateLimitReset = new Date(parseInt(reset) * 1000);
              console.log(`Rate limit resets at: ${this.rateLimitReset.toLocaleTimeString()}`);
            }
          }
        } catch {
          // Headers may not be accessible in Figma environment
          console.log('Could not access response headers in Figma environment');
        }

        if (!response.ok) {
          if (response.status === 403) {
            console.error('GitHub API rate limit exceeded or forbidden. Using cached list.');
          } else {
            console.error(`GitHub API error: ${response.status}`);
          }
          return this.getCachedIconList();
        }

        const items = await response.json();
        console.log(`GitHub API page ${page} returned ${items.length} items`);

        // If we get fewer items than requested, we've reached the end
        if (items.length === 0) {
          console.log(`No more items on page ${page}, pagination complete`);
          break;
        }

        // Filter to only directories (each icon is a directory) and add to collection
        const pageIcons = items
          .filter((item: { type: string; name: string }) => item.type === 'dir')
          .map((item: { type: string; name: string }) => item.name);

        allIcons.push(...pageIcons);
        console.log(
          `Page ${page}: Found ${pageIcons.length} icons. Total so far: ${allIcons.length}`
        );

        // If we got fewer than perPage items, we've reached the end
        if (items.length < perPage) {
          console.log(`Got ${items.length} items (less than ${perPage}), pagination complete`);
          break;
        }

        page++;
      }

      // Sort all icons alphabetically
      allIcons.sort();

      console.log(`Found ${allIcons.length} total icons in GitHub repo`);
      console.log('Sample icons:', allIcons.slice(0, 10));
      console.log('Last 10 icons:', allIcons.slice(-10));

      // Cache the list for offline use
      this.cacheIconList(allIcons);

      return allIcons;
    } catch (error) {
      console.warn('Failed to fetch icon list from GitHub, using cached list:', error);
      return this.getCachedIconList();
    }
  }

  /**
   * Get categories by analyzing icon names
   */
  getCategoriesFromIcons(iconNames: string[]): Record<string, string[]> {
    const categories: Record<string, string[]> = {
      Navigation: [],
      Action: [],
      Communication: [],
      Content: [],
      Device: [],
      Editor: [],
      File: [],
      Hardware: [],
      Image: [],
      Maps: [],
      Notification: [],
      Social: [],
      Toggle: [],
    };

    // Common categorization patterns
    const patterns = {
      Navigation:
        /^(arrow|navigate|menu|more|expand|chevron|first|last|subdirectory|close|home|back|forward|keyboard_arrow|cancel|fullscreen|open|unfold|double|skip|replay|refresh|sync|switch|turn|pivot|swipe|drag|pan|zoom|north|south|east|west|up|down|left|right|apps)/i,
      Action:
        /^(account|add|remove|delete|favorite|search|settings|done|info|help|launch|list|shop|work)/i,
      Communication:
        /^(email|message|chat|call|contacts|dial|forum|import|mail|present|ring|screen|send|speaker|textsms|voicemail|vpn)/i,
      Content:
        /^(add|archive|backspace|block|clear|content|copy|cut|draft|filter|flag|font|forward|gesture|inbox|link|move|redo|remove|reply|report|save|select|send|sort|text|undo)/i,
      Device:
        /^(access|airplanemode|battery|bluetooth|brightness|data|developer|device|gps|graphic|network|nfc|screen|signal|storage|usb|wallpaper|wifi)/i,
      Editor:
        /^(attach|border|bubble|format|functions|highlight|insert|linear|merge|mode|money|publish|space|strikethrough|text|title|vertical|wrap)/i,
      File: /^(attachment|cloud|create|folder|upload|download)/i,
      Hardware:
        /^(cast|computer|desktop|dock|gamepad|headset|keyboard|laptop|memory|mouse|phone|phonelink|router|scanner|security|sim|smartphone|speaker|tablet|toys|tv|videogame|watch)/i,
      Image:
        /^(add|adjust|assistant|audiotrack|blur|brightness|brush|burst|camera|color|compare|control|crop|dehaze|details|edit|exposure|filter|flash|flip|gradient|grain|grid|hdr|healing|image|landscape|leak|lens|looks|movie|music|nature|navigate|palette|panorama|photo|picture|portrait|remove|rotate|slideshow|straighten|style|switch|tag|texture|timelapse|timer|tonality|transform|tune|view|vignette|wb)/i,
      Maps: /^(beenhere|directions|edit|layers|local|map|my|navigation|near|person|place|rate|restaurant|satellite|store|streetview|subway|terrain|traffic|train|tram|transfer|zoom)/i,
      Notification:
        /^(adb|airline|confirmation|disc|do|drive|enhanced|event|folder|live|mms|network|ondemand|personal|phone|power|priority|rv|sd|sim|sms|sync|system|tap|time|vibration|voice|vpn)/i,
      Social:
        /^(cake|domain|group|location|mood|notifications|pages|party|people|person|plus|poll|public|school|sentiment|share|sports|whatshot)/i,
      Toggle: /^(check|radio|star|toggle)/i,
    };

    // First, categorize icons that match patterns
    const otherIcons: string[] = [];

    for (const iconName of iconNames) {
      let categorized = false;

      for (const [category, pattern] of Object.entries(patterns)) {
        if (pattern.test(iconName)) {
          categories[category].push(iconName);
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        otherIcons.push(iconName);
      }
    }

    // Remove empty categories
    for (const category of Object.keys(categories)) {
      if (categories[category].length === 0) {
        delete categories[category];
      }
    }

    // Split "Other" icons alphabetically into ranges
    if (otherIcons.length > 0) {
      // Sort alphabetically
      otherIcons.sort();

      // Define target icons per "Other" page (soft limit to keep letters together)
      const targetPerPage = 250;

      if (otherIcons.length <= targetPerPage) {
        // If small enough, just use one "Other" category
        categories['Other'] = otherIcons;
      } else {
        // Split into alphabetical ranges keeping letters together
        const ranges = this.splitIntoAlphabeticalRanges(otherIcons, targetPerPage);

        for (const range of ranges) {
          // Format the label based on the range
          let rangeLabel: string;
          if (range.start === range.end) {
            // Single letter range
            rangeLabel = `Other [${range.start}]`;
          } else {
            // Multi-letter range
            rangeLabel = `Other [${range.start}-${range.end}]`;
          }
          categories[rangeLabel] = range.icons;
        }
      }
    }

    return categories;
  }

  /**
   * Split icons into alphabetical ranges, keeping letters together
   */
  private splitIntoAlphabeticalRanges(
    icons: string[],
    targetPerRange: number
  ): Array<{ start: string; end: string; icons: string[] }> {
    const ranges: Array<{ start: string; end: string; icons: string[] }> = [];

    // Group icons by first letter
    const letterGroups: Record<string, string[]> = {};
    for (const icon of icons) {
      const firstChar = icon[0].toUpperCase();
      if (!letterGroups[firstChar]) {
        letterGroups[firstChar] = [];
      }
      letterGroups[firstChar].push(icon);
    }

    // Build ranges keeping letters together
    let currentRange: string[] = [];
    let rangeStart = '';

    const sortedLetters = Object.keys(letterGroups).sort();

    for (const letter of sortedLetters) {
      const letterIcons = letterGroups[letter];

      if (currentRange.length === 0) {
        // Start new range
        rangeStart = letter;
        currentRange = [...letterIcons];
      } else if (currentRange.length + letterIcons.length <= targetPerRange * 1.5) {
        // Add to current range if it won't make it too large
        // Allow going up to 1.5x the target to keep letters together
        currentRange.push(...letterIcons);
      } else {
        // Finish current range and start new one
        const rangeEnd = currentRange[currentRange.length - 1][0].toUpperCase();
        ranges.push({
          start: rangeStart,
          end: rangeEnd,
          icons: currentRange,
        });

        // Start new range with current letter
        rangeStart = letter;
        currentRange = [...letterIcons];
      }
    }

    // Add final range
    if (currentRange.length > 0) {
      const rangeEnd = currentRange[currentRange.length - 1][0].toUpperCase();
      ranges.push({
        start: rangeStart,
        end: rangeEnd,
        icons: currentRange,
      });
    }

    // If any single letter has too many icons, it gets its own page
    // (e.g., if 'S' has 400 icons, it would be "Other [S]")
    const finalRanges: Array<{ start: string; end: string; icons: string[] }> = [];
    for (const range of ranges) {
      if (range.icons.length > targetPerRange * 2 && range.start === range.end) {
        // Single letter with many icons - might need to split
        // For now, keep it as one page but flag it
        console.log(`Warning: Letter ${range.start} has ${range.icons.length} icons`);
      }
      finalRanges.push(range);
    }

    return finalRanges;
  }

  /**
   * Cache icon list to localStorage or file
   */
  private cacheIconList(icons: string[]): void {
    // In a real implementation, this would save to localStorage or a file
    console.log(`Cached ${icons.length} icon names`);
  }

  /**
   * Get cached icon list (fallback for offline/rate-limited scenarios)
   */
  private getCachedIconList(): string[] {
    // Return a subset of commonly used icons as fallback
    // Including more navigation icons for better testing
    return [
      'home',
      'search',
      'menu',
      'close',
      'settings',
      'favorite',
      'star',
      'delete',
      'edit',
      'share',
      'download',
      'upload',
      'add',
      'remove',
      'check',
      'arrow_back',
      'arrow_forward',
      'arrow_upward',
      'arrow_downward',
      'arrow_back_ios',
      'arrow_forward_ios',
      'arrow_drop_down',
      'arrow_drop_up',
      'arrow_left',
      'arrow_right',
      'arrow_circle_down',
      'arrow_circle_up',
      'keyboard_arrow_down',
      'keyboard_arrow_up',
      'keyboard_arrow_left',
      'keyboard_arrow_right',
      'chevron_left',
      'chevron_right',
      'expand_less',
      'expand_more',
      'first_page',
      'last_page',
      'navigate_before',
      'navigate_next',
      'subdirectory_arrow_left',
      'subdirectory_arrow_right',
      'more_vert',
      'more_horiz',
      'apps',
      'fullscreen',
      'fullscreen_exit',
      'refresh',
      'sync',
      'cancel',
      'unfold_less',
      'unfold_more',
      'account_circle',
      'shopping_cart',
      'visibility',
      'visibility_off',
      'lock',
      'lock_open',
      'info',
      'warning',
      'error',
      'help',
      'notifications',
      'email',
      'phone',
      'calendar_today',
      'schedule',
      'language',
      'dashboard',
      'assessment',
      'trending_up',
      'work',
      'business',
      'school',
      'local_shipping',
      'flight',
      'hotel',
      'restaurant',
      'coffee',
      'local_bar',
      'directions',
      'map',
      'place',
      'my_location',
      'navigation',
      'explore',
      'bookmark',
      'bookmarks',
      'history',
      'done',
      'done_all',
      'clear',
      'reply',
      'forward',
      'send',
      'archive',
      'unarchive',
      'move_to_inbox',
      'drafts',
      'inbox',
      'mail',
      'markunread',
      'redo',
      'undo',
      'accessible',
      'accessibility',
      'account_balance',
      'alarm',
      'aspect_ratio',
      'backup',
      'book',
      'build',
      'cached',
      'camera_alt',
      'category',
      'chat',
      'cloud',
      'code',
      'computer',
      'credit_card',
      'description',
      'dns',
      'face',
      'fingerprint',
      'folder',
      'grade',
      'group',
      'highlight',
      'https',
      'image',
      'keyboard',
      'label',
      'layers',
      'lightbulb',
      'list',
      'mic',
      'music_note',
      'palette',
      'payment',
      'pets',
      'print',
      'receipt',
      'room',
      'save',
      'search',
      'security',
      'shopping_bag',
      'speaker',
      'support',
      'thumb_up',
      'thumb_down',
      'timeline',
      'touch_app',
      'translate',
      'verified',
      'view_list',
      'wifi',
      'zoom_in',
      'zoom_out',
    ];
  }
}

/**
 * Example usage combining API for discovery with raw URLs for content
 */
export class HybridIconFetcher {
  private listFetcher: IconListFetcher;

  constructor(githubToken?: string) {
    this.listFetcher = new IconListFetcher({ token: githubToken });
  }

  /**
   * Get available icons (uses API)
   */
  async getAvailableIcons(): Promise<string[]> {
    return this.listFetcher.getAvailableIcons();
  }

  /**
   * Get icon SVG content (uses raw URL)
   * @param iconName The name of the icon
   * @param _variant The icon variant (unused in basic implementation, but available for extension)
   */
  async getIconSVG(iconName: string, _variant?: unknown): Promise<string> {
    // Use raw URL for actual SVG content
    // For now, just fetch the default variant
    const url = `https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/${iconName}/materialsymbolsrounded/${iconName}_24px.svg`;
    const response = await fetch(url);
    return response.text();
  }
}
