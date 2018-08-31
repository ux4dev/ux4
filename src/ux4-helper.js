#!/usr/bin/env node

const Path = require('path');
const Glob = require('glob-all');
const fs = require('node-fs-extra');
const cp = require('child_process');
const cmd = process.argv[2];
var settings;
const appTitle = "UX4 Tools";
const homedir = require("homedir");
const settingsFile = homedir() + Path.sep + "ux4.json";
const cwd = process.cwd();
var checkForUpdates = false;


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


function loadCommandLineParameters() {
    let cmdParams = {};

    for (let i = 3; i < process.argv.length; i++) {
        let arg = process.argv[i];
        if (arg.charAt(0) !== "-") continue;

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


function loadSettings() {

    //Check if a settings file exists, if not create a new one
    if (!fs.existsSync(settingsFile)) {
        let pkg = fs.readJSONSync(__dirname + "/../package.json");
        console.log("Created user UX4 settings file at " + settingsFile);
        fs.writeJsonSync(settingsFile, pkg.defaultSettings);
        settings = pkg.defaultSettings;
    } else {
        settings = fs.readJSONSync(settingsFile);
    }

    //If the setting repository doesn't have a trailing slash then add one and update the file
    if (!settings.repository.path.endsWith(Path.sep)) {
        settings.repository.path = settings.repository.path + Path.sep;
        fs.writeJsonSync(settingsFile, settings);
    }

    //Get the current date (without time)
    let currentDate = (new Date()).getTime();
    currentDate = +(currentDate - (currentDate % 86400000));

    settings.lastUpdateCheck = settings.lastUpdateCheck || 0;

    //If the settings last update check is less than today then update the file and mark a flag to say an update check is needed
    if (currentDate > settings.lastUpdateCheck) {
        settings.lastUpdateCheck = currentDate;
        fs.writeJsonSync(settingsFile, settings);
        checkForUpdates = true;

    }

    if (fs.existsSync(cwd + "/app-config.json")) {

        let appconfig = fs.readJSONSync(cwd + "/app-config.json");

        settings.version = appconfig.ux4.version;
        if (appconfig.ux4.dev != null) settings.dev = appconfig.ux4.dev;
        if (appconfig.ux4.repository && appconfig.ux4.repository.path) settings.repository.path = appconfig.ux4.repository.path;
        settings.location = "app-config.json";
        settings.newInstall = false;
    } else {
        settings.location = settingsFile;
        settings.newInstall = true;
    }

    //if a version has been specified on the command line (--version=xxx) use that 
    if (params.version) {
        settings.version = params.version;
    }

    if (params.dev) {
        settings.dev = true;
    }
}

function installUX4() {

    return new Promise(function (resolve, reject) {
        let filename = "";
        try {

            if (!settings.version) {
                settings.version = "latest";
            }

            console.log("Using settings from " + settings.location + font.fg_yellow + ": UX4 version " + settings.version + ((settings.dev) ? " [DEVELOPER EDITION]" : "") + font.reset);

            if (params.standalone) console.log("Installing Core UX4 controls only");

            let basename = (params.standalone) ? "ux4" : "ux4app";

            filename = settings.repository.path + settings.version + Path.sep + basename + (settings.dev ? "_dev" : "") + ".zip";

            if (!fs.existsSync(settings.repository.path + settings.version)) {
                console.log(font.fg_red + "ERROR : No download exists for UX4 version " + settings.version + font.reset);
                reject();
                return;
            }

            console.log("Installing UX4 from " + font.fg_yellow + filename + "\n" + font.reset);

            var DecompressZip = require('decompress-zip');
            var unzipper = new DecompressZip(filename)

            unzipper.on('error', function (err) {
                console.log(err.message);
                reject(err);
            });

            unzipper.on('extract', function (log) {
                console.log(font.fg_green + 'UX4 has completed installing\n' + font.reset);
                resolve();
            });

            unzipper.on('progress', function (fileIndex, fileCount) {
                console.log(font.moveback1line + "Extracted UX4 file " + (fileIndex + 1) + ' of ' + fileCount);
            });

            unzipper.extract({
                path: cwd
            });
        } catch (e) {
            console.error("Cannot install UX4 from " + filename + " to " + cwd);
        }
    });
}

function runUX4InstallCommand() {


    return new Promise(function (resolve, reject) {
        if (params.standalone) {
            resolve();
            return;
        }

        var child = cp.fork(cwd + "/ux4/ux4app/install");
        child.on('exit', () => {
            console.log(font.fg_green + "\nCompleted package.json and NPM install\n" + font.reset);
            resolve();
        });
    });
}

function checkIfThisToolNeedsUpdating() {
    let latestVersion = "";

    return new Promise(function (resolve, reject) {
        const cmd = (/^win/.test(process.platform)) ? "npm.cmd" : "npm";
        const compareVersions = require('compare-versions');
        var child = cp.spawn(cmd, ["show", "ux4", "version"]);

        child.stdout.on('data', function (data) {
            latestVersion += data;
        });

        child.on('exit', () => {
            latestVersion = latestVersion.trim();
            let current = getVersion();
            let updateRequired = compareVersions(latestVersion, current) == 1;
            if (updateRequired) {
                console.log(font.fg_green + "\nA new version of UX4 Tools is available. Current version " + current + ", new version " + latestVersion);
                console.log("Please run\n\n" + font.fg_yellow + "npm update -g ux4\n" + font.reset);
            }

            resolve(updateRequired);
        });
    });
}

function shouldICreateApp() {
    return new Promise(function (resolve, reject) {

        if (params.standalone) {
            resolve();
            return;
        }

        let Inquirer = require("inquirer");

        Inquirer.prompt({
            name: 'createapp',
            type: 'confirm',
            message: 'Do you want to create a new UX4 application now?'
        }).then((answer) => {
            if (answer.createapp) {
                createApp();
            }
        });
    });
}



function help() {

    function opt(key, text) {
        console.log(font.fg_yellow + key + font.reset + (" ".repeat(35 - key.length)) + text);
    }

    let t = appTitle + " v" + getVersion() + " Help";
    console.log(font.fg_cyan + "\n" + t);
    console.log("=".repeat(t.length) + "\n" + font.reset);
    console.log("The following options can be specified\n");
    opt("install", "Install UX4 into your project (UX4 version pulled from the app-config.json)");
    opt("install -version=xxx", "Install a specific UX4 version.");
    opt("install -standalone (-version=xxx)", "Install a core UX4 which does not contain the app framework.");
    opt("createapp", "Create a UX4 application in the current folder");
    opt("check", "Check for a new version of UX4 Tools");
    opt("help", "Show this help screen");
    opt("version, v", "Display version information");
    console.log("");
}

function getVersion() {
    let pkg = fs.readJSONSync(__dirname + "/../package.json");
    return pkg.version;
}

function createApp() {
    if (!fs.existsSync(cwd + "/ux4")) {
        console.log("This folder does not contain a valid UX4. Please run " + font.fg_cyan + "ux4 install" + font.reset + " first then try again");
        process.exit(1);
    }
    if (fs.existsSync(cwd + "/app-config.json")) {
        console.log(font.fg_yellow + "This folder already contains a UX4 application" + font.reset);
        process.exit(1);
    }

    runUX4InstallCommand();
}


const params = loadCommandLineParameters();
switch ((cmd || "").toLowerCase()) {
    case "install":
        let t = "Install UX4";
        console.log(font.fg_cyan + "\n" + t);
        console.log("=".repeat(t.length) + "\n" + font.reset);
        loadSettings();
        installUX4().then(() => {
            if (!settings.newInstall) {
                runUX4InstallCommand().then(() => {
                    if (checkForUpdates) checkIfThisToolNeedsUpdating();
                });
            } else {
                shouldICreateApp();
            }
        }).catch(() => {

        });
        break;
    case "v":
    case "version":
        console.log(font.fg_cyan + "\n" + appTitle + "\nVersion " + getVersion() + "\n" + font.reset);
        break;
    case "check":
        loadSettings();
        checkIfThisToolNeedsUpdating().then((updateRequired) => {
            if (!updateRequired) console.log("No update required");
        });
        break;
    case "createapp":
        createApp();
        break;
    case "help":
    default:
        help();

}