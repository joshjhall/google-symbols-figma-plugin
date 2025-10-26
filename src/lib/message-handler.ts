/**
 * Handles communication between plugin and UI
 */

import { PLUGIN_MESSAGES, UIMessage } from '@/types';
// Note: test-generators and icon-generator files were removed - test functions stubbed out
import { IconListFetcher } from '@lib/icons/icon-list-fetcher';
import { TokenManager } from './config/token-manager';

export class MessageHandler {
  private listFetcher?: IconListFetcher;

  /**
   * Ensure IconListFetcher is initialized with token from secure source
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.listFetcher) {
      const token = await TokenManager.getVersionCheckToken();
      this.listFetcher = new IconListFetcher({ token });
    }
  }

  async handleMessage(msg: UIMessage): Promise<void> {
    switch (msg.type) {
      case PLUGIN_MESSAGES.CHECK_EXISTING:
        await this.checkExistingComponents();
        break;

      case PLUGIN_MESSAGES.START_GENERATION:
        await this.startGeneration(msg.config);
        break;

      case PLUGIN_MESSAGES.RUN_PERFORMANCE_TEST:
        await this.runPerformanceTest();
        break;

      case PLUGIN_MESSAGES.TEST_SINGLE_ICON:
        await this.testSingleIcon();
        break;

      case PLUGIN_MESSAGES.CANCEL:
        // Handle cancellation
        console.log('Generation cancelled');
        break;

      default:
        console.log('Unknown message type:', msg.type);
    }
  }

  private async checkExistingComponents() {
    const components = figma.root.findAll(
      (node) => node.type === 'COMPONENT_SET' && node.name.toLowerCase().includes('icon')
    );

    figma.ui.postMessage({
      type: PLUGIN_MESSAGES.EXISTING_COMPONENTS,
      count: components.length,
    });
  }

  private async startGeneration(_config: unknown) {
    try {
      figma.ui.postMessage({
        type: PLUGIN_MESSAGES.PROGRESS_UPDATE,
        message: 'Starting icon generation...',
        progress: 0,
      });

      // For now, just test with a single icon
      await this.testSingleIcon();

      figma.ui.postMessage({
        type: PLUGIN_MESSAGES.GENERATION_COMPLETE,
        message: 'Generation complete!',
      });
    } catch (error) {
      figma.ui.postMessage({
        type: PLUGIN_MESSAGES.ERROR,
        message: `Generation failed: ${error}`,
      });
    }
  }

  private async runPerformanceTest() {
    console.log('Running performance test...');
    const startTime = Date.now();

    // Test node creation speed
    const testNodes: SceneNode[] = [];
    for (let i = 0; i < 100; i++) {
      const rect = figma.createRectangle();
      rect.x = i * 10;
      rect.y = 0;
      rect.resize(10, 10);
      testNodes.push(rect);
    }

    const creationTime = Date.now() - startTime;

    // Clean up
    testNodes.forEach((node) => node.remove());

    figma.ui.postMessage({
      type: PLUGIN_MESSAGES.PERFORMANCE_RESULTS,
      results: {
        nodeCreation: `${creationTime}ms for 100 nodes`,
      },
    });
  }

  private async testSingleIcon() {
    // Test function removed - stubbed out
    console.log('Test function removed');
    figma.ui.postMessage({
      type: PLUGIN_MESSAGES.ERROR,
      message: 'Test functions have been removed - use production generation',
    });
  }
}
