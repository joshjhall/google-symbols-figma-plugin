/**
 * @module @figma/config/token-manager
 *
 * Secure token management with 1Password integration.
 * Priority order:
 * 1. 1Password (op CLI)
 * 2. Environment variable
 * 3. .env file
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TokenConfig {
  name: string;
  opVaultItem: string;
  envVar: string;
  description: string;
}

export const TOKEN_CONFIGS: Record<string, TokenConfig> = {
  RELEASE: {
    name: 'Release Token',
    opVaultItem: 'GitHub (Figma icon plugin releases)',
    envVar: 'GITHUB_RELEASE_TOKEN',
    description: 'Token for creating releases and uploading assets',
  },
  VERSION_CHECK: {
    name: 'Version Check Token',
    opVaultItem: 'GitHub (Version check)',
    envVar: 'GITHUB_VERSION_CHECK_TOKEN',
    description: 'Token for reading public repos to check icon versions',
  },
} as const;

export type TokenType = keyof typeof TOKEN_CONFIGS;

interface TokenResult {
  token: string;
  source: '1password' | 'environment' | 'dotenv' | 'fallback';
}

/**
 * Retrieves a GitHub token using the priority order:
 * 1. 1Password CLI (if available)
 * 2. Environment variable
 * 3. .env file
 */
export class TokenManager {
  private static cachedTokens: Map<TokenType, TokenResult> = new Map();
  private static opAvailable: boolean | null = null;
  private static envFileLoaded = false;

  /**
   * Get a token by type with automatic fallback logic
   */
  static async getToken(type: TokenType): Promise<TokenResult> {
    // Return cached token if available
    const cached = this.cachedTokens.get(type);
    if (cached) {
      return cached;
    }

    const config = TOKEN_CONFIGS[type];

    // Try 1Password first
    const opToken = await this.tryOnePassword(config);
    if (opToken) {
      const result: TokenResult = { token: opToken, source: '1password' };
      this.cachedTokens.set(type, result);
      console.log(`✓ ${config.name} loaded from 1Password`);
      return result;
    }

    // Try environment variable
    const envToken = this.tryEnvironment(config);
    if (envToken) {
      const result: TokenResult = { token: envToken, source: 'environment' };
      this.cachedTokens.set(type, result);
      console.log(`✓ ${config.name} loaded from environment variable`);
      return result;
    }

    // Try .env file
    const dotenvToken = await this.tryDotEnv(config);
    if (dotenvToken) {
      const result: TokenResult = { token: dotenvToken, source: 'dotenv' };
      this.cachedTokens.set(type, result);
      console.log(`✓ ${config.name} loaded from .env file`);
      return result;
    }

    // No token found
    throw new Error(
      `${config.name} not found. Tried:\n` +
        `  1. 1Password vault item: "${config.opVaultItem}"\n` +
        `  2. Environment variable: ${config.envVar}\n` +
        `  3. .env file: ${config.envVar}\n\n` +
        `Please set up token using one of these methods.\n` +
        `See docs/github-token-setup.md for instructions.`
    );
  }

  /**
   * Try to fetch token from 1Password using op CLI
   */
  private static async tryOnePassword(config: TokenConfig): Promise<string | null> {
    // Check if op CLI is available (cached result)
    if (this.opAvailable === false) {
      return null;
    }

    try {
      // Test if op is available
      if (this.opAvailable === null) {
        execSync('op --version', { stdio: 'ignore' });
        this.opAvailable = true;
      }

      // Try to read from 1Password
      // Format: op://Private/<item-name>/credential
      const command = `op read "op://Private/${config.opVaultItem}/credential"`;
      const token = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
        timeout: 5000, // 5 second timeout
      }).trim();

      if (token && token.startsWith('ghp_')) {
        return token;
      }

