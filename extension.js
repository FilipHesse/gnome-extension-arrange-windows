const { Meta, GLib } = imports.gi;
const Main = imports.ui.main;
const WorkspaceManager = global.workspace_manager;
const Mainloop = imports.mainloop;

function getWMClass(win) {
    return win.get_wm_class_instance() || win.get_wm_class();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logMonitorGeometries() {
    global.log("Listing monitor geometries, indices, and names:");
    let monitors = Main.layoutManager.monitors;
    for (let i = 0; i < monitors.length; i++) {
        let monitor = monitors[i];
        global.log("Monitor " + i + ": name=" + monitor.connector + ", x=" + monitor.x + ", y=" + monitor.y + ", width=" + monitor.width + ", height=" + monitor.height);
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

function moveWindowsToScreenAndWorkspace(wmClass, customScreenIndex, workspaceIndex) {
    global.log(`moveWindowsToScreenAndWorkspace called with wmClass: ${wmClass}, customScreenIndex: ${customScreenIndex}, workspaceIndex: ${workspaceIndex}`);
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    let movedWindows = 0;
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

    for (let win of windows) {
        global.log(`Checking window: ${getWMClass(win)}`);
        let winClass = getWMClass(win).toLowerCase();
        if (winClass === wmClass.toLowerCase()) {
            global.log(`Found window: ${getWMClass(win)}`);
            let workspace = WorkspaceManager.get_workspace_by_index(workspaceIndex);
            if (workspace) {
                global.log(`Moving window to workspace: ${workspaceIndex}`);
                win.change_workspace(workspace);

                // Ensure the monitor dimensions and positions are valid
                if (monitor.x >= 0 && monitor.y >= 0 && monitor.width > 0 && monitor.height > 0) {
                    global.log(`Moving window to monitor at x=${monitor.x}, y=${monitor.y}`);
                    win.move_frame(true, monitor.x, monitor.y);
                    win.activate(global.get_current_time());
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
    global.log("makeWindowsFullscreen called with wmClass: " + wmClass);
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("Checking window: " + getWMClass(win));
        if (getWMClass(win) === wmClass) {
            global.log("Found window: " + getWMClass(win));
            win.maximize(Meta.MaximizeFlags.BOTH);
            win.activate(global.get_current_time());
        }
    }
}

function makeWindowsSticky(wmClass) {
    global.log("makeWindowsSticky called with wmClass: " + wmClass);
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("Checking window: " + getWMClass(win));
        if (getWMClass(win) === wmClass) {
            global.log("Found window: " + getWMClass(win));
            win.stick();
            win.activate(global.get_current_time());
        }
    }
}

function moveAndResizeWindow(win, xFactor, yFactor, widthFactor, heightFactor) {
    let monitor = global.display.get_monitor_geometry(win.get_monitor());
    let newX = monitor.x + monitor.width * xFactor;
    let newY = monitor.y + monitor.height * yFactor;
    let newWidth = monitor.width * widthFactor;
    let newHeight = monitor.height * heightFactor;
    global.log(`New position and size: x=${newX}, y=${newY}, width=${newWidth}, height=${newHeight}`);
    win.move_resize_frame(true, newX, newY, newWidth, newHeight);
    win.activate(global.get_current_time());
    global.log(`Window moved and resized: ${getWMClass(win)}`);
}

function moveAndResizeWindows(wmClass, xFactor, yFactor, widthFactor, heightFactor) {
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
            moveAndResizeWindow(win, xFactor, yFactor, widthFactor, heightFactor);
            return GLib.SOURCE_REMOVE;

        } else {
            global.log(`Window class does not match: ${winClass}`);
        }
    }
}


function moveWindowsToLeftHalf(wmClass) {
    moveAndResizeWindows(wmClass, 0, 0, 0.5, 1);
}

function moveWindowsToRightHalf(wmClass) {
    moveAndResizeWindows(wmClass, 0.5, 0, 0.5, 1);
}

function moveWindowsToTopRight(wmClass) {
    moveAndResizeWindows(wmClass, 0.5, 0, 0.5, 0.5);
}

function moveWindowsToLowRight(wmClass) {
    moveAndResizeWindows(wmClass, 0.5, 0.5, 0.5, 0.5);
}

function moveWindowsToTopLeft(wmClass) {
    moveAndResizeWindows(wmClass, 0, 0, 0.5, 0.5);
}

function moveWindowsToLowLeft(wmClass) {
    moveAndResizeWindows(wmClass, 0, 0.5, 0.5, 0.5);
}

function logAllWMClasses() {
    global.log("Listing WM_CLASS properties of all open windows:");
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("Window WM_CLASS: " + getWMClass(win));
    }
}

function listAllWindows() {
    global.log("Listing all open windows with their titles:");
    let windows = global.get_window_actors().map(actor => actor.meta_window);
    for (let win of windows) {
        global.log("Window title: " + win.get_title());
    }
}


function init() {
}

async function enable() {
    logMonitorGeometries();
    listAllWindows(); // List all windows when the extension is enabled
    logAllWMClasses(); // Log WM_CLASS properties when the extension is enabled
    let sleep_for_ms = 500;
    await sleep(sleep_for_ms);
    moveWindowsToScreenAndWorkspace("crx_jmlfbgamfhbhiiimabijjiphfihdajkk", 1, 0); //webex
    await sleep(sleep_for_ms);
    makeWindowsSticky("crx_jmlfbgamfhbhiiimabijjiphfihdajkk");
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("crx_jmlfbgamfhbhiiimabijjiphfihdajkk");
    await sleep(sleep_for_ms);
    
    moveWindowsToScreenAndWorkspace("slack", 1, 0);
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("slack");
    await sleep(sleep_for_ms);
    makeWindowsSticky("slack");
    await sleep(sleep_for_ms);
    
    moveWindowsToScreenAndWorkspace("keepassxc", 1, 0);
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("keepassxc");
    await sleep(sleep_for_ms);
    makeWindowsSticky("keepassxc");
    await sleep(sleep_for_ms);

    moveWindowsToScreenAndWorkspace("Google-chrome", 1, 0); 
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("Google-chrome");
    await sleep(sleep_for_ms);
    makeWindowsSticky("Google-chrome");
    await sleep(sleep_for_ms);

    moveWindowsToScreenAndWorkspace("crx_blolepeanghapmhjfpjfbegpakcjphkb", 3, 0);  //TAIA
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("crx_blolepeanghapmhjfpjfbegpakcjphkb");
    await sleep(sleep_for_ms);
    makeWindowsSticky("crx_blolepeanghapmhjfpjfbegpakcjphkb");
    await sleep(sleep_for_ms);


    
    moveWindowsToScreenAndWorkspace("crx_dgpbecgflcafkafpebakapmjffajbdkc", 2, 0); //Jira
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("crx_dgpbecgflcafkafpebakapmjffajbdkc");
    await sleep(sleep_for_ms);
    moveWindowsToScreenAndWorkspace("thunderbird", 0, 0); 
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("thunderbird");
    await sleep(sleep_for_ms);



    moveWindowsToScreenAndWorkspace("jetbrains-idea", 2, 1); 
    await sleep(sleep_for_ms);
    makeWindowsFullscreen("jetbrains-idea");
    await sleep(sleep_for_ms);


    
    moveWindowsToScreenAndWorkspace("Wfica", 0, 2);
    await sleep(sleep_for_ms);
    moveWindowsToScreenAndWorkspace("selfservice", 1, 2); 
    await sleep(sleep_for_ms);
    moveWindowsToTopRight("selfservice"); 
    await sleep(sleep_for_ms);


    moveWindowsToScreenAndWorkspace("code - insiders", 3, 3); 
    await sleep(sleep_for_ms);
    makeWindowsSticky("code - insiders");
    await sleep(sleep_for_ms);
}

function disable() {
}