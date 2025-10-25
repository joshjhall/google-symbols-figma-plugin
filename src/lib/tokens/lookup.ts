/**
 * Variable lookup utilities - exploring different methods to find variables by name
 */

/**
 * Figma node with potential fill/stroke variable bindings
 */
interface NodeWithPaintBindings {
  fills?: readonly Paint[] | typeof figma.mixed;
  strokes?: readonly Paint[] | typeof figma.mixed;
  boundVariables?: {
    topLeftRadius?: { id: string };
  };
}

/**
 * Paint with bound variable (partial type for our needs)
 */
interface PaintWithBinding {
  boundVariables?: {
    color?: { id: string };
  };
}

/**
 * Main lookup function that tries multiple approaches
 */
export async function lookupVariableIds(): Promise<void> {
  console.log('\n========== VARIABLE ID LOOKUP ==========');
  console.log('Searching for variables by name using multiple methods...\n');

  const targetVariables = [
    'container/surface-bright',
    '_documentation/primary/on-background',
    'MUI Core/M3/sizing/radius/small',
    'radius/small',
    'surface-bright',
    'on-background',
  ];

  console.log('Target variable names to search for:', targetVariables);
  console.log('');

  // Method 1: Try importVariableByKeyAsync (if library variables)
  console.log('--- Method 1: Import by Key ---');
  try {
    // This method is for importing library variables
    const testKeys = [
      'S:bec6d47a11b1e968d6ba28abed627f9c850f3de0,1388:50',
      'S:8eab35e334abb6ad30ba841548c499b6933303a9,719:199',
      'S:08b3c72f043d7ef64d8121132ede573bfb9fc21a,1796:188',
    ];

    for (const key of testKeys) {
      try {
        const variable = await figma.variables.importVariableByKeyAsync(key);
        if (variable) {
          console.log(`Imported variable: ${variable.name} (${variable.id})`);
        }
      } catch (e) {
        console.log(`Could not import with key ${key}: ${e}`);
      }
    }
  } catch {
    console.log('importVariableByKeyAsync not available or failed');
  }

  // Method 2: Get all collections and search
  console.log('\n--- Method 2: Search Collections ---');
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    console.log(`Found ${collections.length} variable collections`);

    for (const collection of collections) {
      console.log(`\nSearching collection: ${collection.name}`);
      console.log(`  Total variables: ${collection.variableIds.length}`);

      // Search through all variables in this collection
      for (const variableId of collection.variableIds) {
        try {
          const variable = await figma.variables.getVariableByIdAsync(variableId);
          if (variable) {
            // Check if this matches any of our target names
            for (const target of targetVariables) {
              if (variable.name.includes(target) || target.includes(variable.name)) {
                console.log(`  FOUND: ${variable.name}`);
                console.log(`    ID: ${variable.id}`);
                console.log(`    Type: ${variable.resolvedType}`);
                console.log(`    Key: ${variable.key}`);
              }
            }
          }
        } catch {
          // Variable might not be accessible
        }
      }
    }
  } catch {
    console.log('Could not search collections');
  }

  // Method 3: Try to get library component's variables
  console.log('\n--- Method 3: Check Library Components ---');
  try {
    // Get all component sets on the current page
    const componentSets = figma.currentPage.findAll((node) => node.type === 'COMPONENT_SET');
    console.log(`Found ${componentSets.length} component sets on page`);

    for (const componentSet of componentSets) {
      // Check if this component has bound variables
      if ('fills' in componentSet) {
        const fills = componentSet.fills as readonly PaintWithBinding[];
        for (const fill of fills) {
          if (fill.boundVariables?.color?.id) {
            const varId = fill.boundVariables.color.id;
            try {
              const variable = await figma.variables.getVariableByIdAsync(varId);
              if (variable) {
                console.log(`Found bound fill variable in ${componentSet.name}:`);
                console.log(`  Name: ${variable.name}`);
                console.log(`  ID: ${variable.id}`);
                console.log(`  Key: ${variable.key}`);
              }
            } catch {
              console.log(`Variable ${varId} exists but not accessible`);
            }
          }
        }
      }

      if ('strokes' in componentSet) {
        const strokes = componentSet.strokes as readonly PaintWithBinding[];
        for (const stroke of strokes) {
          if (stroke.boundVariables?.color?.id) {
            const varId = stroke.boundVariables.color.id;
            try {
              const variable = await figma.variables.getVariableByIdAsync(varId);
              if (variable) {
                console.log(`Found bound stroke variable in ${componentSet.name}:`);
                console.log(`  Name: ${variable.name}`);
                console.log(`  ID: ${variable.id}`);
                console.log(`  Key: ${variable.key}`);
              }
            } catch {
              console.log(`Variable ${varId} exists but not accessible`);
            }
          }
        }
      }
    }
  } catch {
    console.log('Could not check library components');
  }

  // Method 4: Try getLocalVariables with explicit scopes
  console.log('\n--- Method 4: Get Variables by Scope ---');
  try {
    // Try different scopes
    const scopes = ['ALL_SCOPES', 'TEXT_CONTENT', 'FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'];

    for (const scope of scopes) {
      try {
        // Note: This might not be the correct API, but worth trying
        interface VariablesWithExperimentalAPI {
          getVariablesByScope?(scope: string): Promise<Array<{ name: string; id: string }>>;
        }
        const variables = await (
          figma.variables as VariablesWithExperimentalAPI
        ).getVariablesByScope?.(scope);
        if (variables && variables.length > 0) {
          console.log(`Variables in scope ${scope}: ${variables.length}`);
          variables.slice(0, 3).forEach((v) => {
            console.log(`  - ${v.name} (${v.id})`);
          });
        }
      } catch {
        // Method might not exist
      }
    }
  } catch {
    console.log('Scope-based lookup not available');
  }

  // Method 5: Build a name-to-ID mapping from found variables
  console.log('\n--- Method 5: Build Name-to-ID Map ---');
  const nameToIdMap: { [name: string]: string } = {};
  try {
    // Collect all variables we've found so far from other methods
    const allFoundVariables: Array<{ name: string; id: string }> = [];

    // From Method 3, we might have found some variables
    const componentSets = figma.currentPage.findAll((node) => node.type === 'COMPONENT_SET');
    for (const componentSet of componentSets) {
      if ('fills' in componentSet) {
        const fills = componentSet.fills as readonly PaintWithBinding[];
        for (const fill of fills) {
          if (fill.boundVariables?.color?.id) {
            try {
              const variable = await figma.variables.getVariableByIdAsync(
                fill.boundVariables.color.id
              );
              if (variable) {
                allFoundVariables.push({ name: variable.name, id: variable.id });
              }
            } catch {
              // Variable might not be accessible
            }
          }
        }
      }
      if ('strokes' in componentSet) {
        const strokes = componentSet.strokes as readonly PaintWithBinding[];
        for (const stroke of strokes) {
          if (stroke.boundVariables?.color?.id) {
            try {
              const variable = await figma.variables.getVariableByIdAsync(
                stroke.boundVariables.color.id
              );
              if (variable) {
                allFoundVariables.push({ name: variable.name, id: variable.id });
              }
            } catch {
              // Variable might not be accessible
            }
          }
        }
      }
      // Check corner radius
      const boundVars = (componentSet as NodeWithPaintBindings).boundVariables;
      if (boundVars?.topLeftRadius?.id) {
        try {
          const variable = await figma.variables.getVariableByIdAsync(boundVars.topLeftRadius.id);
          if (variable) {
            allFoundVariables.push({ name: variable.name, id: variable.id });
          }
        } catch {
          // Variable might not be accessible
        }
      }
    }

    // Build the map
    for (const { name, id } of allFoundVariables) {
      nameToIdMap[name] = id;
      console.log(`  Mapped: "${name}" -> ${id}`);
    }

    console.log(`Built name-to-ID map with ${Object.keys(nameToIdMap).length} entries`);

    // Now we can look up by name!
    console.log('\nLookup test:');
    for (const targetName of targetVariables) {
      if (nameToIdMap[targetName]) {
        console.log(`  ✓ Found "${targetName}": ${nameToIdMap[targetName]}`);
      }
    }
  } catch {
    console.log('Name mapping method failed');
  }

  // Method 6: Get published variables from library
  console.log('\n--- Method 6: Get Library Variables ---');
  try {
    // Check if we're in a file that uses libraries
    const libraryCollections =
      await figma.teamLibrary?.getAvailableLibraryVariableCollectionsAsync?.();
    if (libraryCollections) {
      console.log(`Found ${libraryCollections.length} library variable collections`);

      // Map to store found variables
      const libraryVariableMap: {
        [name: string]: { id: string; key: string; collection: string };
      } = {};

      // Search through each collection for our target variables
      for (const collection of libraryCollections) {
        console.log(`\n  Searching collection: ${collection.name} (${collection.libraryName})`);
        console.log(`    Key: ${collection.key}`);

        try {
          // Get variables in this collection
          const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
            collection.key
          );
          console.log(`    Found ${variables.length} variables in this collection`);

          // Search for our target variables
          for (const variable of variables) {
            // Check if this matches any of our targets
            for (const target of targetVariables) {
              if (
                variable.name.includes(target) ||
                target.includes(variable.name) ||
                variable.name === target
              ) {
                console.log(`    ✓ MATCH: ${variable.name}`);
                console.log(`      Key: ${variable.key}`);
                console.log(`      Resolved Type: ${variable.resolvedType}`);

                // Try to import this variable to get its ID
                try {
                  const imported = await figma.variables.importVariableByKeyAsync(variable.key);
                  if (imported) {
                    console.log(`      Imported successfully!`);
                    console.log(`      ID: ${imported.id}`);
                    console.log(`      Name: ${imported.name}`);

                    libraryVariableMap[imported.name] = {
                      id: imported.id,
                      key: variable.key,
                      collection: collection.name,
                    };
                  }
                } catch (e) {
                  console.log(`      Could not import: ${e}`);
                }
              }
            }

            // Also log some samples to see what's available
            if (variables.indexOf(variable) < 3) {
              console.log(`    Sample: ${variable.name} (${variable.resolvedType})`);
            }
          }
        } catch (e) {
          console.log(`    Could not get variables from collection: ${e}`);
        }
      }

      // Summary of found library variables
      console.log('\n  Library Variable Summary:');
      for (const [name, info] of Object.entries(libraryVariableMap)) {
        console.log(`    ${name}:`);
        console.log(`      ID: ${info.id}`);
        console.log(`      Key: ${info.key}`);
        console.log(`      Collection: ${info.collection}`);
      }
    }
  } catch {
    console.log('Could not access library variables');
  }

  console.log('\n========== END VARIABLE LOOKUP ==========\n');

  figma.ui.postMessage({
    type: 'STATUS',
    message: 'Variable lookup complete - check console for results',
  });
}
