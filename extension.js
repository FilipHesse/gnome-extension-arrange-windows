const { Meta, GLib, Gio } = imports.gi;
const Main = imports.ui.main;
const WorkspaceManager = global.workspace_manager;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function getWMClass(win) {
    return win.get_wm_class_instance() || win.get_wm_class();
}

function sleep() {
    let sleep_for_ms = 2000;
    return new Promise(resolve => setTimeout(resolve, sleep_for_ms));
}

function logMonitorGeometries() {
    global.log("  Listing monitor geometries, indices, and names:");
    let monitors = Main.layoutManager.monitors;
    for (let i = 0; i < monitors.length; i++) {
        let monitor = monitors[i];
        global.log("  Monitor " + i + ": name=" + monitor.connector + ", x=" + monitor.x + ", y=" + monitor.y + ", width=" + monitor.width + ", height=" + monitor.height);
    }
}

function getCustomMonitorIndexMapping() {
    let monitors = Main.layoutManager.monitors;
    let sortedMonitors = monitors.slice().sort((a, b) => {
        if (a.x === b.x) {
            return a.y - b.y;
        }
        return a.x - b.x;
    });

    let indexMapping = {};
    for (let i = 0; i < sortedMonitors.length; i++) {
        let monitor = sortedMonitors[i];
        let originalIndex = monitors.indexOf(monitor);
        indexMapping[i] = originalIndex;
        global.log(`Custom index ${i} assigned to monitor with original index ${originalIndex} (x=${monitor.x}, y=${monitor.y})`);
    }
    return indexMapping;
}

function getMonitorByCustomIndex(customScreenIndex) {
    let indexMapping = getCustomMonitorIndexMapping();
    let screenIndex = indexMapping[customScreenIndex];

    if (screenIndex === undefined) {
        global.log(`Invalid custom screen index: ${customScreenIndex}`);
        return;
    }

    let monitor = Main.layoutManager.monitors[screenIndex];
    if (!monitor) {
        global.log(`Monitor not found for screen index: ${screenIndex}`);
        return;
    }
    return monitor
}

async function moveWindowsToScreenAndWorkspace(wmClass, customScreenIndex, workspaceIndex) {
    global.log(`moveWindowsToScreenAndWorkspace called with wmClass: ${wmClass}, customScreenIndex: ${customScreenIndex}, workspaceIndex: ${workspaceIndex}`);
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    let movedWindows = 0;
    
    let monitor = getMonitorByCustomIndex(customScreenIndex)
    for (let win of windows) {
        global.log(`Checking window: ${getWMClass(win)}`);
        let winClass = getWMClass(win).toLowerCase();
        if (winClass === wmClass.toLowerCase()) {
            global.log(`Found window: ${getWMClass(win)}`);
            let workspace = WorkspaceManager.get_workspace_by_index(workspaceIndex);
            if (workspace) {
                global.log(`Moving window to workspace: ${workspaceIndex}`);
                win.change_workspace(workspace);
                await sleep()

                // Ensure the monitor dimensions and positions are valid
                if (monitor.x >= 0 && monitor.y >= 0 && monitor.width > 0 && monitor.height > 0) {
                    global.log(`Moving window to monitor at x=${monitor.x}, y=${monitor.y}`);
                    win.move_frame(true, monitor.x, monitor.y);
                    win.activate(global.get_current_time());
                    await sleep()
                    movedWindows++;
                } else {
                    global.log(`Invalid monitor dimensions or position: x=${monitor.x}, y=${monitor.y}, width=${monitor.width}, height=${monitor.height}`);
                }
            } else {
                global.log(`Workspace ${workspaceIndex} not found`);
            }
        }
    }
    global.log(`Moved ${movedWindows} windows to workspace ${workspaceIndex} and monitor ${customScreenIndex}`);
}

function makeWindowsFullscreen(wmClass) {
    global.log("  makeWindowsFullscreen called with wmClass: " + wmClass);
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("  Checking window: " + getWMClass(win));
        if (getWMClass(win) === wmClass) {
            global.log("  Found window: " + getWMClass(win));
            win.maximize(Meta.MaximizeFlags.BOTH);
            win.activate(global.get_current_time());
        }
    }
}

function makeWindowsSticky(wmClass) {
    global.log("  makeWindowsSticky called with wmClass: " + wmClass);
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("  Checking window: " + getWMClass(win));
        if (getWMClass(win) === wmClass) {
            global.log("  Found window: " + getWMClass(win));
            win.stick();
            win.activate(global.get_current_time());
        }
    }
}

