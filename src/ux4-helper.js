#!/usr/bin/env node

const Path = require('path');
const Glob = require('glob-all');
const fs = require('node-fs-extra');
const cp = require('child_process');
const cmd = process.argv[2];
var settings;
const appTitle = "UX4 Tools";

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

    let pkg = fs.readJSONSync(__dirname + "/../package.json");

    let settingsFile = homedir() + Path.sep + "ux4.json";

    if (!fs.existsSync(settingsFile)) {
        console.log("Created user UX4 settings file at " + settingsFile);
        fs.writeJsonSync(settingsFile, pkg.defaultSettings);
        settings = pkg.defaultSettings;
    } else {
        settings = fs.readJSONSync(settingsFile);
    }

    if (!settings.repository.path.endsWith(Path.sep)) settings.repository.path = settings.repository.path + Path.sep;

    if (fs.existsSync(cwd + "/app-config.json")) {

        let appconfig = fs.readJSONSync(cwd + "/app-config.json");

        settings.version = appconfig.ux4.version;
        if (appconfig.ux4.dev != null) settings.dev = appconfig.ux4.dev;
        if (appconfig.ux4.repository && appconfig.ux4.repository.path) settings.repository.path = appconfig.ux4.repository.path;
        console.log("Using settings from app-config.json : " + font.fg_yellow + "UX4 version " + settings.version + ((appconfig.ux4.dev) ? " [DEVELOPER EDITION]" : "") + font.reset);
    } else {
        console.log("Using settings from " + settingsFile + font.fg_yellow + " : UX4 version " + settings.version + ((settings.dev) ? " [DEVELOPER EDITION]" : "") + font.reset);
    }
}

function installUX4() {

    return new Promise(function (resolve, reject) {
        let filename = ""
        try {
            filename = settings.repository.path + settings.version + Path.sep + "ux4app" + (settings.dev ? "_dev" : "") + ".zip";

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
        var child = cp.fork(cwd + "/ux4/ux4app/install");
        child.on('exit', () => {
            console.log(font.fg_green + "\nCompleted package.json and NPM install\n" + font.reset);
            resolve();
        });
    });
}

function help() {

    function opt(key, text) {
        console.log(font.fg_yellow + key + font.reset + (" ".repeat(20 - key.length)) + text);
    }

    let t = appTitle + " v" + getVersion() + " Help";
    console.log(font.fg_cyan + "\n" + t);
    console.log("=".repeat(t.length) + "\n" + font.reset);
    console.log("The following options can be specified\n");
    opt("help", "Show this help screen");
    opt("version, v", "Display version information");
    opt("install", "Install UX4 into your project");
    opt("updatepackage", "Update the project package.json with latest node modules from UX4")
    console.log("");
}

function getVersion() {
    let pkg = fs.readJSONSync(__dirname + "/../package.json");
    return pkg.version;
}


const params = loadCommandLineParameters();
const cwd = process.cwd();
const homedir = require("homedir");

switch ((cmd || "").toLowerCase()) {
    case "install":
        let t = "Install UX4";
        console.log(font.fg_cyan + "\n" + t);
        console.log("=".repeat(t.length) + "\n" + font.reset);
        loadSettings();
        installUX4().then(() => {
            runUX4InstallCommand();
        });
        break;
    case "updatepackage":
        runUX4InstallCommand();
        break;
    case "v":
    case "version":
        console.log(font.fg_cyan + "\n" + appTitle + "\nVersion " + getVersion() + "\n" + font.reset);
        break;
    case "help":
    default:
        help();

}