      return null;
    } catch {
      // op CLI not available or not authenticated
      if (this.opAvailable === null) {
        this.opAvailable = false;
      }
      return null;
    }
  }

  /**
   * Try to get token from environment variable
   */
  private static tryEnvironment(config: TokenConfig): string | null {
    const token = process.env[config.envVar];
    if (token && token.startsWith('ghp_')) {
      return token;
    }
    return null;
  }

  /**
   * Try to get token from .env file
   */
  private static async tryDotEnv(config: TokenConfig): Promise<string | null> {
    // Load .env file once
    if (!this.envFileLoaded) {
      await this.loadEnvFile();
      this.envFileLoaded = true;
    }

    // Check if token is now in environment
    return this.tryEnvironment(config);
  }

  /**
   * Load .env file using dotenv
   */
  private static async loadEnvFile(): Promise<void> {
    try {
      const dotenvPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(dotenvPath)) {
        // Dynamically import dotenv
        const dotenv = await import('dotenv');
        dotenv.config({ path: dotenvPath });
      }
    } catch {
      // .env file not found or couldn't be loaded
      // This is not an error - just means we skip this source
    }
  }

  /**
   * Validate that a token has the required GitHub scopes
   */
  static async validateToken(
    token: string,
    requiredScopes: string[]
  ): Promise<{ valid: boolean; scopes: string[]; error?: string }> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'Google-Symbols-Figma-Plugin',
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          scopes: [],
          error: `Token validation failed: ${response.status} ${response.statusText}`,
        };
      }

      const scopesHeader = response.headers.get('X-OAuth-Scopes') || '';
      const scopes = scopesHeader
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const missingScopes = requiredScopes.filter((required) => !scopes.includes(required));

      if (missingScopes.length > 0) {
        return {
          valid: false,
          scopes,
          error: `Token missing required scopes: ${missingScopes.join(', ')}`,
        };
      }

      return { valid: true, scopes };
    } catch (error) {
      return {
        valid: false,
        scopes: [],
        error: `Token validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get token for release operations (requires 'repo' scope)
   */
  static async getReleaseToken(): Promise<string> {
    const result = await this.getToken('RELEASE');
    const validation = await this.validateToken(result.token, ['repo']);

    if (!validation.valid) {
      throw new Error(
        `Release token validation failed: ${validation.error}\n\n` +
          `The release token requires 'repo' scope for:\n` +
          `  - Creating releases\n` +
          `  - Uploading release assets\n\n` +
          `Please update your token at: https://github.com/settings/tokens`
      );
    }

    return result.token;
  }

  /**
   * Get token for version checking (public read access)
   */
  static async getVersionCheckToken(): Promise<string> {
    const result = await this.getToken('VERSION_CHECK');

    // Version check token doesn't need special scopes (public read)
    // But we still validate it's a valid token
    const validation = await this.validateToken(result.token, []);

    if (!validation.valid) {
      throw new Error(
        `Version check token validation failed: ${validation.error}\n\n` +
          `This token is used for reading public repository data.\n` +
          `Please check your token at: https://github.com/settings/tokens`
      );
    }

    return result.token;
  }

  /**
   * Clear cached tokens (useful for testing or token rotation)
   */
  static clearCache(): void {
    this.cachedTokens.clear();
    this.envFileLoaded = false;
  }

  /**
   * Check if 1Password CLI is available
   */
  static async checkOnePasswordAvailable(): Promise<boolean> {
    if (this.opAvailable !== null) {
      return this.opAvailable;
    }

    try {
      execSync('op --version', { stdio: 'ignore' });
      this.opAvailable = true;
      return true;
    } catch {
      this.opAvailable = false;
      return false;
    }
  }

  /**
   * Get diagnostic information about token sources
   */
  static async diagnose(): Promise<{
    opAvailable: boolean;
    tokens: Record<TokenType, { found: boolean; source?: string; valid?: boolean }>;
  }> {
    const opAvailable = await this.checkOnePasswordAvailable();
    const tokens: Record<string, { found: boolean; source?: string; valid?: boolean }> = {};

    for (const type of Object.keys(TOKEN_CONFIGS) as TokenType[]) {
      try {
        const result = await this.getToken(type);
        const validation = await this.validateToken(result.token, []);
        tokens[type] = {
          found: true,
          source: result.source,
          valid: validation.valid,
        };
      } catch {
        tokens[type] = { found: false };
      }
    }

    return { opAvailable, tokens };
  }
}