function moveAndResizeWindow(win, customScreenIndex, xFactor, yFactor, widthFactor, heightFactor) {
    let monitor = getMonitorByCustomIndex(customScreenIndex)
    global.log("  Windows detected on monitor: x=" + monitor.x + ", y=" + monitor.y + ", width=" + monitor.width + ", height=" + monitor.height);
    let newX = monitor.x + monitor.width * xFactor;
    let newY = monitor.y + monitor.height * yFactor;
    let newWidth = monitor.width * widthFactor;
    let newHeight = monitor.height * heightFactor;
    global.log(`New position and size: x=${newX}, y=${newY}, width=${newWidth}, height=${newHeight}`);
    win.move_resize_frame(true, newX, newY, newWidth, newHeight);
    win.activate(global.get_current_time());
    global.log(`Window moved and resized: ${getWMClass(win)}`);
}

function moveAndResizeWindows(wmClass, customScreenIndex, xFactor, yFactor, widthFactor, heightFactor) {
    global.log(`moveAndResizeWindows called with wmClass: ${wmClass}, xFactor: ${xFactor}, yFactor: ${yFactor}, widthFactor: ${widthFactor}, heightFactor: ${heightFactor}`);
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        let winClass = getWMClass(win);
        global.log(`Checking window: ${winClass}`);
        if (winClass === wmClass) {
            global.log(`Found window: ${winClass}`);
            global.log(`Unmaximizing window: ${winClass}`);
            win.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            // Add a delay to ensure the unmaximize operation completes
            global.log(`Attempting to move and resize window after unmaximize: ${winClass}`);
            moveAndResizeWindow(win, customScreenIndex, xFactor, yFactor, widthFactor, heightFactor);
            return GLib.SOURCE_REMOVE;

        } else {
            global.log(`Window class does not match: ${winClass}`);
        }
    }
}


function moveWindowsToLeftHalf(wmClass, customScreenIndex) {
    moveAndResizeWindows(wmClass, customScreenIndex, 0, 0, 0.5, 1);
}

function moveWindowsToRightHalf(wmClass, customScreenIndex) {
    moveAndResizeWindows(wmClass, customScreenIndex, 0.5, 0, 0.5, 1);
}

function moveWindowsToTopRight(wmClass, customScreenIndex) {
    moveAndResizeWindows(wmClass, customScreenIndex, 0.5, 0, 0.5, 0.5);
}

function moveWindowsToLowRight(wmClass, customScreenIndex) {
    moveAndResizeWindows(wmClass, customScreenIndex, 0.5, 0.5, 0.5, 0.5);
}

function moveWindowsToTopLeft(wmClass, customScreenIndex) {
    moveAndResizeWindows(wmClass, customScreenIndex, 0, 0, 0.5, 0.5);
}

function moveWindowsToLowLeft(wmClass, customScreenIndex) {
    moveAndResizeWindows(wmClass, customScreenIndex, 0, 0.5, 0.5, 0.5);
}

function logAllWMClasses() {
    global.log("  Listing WM_CLASS properties of all open windows:");
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("  Window WM_CLASS: " + getWMClass(win));
    }
}

function listAllWindows() {
    global.log("  Listing all open windows with their titles:");
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("  Window title: " + win.get_title());
    }
}


function init() {
}

async function executeSequence(config) {
    for (const item of config) {
        const { window, screen, workspace, actions } = item;
        global.log("MODIFYING WINDOW: " + window + " -------------------------------------------------");
        await moveWindowsToScreenAndWorkspace(window, screen, workspace);
        await sleep();

        if (actions.includes('sticky')) {
            makeWindowsSticky(window);
        }

        if (actions.includes('fullscreen')) {
            makeWindowsFullscreen(window);
        }

        if (actions.includes('leftHalf')) {
            moveWindowsToLeftHalf(window, screen);
        }

        if (actions.includes('rightHalf')) {
            moveWindowsToRightHalf(window, screen);
        }

        if (actions.includes('topRight')) {
            moveWindowsToTopRight(window, screen);
        }

        if (actions.includes('lowRight')) {
            moveWindowsToLowRight(window, screen);
        }

        if (actions.includes('topLeft')) {
            moveWindowsToTopLeft(window, screen);
        }

        if (actions.includes('lowLeft')) {
            moveWindowsToLowLeft(window, screen);
        }
    }
}

async function readFile(relativeFilePath) {
    try {
      let filePath = Me.dir.get_path() + '/' + relativeFilePath;
      let file = Gio.File.new_for_path(filePath);
      let [success, contents] = file.load_contents(null);
  
      if (success) {
        return contents.toString();
      } else {
        throw new Error('Failed to read file');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  }

async function enable() {
    logMonitorGeometries();
    listAllWindows(); // List all windows when the extension is enabled
    logAllWMClasses(); // Log WM_CLASS properties when the extension is enabled

    const relativeFilePath = 'config.json'; // Relative path to the file within the extension directory
    const fileContents = await readFile(relativeFilePath);
  
    if (fileContents) {
      const config = JSON.parse(fileContents);
      await executeSequence(config);
    }

}

function disable() {
}