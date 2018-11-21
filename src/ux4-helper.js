#!/usr/bin/env node

//Dependencies
const Path = require('path');
const File = require('fs-extra');
const ChildProcess = require('child_process');
const FindParentDir = require("find-parent-dir");

//Constants
const params = loadCommandLineParameters();
const configDir = process.env.APPDATA + Path.sep + "UX4";
const configFile = configDir + Path.sep + "config.json";
const cacheFile = configDir + Path.sep + "cache.json";
const cwd = params.cwd ? Path.resolve(params.cwd) : process.cwd();
const appcwd = FindParentDir.sync(cwd, "app-config.json");
const semverReg = /^(\d+)\.(\d+)\.(\d+)$/;
const font = {
    bold_on: "\x1b[1m",
    /** @attribute {String} bold_on Bold text */
    reset: "\x1b[0m",
    /** @attribute {String} reset Reset log formatting */
    inverse_on: "\x1b[7m",
    /** @attribute {String} inverse_on Invert text */
    bold_off: "\x1b[22m",
    /** @attribute {String} bold_off Normal text */
    fg_black: "\x1b[30m",
    /** @attribute {String} fg_black Black text colour */
    fg_red: "\x1b[31m",
    /** @attribute {String} fg_red Red text color*/
    fg_green: "\x1b[32m",
    /** @attribute {String} fg_green Green text color */
    fg_yellow: "\x1b[33m",
    /** @attribute {String} fg_yellow Yellow text color */
    fg_blue: "\x1b[34m",
    /** @attribute {String} fg_blue Blue text color */
    fg_magenta: "\x1b[35m",
    /** @attribute {String} fg_magenta Magneta text color */
    fg_cyan: "\x1b[36m",
    /** @attribute {String} fg_cyan Red text color */
    fg_white: "\x1b[37m",
    /** @attribute {String} fg_white White text color */
    bg_red: "\x1b[41m",
    /** @attribute {String} bg_red Red background color */
    bg_green: "\x1b[42m",
    /** @attribute {String} bg_green Green background color  */
    bg_yellow: "\x1b[43m",
    /** @attribute {String} bg_yellow Yellow background color  */
    bg_blue: "\x1b[44m",
    /** @attribute {String} bg_blue Blue background color */
    bg_magenta: "\x1b[45m",
    /** @attribute {String} bg_magenta Magenta  background color*/
    bg_cyan: "\x1b[46m",
    /** @attribute {String} bg_cyan Cyan background color*/
    bg_white: "\x1b[47m",
    /** @attribute {String} bg_white White background color */
    moveback1char: "\033[1D",
    /** @attribute {String} moveback1char Move cursor back one character*/
    moveback1line: "\033[1A",
    /** @attribute {String} moveback1char Move cursor up one line*/
    cls: "\033c" /** @attribute {String} clear terminal*/
};

//Variables
var appConfig;
var config;
var cache;

//
//  UTILS
//

//Parse command line params
function loadCommandLineParameters() {
    let cmdParams = {};
    for (let i = 3; i < process.argv.length; i++) {
        let arg = process.argv[i];
        if (arg.charAt(0) !== "-") continue;
        if (arg.charAt(1) === "-") arg = arg.substr(1); //Support parameters with double hyphens

        let a = arg.split("=");

        //Map booleans over to be proper booleans and not strings
        if (a.length > 1) {
            if (a[1] === "true") a[1] = true;
            if (a[1] === "false") a[1] = false;
        }

        cmdParams[a[0].substr(1)] = (a.length > 1) ? a[1] : true;
    }
    return cmdParams;
}

//Load config
function loadConfig() {

    //Ensure folder exists
    File.ensureDirSync(configDir);

    //Check if a config file exists, if not create a new one
    if (!File.existsSync(configFile)) {
        config = { };
        File.writeFileSync(configFile, JSON.stringify(config, null, "\t"));
    } else {
        try {
            config = File.readJSONSync(configFile);
        } catch (e) { 
            logError(e);
            logError("Failed to read config from '" + configFile + "'. The file could be corrupt or the format invalid.");
            process.exit(1);
        }
    }
}

//Load cache
function loadCache() { 

    //Ensure folder exists
    File.ensureDirSync(configDir);

    //Check if a cache file exists, if not create a new one
    if (!File.existsSync(cacheFile)) {
        cache = { };
        File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));
    } else {
        try {
            cache = File.readJSONSync(cacheFile);
        } catch (e) {
            //If the file cannot be read, just reset it
            cache = { };
            File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));
        }
    }
}

//Load app-config
function loadAppConfig() {
    if (appcwd) {
        appConfig = File.readJSONSync(appcwd + Path.sep + "app-config.json");
    }
}

