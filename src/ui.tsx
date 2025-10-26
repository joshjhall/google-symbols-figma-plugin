// This file runs in the browser (iframe)
// It has access to browser APIs but not the Figma API

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { PLUGIN_MESSAGES, PluginMessage } from '@/types';
// @ts-ignore - JSON import
import categoriesData from '@/data/categories-summary.json';

// Category data structure
interface Category {
  name: string;
  count: number;
  components: number;
  firstIcon: string;
  lastIcon: string; // Actual last icon in set (for display: "severe_cold to spatial_tracking")
  lastIconExclusive: string; // Exclusive boundary for getIconRange (internal: "speaker")
}

// Log entry structure
interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
}

// Generation state
interface GenerationState {
  isRunning: boolean;
  category: string | null;
  totalIcons: number;
  completedIcons: number;
  currentIcon: string | null;
  currentIconProgress: number; // 0-100 for current icon variants
}

function App() {
  console.log('App component mounting');

  // Categories from categories-summary.json
  const categories: Category[] = categoriesData;

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0].name);
  const [generationState, setGenerationState] = useState<GenerationState>({
    isRunning: false,
    category: null,
    totalIcons: 0,
    completedIcons: 0,
    currentIcon: null,
    currentIconProgress: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Add log entry
  const addLog = (level: 'info' | 'warning' | 'error', message: string) => {
    setLogs((prev) => [...prev, { timestamp: new Date(), level, message }]);
  };

  // Handle messages from plugin
  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case PLUGIN_MESSAGES.INIT:
          addLog('info', 'Plugin initialized');

          // Smart category selection based on existing pages
          if (msg.pageNames && msg.pageNames.length > 0) {
            // Check if any page name matches a category name (exact match or by set number)
            const categoryNames = categories.map((c) => c.name);

            // Try exact match first
            let matchingCategory = msg.pageNames.find((pageName) =>
              categoryNames.includes(pageName)
            );

            // If no exact match, try matching by set number (handles both "Set NN:" and "Cat NN:" → "Set NN:")
            if (!matchingCategory) {
              for (const pageName of msg.pageNames) {
                // Match both "Set NN:" and "Cat NN:" patterns
                const pageSetMatch = pageName.match(/^(?:Set|Cat) (\d+):/);
                if (pageSetMatch) {
                  const pageSetNumber = pageSetMatch[1];
                  const matchingCat = categories.find((c) => {
                    const catSetMatch = c.name.match(/^Set (\d+):/);
                    return catSetMatch && catSetMatch[1] === pageSetNumber;
                  });

                  if (matchingCat) {
                    matchingCategory = matchingCat.name;
                    if (pageName.startsWith('Cat ')) {
                      addLog(
                        'info',
                        `Matched old page "${pageName}" to new category "${matchingCat.name}" (Cat→Set transition)`
                      );
                    } else {
                      addLog(
                        'info',
                        `Matched page "${pageName}" to category "${matchingCat.name}" by set number`
                      );
                    }
                    break;
                  }
                }
              }
            }

            if (matchingCategory) {
              setSelectedCategory(matchingCategory);
              addLog('info', `Auto-selected category: ${matchingCategory}`);
            }
          }
          break;

        case PLUGIN_MESSAGES.PROGRESS_UPDATE:
          if (msg.message) {
            addLog('info', msg.message);
          }
          // Update generation state based on progress message
          setGenerationState((prev) => ({
            ...prev,
            currentIcon: msg.currentIcon || prev.currentIcon,
            completedIcons: msg.completedIcons ?? prev.completedIcons,
            currentIconProgress: msg.currentIconProgress ?? prev.currentIconProgress,
          }));
          break;

        case PLUGIN_MESSAGES.GENERATION_COMPLETE:
          addLog('info', msg.message || 'Generation complete!');
          setGenerationState((prev) => ({
            ...prev,
            isRunning: false,
            currentIcon: null,
            currentIconProgress: 0,
          }));
          break;

        case PLUGIN_MESSAGES.ERROR:
          addLog('error', msg.message || 'An error occurred');
          setGenerationState((prev) => ({
            ...prev,
            isRunning: false,
          }));
          break;

        case 'WARNING':
          addLog('warning', msg.message || 'Warning');
          break;
      }
    };

    return () => {
      window.onmessage = null;
    };
  }, []);

  // Get selected category data
  const selectedCategoryData = categories.find((c) => c.name === selectedCategory);

  // Start generation
  const handleStart = () => {
    if (!selectedCategoryData) return;

    addLog('info', `Starting generation for ${selectedCategoryData.name}`);
    addLog('info', `Total icons to process: ${selectedCategoryData.count}`);
    addLog(
      'info',
      `Icon range: ${selectedCategoryData.firstIcon} to ${selectedCategoryData.lastIcon}`
    );

    setGenerationState({
      isRunning: true,
      category: selectedCategoryData.name,
      totalIcons: selectedCategoryData.count,
      completedIcons: 0,
      currentIcon: null,
      currentIconProgress: 0,
    });

    parent.postMessage(
      {
        pluginMessage: {
          type: PLUGIN_MESSAGES.START_GENERATION,
          category: selectedCategoryData.name,
          categoryData: selectedCategoryData,
          testIconCount: null, // Always process all icons
        },
      },
      '*'
    );
  };

  // Cancel generation
  const handleCancel = () => {
    addLog('warning', 'Cancelling generation...');

    parent.postMessage(
      {
        pluginMessage: {
          type: PLUGIN_MESSAGES.CANCEL,
        },
      },
      '*'
    );

    setGenerationState((prev) => ({
      ...prev,
      isRunning: false,
      currentIcon: null,
      currentIconProgress: 0,
    }));
  };

  // Copy logs to clipboard (last 30 lines only)
  const handleCopyLogs = () => {
    const last30Logs = logs.slice(-30);
    const logText = last30Logs
      .map(
        (log) =>
          `[${log.timestamp.toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`
      )
      .join('\n');

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(logText)
        .then(() => {
          addLog('info', `Copied last ${last30Logs.length} log entries to clipboard`);
        })
        .catch(() => {
          // Fallback to textarea method if modern API fails
          copyViaTextarea(logText, last30Logs.length);
        });
    } else {
      // Use textarea fallback
      copyViaTextarea(logText, last30Logs.length);
    }
  };

  // Fallback copy method using textarea
  const copyViaTextarea = (text: string, count: number) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const success = document.execCommand('copy');
      if (success) {
        addLog('info', `Copied last ${count} log entries to clipboard`);
      } else {
        addLog('error', 'Failed to copy logs');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog('error', `Failed to copy logs: ${errorMsg}`);
    } finally {
      document.body.removeChild(textarea);
    }
  };

  // Download logs as text file
  const handleDownloadLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp.toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`
      )
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `material-icons-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog('info', 'Logs downloaded');
  };

  // Clear logs
  const handleClearLogs = () => {
    setLogs([]);
  };

  // Calculate overall progress percentage
  const overallProgress =
    generationState.totalIcons > 0
      ? Math.round((generationState.completedIcons / generationState.totalIcons) * 100)
      : 0;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Material Icons Generator</h2>

      {/* Icon Set Selection */}
      <div style={styles.section}>
        <label style={styles.label}>
          Icon Set ({selectedCategoryData?.count || 0} icons,{' '}
          {selectedCategoryData?.components || 0} variants)
        </label>
        <select
          style={styles.select}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          disabled={generationState.isRunning}
        >
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.name} ({cat.count} icons)
            </option>
          ))}
        </select>
        {selectedCategoryData && (
          <div style={styles.categoryInfo}>
            Range: {selectedCategoryData.firstIcon} → {selectedCategoryData.lastIcon}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div style={styles.section}>
        {!generationState.isRunning ? (
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={handleStart}>
            Start Import
          </button>
        ) : (
          <button style={{ ...styles.button, ...styles.dangerButton }} onClick={handleCancel}>
            Cancel / Stop
          </button>
        )}
      </div>

      {/* Progress Indicator */}
      {generationState.isRunning && (
        <div style={styles.section}>
          <div style={styles.progressSection}>
            <div style={styles.progressHeader}>
              <span style={styles.progressLabel}>
                Overall Progress: {generationState.completedIcons} / {generationState.totalIcons}{' '}
                icons
              </span>
              <span style={styles.progressPercent}>{overallProgress}%</span>
            </div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${overallProgress}%` }} />
            </div>
          </div>

          {generationState.currentIcon && (
            <div style={styles.progressSection}>
              <div style={styles.progressHeader}>
                <span style={styles.progressLabel}>
                  Current Icon: {generationState.currentIcon}
                </span>
                <span style={styles.progressPercent}>{generationState.currentIconProgress}%</span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    ...styles.progressFillSecondary,
                    width: `${generationState.currentIconProgress}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs Viewer */}
      <div style={styles.section}>
        <div style={styles.logsHeader}>
          <label style={styles.label}>Logs</label>
          <div style={styles.logsActions}>
            <button
              style={styles.smallButton}
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              title="Copy last 30 log entries to clipboard"
            >
              Copy Recent
            </button>
            <button
              style={styles.smallButton}
              onClick={handleDownloadLogs}
              disabled={logs.length === 0}
              title="Download logs as text file"
            >
              Download
            </button>
            <button
              style={styles.smallButton}
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              title="Clear all logs"
            >
              Clear
            </button>
          </div>
        </div>
        <div style={styles.logsContainer}>
          {logs.length === 0 ? (
            <div style={styles.logsEmpty}>No logs yet</div>
          ) : (
            logs.map((log, index) => {
              // Determine color based on log level
              const isError = log.level === 'error';
              const isWarning = log.level === 'warning';
              const logColor = isError ? '#D32F2F' : isWarning ? '#F57C00' : '#333';
              const timestampColor = isError ? '#D32F2F' : isWarning ? '#F57C00' : '#666';

              return (
                <div key={index} style={styles.logEntry}>
                  <span style={{ ...styles.logTimestamp, color: timestampColor }}>
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                  <span
                    style={{ ...styles.logLevel, color: logColor, fontWeight: isError ? 700 : 600 }}
                  >
                    {log.level.toUpperCase()}:
                  </span>
                  <span style={{ ...styles.logMessage, color: logColor }}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    color: '#333',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '16px',
    marginBottom: '16px',
    fontWeight: 600,
  },
  section: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
    fontSize: '12px',
  },
  select: {
    width: '100%',
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'white',
  },
  categoryInfo: {
    marginTop: '6px',
    fontSize: '11px',
    color: '#666',
    fontFamily: 'monospace',
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '8px',
    backgroundColor: '#F5F5F5',
    borderRadius: '4px',
    border: '1px solid #E0E0E0',
  },
  radio: {
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  },
  radioText: {
    fontSize: '12px',
    color: '#333',
    userSelect: 'none',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '8px',
    backgroundColor: '#F5F5F5',
    borderRadius: '4px',
    border: '1px solid #E0E0E0',
  },
  checkbox: {
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  },
  checkboxText: {
    fontSize: '12px',
    color: '#333',
    userSelect: 'none',
  },
  hint: {
    fontSize: '11px',
    color: '#666',
    marginTop: '4px',
    marginLeft: '24px',
    lineHeight: '1.4',
  },
  button: {
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  primaryButton: {
    backgroundColor: '#18A0FB',
    color: 'white',
  },
  dangerButton: {
    backgroundColor: '#F24822',
    color: 'white',
  },
  progressSection: {
    marginBottom: '12px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  progressLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#333',
  },
  progressPercent: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#18A0FB',
  },
  progressBar: {
    height: '6px',
    backgroundColor: '#E0E0E0',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#18A0FB',
    transition: 'width 0.3s ease',
  },
  progressFillSecondary: {
    backgroundColor: '#7B61FF',
  },
  logsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  logsActions: {
    display: 'flex',
    gap: '6px',
  },
  smallButton: {
    padding: '4px 10px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    backgroundColor: 'white',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  logsContainer: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#F9F9F9',
    padding: '8px',
    height: '200px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '11px',
    flex: 1,
  },
  logsEmpty: {
    color: '#999',
    textAlign: 'center',
    padding: '20px',
  },
  logEntry: {
    marginBottom: '4px',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  logTimestamp: {
    color: '#666',
    marginRight: '6px',
  },
  logLevel: {
    fontWeight: 600,
    marginRight: '6px',
  },
  logMessage: {
    // Color applied inline based on log level
  },
  // Unused - colors now applied inline for proper cascading
  // logError: {
  //   color: '#D32F2F',
  // },
  // logWarning: {
  //   color: '#F57C00',
  // },
};

console.log('UI script loaded');

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
  console.log('React app rendered');
} else {
  console.error('Root element not found!');
}
