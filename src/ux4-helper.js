#!/usr/bin/env node

const Path = require('path');
const Glob = require('glob-all');
const fs = require('node-fs-extra');
const cmd = process.argv[2];



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
    let settings;

    let pkg = fs.readJSONSync(__dirname + "/../package.json");

    let settingsFile = homedir() + Path.sep + "ux4.json";

    if (!fs.existsSync(settingsFile)) {
        console.log("Created user UX4 settings file at " + settingsFile);
        fs.writeJsonSync(settingsFile, pkg.defaultSettings);
        settings = pkg.defaultSettings;
    }
    else {
        settings = fs.readJSONSync(settingsFile);
    }

    if (!settings.repository.path.endsWith(Path.sep)) settings.repository.path = settings.repository.path + Path.sep;

    if (fs.existsSync(cwd + "/app-config.json")) {
        
        let appconfig = fs.readJSONSync(cwd + "/app-config.json");
        
        settings.version = appconfig.ux4.version;
        if (appconfig.ux4.dev != null) settings.dev = appconfig.ux4.dev;
        if (appconfig.ux4.repository && appconfig.ux4.repository.path) settings.repository.path = appconfig.ux4.repository.path;
        console.log("Using settings from app-config.json : UX4 version "+settings.version+((appconfig.ux4.dev) ? " [DEVELOPER EDITION]" : ""));
    }
    else {
        console.log("Using settings from "+settingsFile+" : UX4 version "+settings.version+((settings.dev) ? " [DEVELOPER EDITION]" : ""));
    }

    return settings;
}

function installUX4() {
    let filename = ""
    try {
        filename = settings.repository.path + settings.version + Path.sep + "ux4app" + (settings.dev ? "_dev" : "") + ".zip";
        
        console.log("Installing UX4 from " + filename+"\n");

        var DecompressZip = require('decompress-zip');
        var unzipper = new DecompressZip(filename)

        unzipper.on('error', function (err) {
            console.log(err.message);
            
        });

        unzipper.on('extract', function (log) {
            console.log('UX4 has completed installing\n');
        });

        unzipper.on('progress', function (fileIndex, fileCount) {    
            
            
            console.log("\033[1AExtracted UX4 file " + (fileIndex + 1) + ' of ' + fileCount);
        });

        unzipper.extract({
            path: cwd
        });
    }
    catch (e) {
        console.error("Cannot install UX4 from " + filename + " to " + cwd);
    }
}


const params = loadCommandLineParameters();
const cwd = process.cwd();
const homedir = require("homedir");
const settings = loadSettings();


switch (cmd) {
    case "install": installUX4();
        break;


}