//Compare semver version numbers, returns 1 if a is newer, -1 if b is newer or 0 for matching versions
function compareVersions(a, b) { 

    var ap = semverReg.exec(a);
    var bp = semverReg.exec(b);

    if (!ap || !bp) return 0;
    if (!ap) return 1;
    if (!bp) return -1;

    var ret = 0;
    for (var i = 1; i < 4; i++) { 
        if (ap[i] === bp[i]) continue;
        ret = (Number(ap[i]) > Number(bp[i])) ? 1 : -1;
        break;
    }

    return ret;
}

//Get version number of current tools
function getVersion() {
    let pkg = File.readJSONSync(__dirname + "/../package.json");
    return pkg.version;
}

//Log an error message to console
function logError(error) { 
    console.log(font.fg_red + "ERROR: " + (error || "") + font.reset);
}

//Update cache
function autoUpdateCheck() { 

    //Get time of this execution to nearest day
    let currentDate = (new Date()).getTime();
    currentDate = +(currentDate - (currentDate % 86400000));
    let lastDate = Number(cache.lastUpdateCheck) || 0;

    //If more than a day has passed since last check return true, we need to check!
    if (currentDate > lastDate) { 
        cache.lastUpdateCheck = currentDate;
        File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));
        return true;
    }

    return false;  
}

//
// TASKS
//
function task_buildapp() { 

    return new Promise((resolve, reject) => {

        if (!appcwd) { 
            reject("No app-config.json found. The current path is not in a UX4 Application");
            return;
        };
    
        let p = process.argv.slice(3);
        let fork = ChildProcess.fork;
        var child = fork(appcwd + "/ux4/ux4app/build.js", p);
        child.on('exit', function () {
            resolve();
        });
    });
}
function task_createapp() {

    return new Promise(function (resolve, reject) {

        //If we are already somewhere in an existing app then use the base app path and not the cwd
        let baseDir = appcwd ? appcwd : cwd;

        if (!File.existsSync(baseDir + "/ux4")) {
            reject("No UX4 build found. Please run \"ux4 install\" then try again");
            return;
        }

        var child = ChildProcess.fork(baseDir + "/ux4/ux4app/install");
        child.on('exit', () => {
            resolve();
        });
    });
}
function task_help() { 
    function opt(key, text) {
        console.log(font.fg_yellow + key + font.reset + (" ".repeat(60 - key.length)) + text);
    }

    let t = "UX4 Tools Help @" + getVersion() + "";
    console.log(font.fg_cyan + "\n" + t);
    console.log("=".repeat(t.length) + "\n" + font.reset);

    console.log("The following commands can be executed:\n");
    opt("install", "Attempt to install the UX4 version sepcified in an existing app-config.json.");
    opt("install [-version=<version> | -v=<version>] (-standalone)", "Install a UX4 version. Optionally requesting a stand-alone build (no app features).");
    opt("config", "View tool configuration");
    opt("config [set <key> <value> | unset <key>]", "Set or unset a tool configuration");
    opt("create-app", "Create an application at the current location. Requires a UX4 app build to be present.");
    opt("build-app", "Build the application at the current location. Arguments will pass through to the app build script.");
    opt("check-update", "Check for an update of UX4 Tools.");
    opt("help", "Show this help screen.");
    opt("version, v", "Display version information.");
    console.log();
    opt("(-cwd=<path/to/directory>)", "This parameter can be used to specify a current working directory other than the current location.");

    console.log("");
}
function task_install() { 

    //Build info
    let filePath;
    let address;
    let version;
    let standalone;

    return new Promise(function (resolve, reject) {
        try {

            //If installing from local directory skip the dl part (dev tool)
            if (params.local) { 
                resolve();
                return;
            }

            //Get address
            address = config.address || null;
            if (typeof address !== "string") {
                throw ("No download address configured. This can be set using the command:\n\n" + font.fg_yellow + "ux4 config set address <address>");
            }
            if (!address.endsWith(Path.sep)) {
                address = address + Path.sep;
            }

            //Get version to dl
            version = params.version || params.v || (appConfig ? appConfig.ux4version : null) || null;
            if (typeof version !== "string") {
                throw ("No version specified");
            }
            standalone = params.standalone || false;

            //Concat full path
            filePath = address + version + Path.sep + (standalone ? "ux4" : "ux4app") + ".zip";
            if (!File.existsSync(filePath)) {
                throw ("Specified version (" + version + (standalone ? " Standalone" : " Application") + ") could not be found");
            }

            //Remove old ux4 if found
            if (appcwd && File.existsSync(appcwd + Path.sep + "ux4")) {
                console.log("Removing old build");
                File.removeSync(appcwd + Path.sep + "ux4");
            }

            console.log("Installing " + font.fg_cyan + "UX4 " + (standalone ? "Standalone" : "Application") + " version " + version + font.reset + "\n");

            //Unzip file, log progress and catch errors
            var DecompressZip = require('decompress-zip');
            var unzipper = new DecompressZip(filePath)

            unzipper.on('error', (err) => {
                throw (err.message);
            });

            unzipper.on('progress', function (fileIndex, fileCount) {
                console.log(font.moveback1line + "Extracting files " + (fileIndex + 1) + ' of ' + fileCount);
            });

            unzipper.on('extract', function () {
                console.log(font.fg_green + "Installation successful" + font.reset);
                resolve();
            });

            unzipper.extract({
                path: (appcwd && !standalone) ? appcwd : cwd
            });

        } catch (e) {
            
            reject(e || "Installation Failed");
        }
    });
}
function task_checkupdate() {

    return new Promise(function (resolve, reject) {

        const cmd = (/^win/.test(process.platform)) ? "npm.cmd" : "npm";
        let child = ChildProcess.spawn(cmd, ["show", "ux4", "version"]);
        let latestVersion;

        child.stdout.on('data', function (data) {
            latestVersion = data;
        });

        child.on('exit', () => {
            latestVersion = String(latestVersion).trim();
            if (!semverReg.test(latestVersion)) {
                console.log(latestVersion);
                reject("Failed to check for updates. NPM repository may be inaccessible or down.");
                return;
            }

            //Update cache info
            cache.latestVersionAvailable = latestVersion;
            File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));

            //Resolve when done
            resolve();
        });
    });
}
function task_config() {

    let op = process.argv[3]
    let key = process.argv[4];
    let value = process.argv[5];

    try {
        switch (op) {
            case "set": {
                Object.assign(config, { [key]: value });
                File.writeFileSync(configFile, JSON.stringify(config, null, "\t"));
                break;
            }
            case "unset": {
                delete config[key];
                File.writeFileSync(configFile, JSON.stringify(config, null, "\t"));
                break;
            }
            default: {
                console.log(JSON.stringify(config, null, 2));
                break;
            }
        }
    } catch (e) {
        logError(e);
        process.exit(1);
    }
}
function task_version() { 
    console.log(getVersion());
}

//
// ENTRY
//
(async () => {

    //Load reference files
    loadConfig();
    loadCache();
    loadAppConfig();

    //Determine and run task
    let task = (process.argv[2] || "").toLowerCase();
    switch (task) {
        case "install":

            try {
                await task_install();
            } catch (e) {
                logError(e);
                process.exit(1);
            }

            //If an app build we need to do some more steps
            if (!params.standalone) { 

                //If existing app run app install(update) script else ask if an application should be created
                if (appConfig) {
                    try {
                        await task_createapp();
                    } catch (e) {
                        logError(e);
                        process.exit(1);
                    }
                } else {

                    let Inquirer = require("inquirer");
                    let answer = await Inquirer.prompt({
                        name: 'createapp',
                        type: 'confirm',
                        message: '\nDo you want to create a new UX4 application now?'
                    });

                    //If yes, create a new app using the app install script
                    if (answer.createapp) {
                        try {
                            await task_createapp();
                        } catch (e) {
                            logError(e);
                            process.exit(1);
                        }
                    }
                }
            }
            break;
        case "v":
        case "version":
            task_version();
            break;
        case "check-update":
            try {
                console.log("Checking for updates.");
                await task_checkupdate();
                if (compareVersions(cache.latestVersionAvailable, getVersion()) < 1)
                    console.log(font.fg_green + "Up to date." + font.reset);
            } catch (e) { 
                logError(e);
                process.exit(1);
            }
            break;
        case "create-app":
            if (appConfig) {
                logError("A UX4 application already exists at this location.");
                process.exit(1);
            } else {
                try {
                    await task_createapp();
                } catch (e) {
                    logError(e);
                    process.exit(1);
                }
            }
            break;
        case "build-app":
            try {
                await task_buildapp();
            } catch (e) {
                logError(e);
                process.exit(1);
            }
            break;
        case "config":
            task_config();
            break;
        case "help":
            task_help();
            break;
        default:
            logError("command '" + process.argv[2] + "' not recognised.");
            task_help();
            break;
    }

    //Log update prompts after certain tasks
    var promptTasks = ["check-update", "create-app", "build-app", "install"];
    if (promptTasks.indexOf(task) > -1) {

        //Determine if a new version should be checked for
        var check = autoUpdateCheck();
        if (check && task !== "checkupdate") { 
            try {
                await task_checkupdate();
            } catch (e) { 
                logError(e);
                process.exit(1);
            }
        }

        //If a new version of the tool is available log this to user
        let current = getVersion();
        let latest = cache.latestVersionAvailable;
        if (latest && compareVersions(latest, current) === 1) {
            console.log(font.fg_cyan + "\n========================================" + font.reset);
            console.log("A new version of UX4 Tools is available." + font.reset + "\n\nCurrent: " + font.fg_red + current + font.reset + "\n Latest: " + latest);
            console.log("\nRun " + font.fg_yellow + "npm update -g ux4" + font.reset + " to install.");
            console.log(font.fg_cyan + "========================================" + font.reset);
        };
    }

})();
