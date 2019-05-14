const File = require('fs-extra');
const Utils = require("./utils.js");
const Path = require('path');
const ChildProcess = require('child_process');

const configDir = process.env.APPDATA + Path.sep + "UX4";
const configFile = configDir + Path.sep + "config.json";
const params = loadCommandLineParameters();
const config = loadUX4ToolConfig();
const cwd = params.cwd ? Path.resolve(params.cwd) : process.cwd();
const cacheFile = configDir + Path.sep + "cache.json";
var cache;

//Load config
function loadUX4ToolConfig() {
    let config;

    //Ensure folder exists
    File.ensureDirSync(configDir);

    //Check if a config file exists, if not create a new one
    if (!File.existsSync(configFile)) {
        config = {};
        File.writeFileSync(configFile, JSON.stringify(config, null, "\t"));
        return config;
    } else {
        try {
            return File.readJSONSync(configFile);
        } catch (e) {
            logError(e);
            logError("Failed to read config from '" + configFile + "'. The file could be corrupt or the format invalid.");
            process.exit(1);
        }
    }
}

function loadCommandLineParameters() {
    let cmdParams = {};

    for (let i = 2; i < process.argv.length; i++) {
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


function filenameToType(filename) {
    switch (filename) {
        case "ux4": return "Standalone";
        case "ux4app": return "Application";
        case "ux4automation": return "Automation"
    }
}


function registerInstall(installData) {
    let fetch = require("node-fetch");
    let [domain, port] = (config.database || "").replace(/^(http:\/\/|https:\/\/)?/, "").split(":");
    return fetch("http://" + (domain || "") + ":" + (port || 9090) + "/AppData/Data", {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(installData)
    });
}

function getAddress() {
    return params.address || config.address || null;
}


function configOptions() {

    let op = process.argv[3]
    let key = process.argv[4];
    let value = process.argv[5];
    let invalid = false;

    try {
        switch (op) {
            case "set": {
                if (!invalid && key !== undefined && value !== undefined) {
                    Object.assign(config, { [key]: value });
                    File.writeFileSync(configFile, JSON.stringify(config, null, "\t"));
                    break;
                } else {
                    invalid = true;
                }
            }
            case "get":
                if (!invalid) {
                    console.log(JSON.stringify(key ? config[key] : config, null, 2));
                    break;
                } else {
                    invalid = true;
                }
            case "list": {
                if (!invalid) {
                    console.log(JSON.stringify(config, null, 2));
                    break;
                } else {
                    invalid = true;
                }
            }
            case "delete": {
                if (!invalid && key !== undefined) {
                    delete config[key];
                    File.writeFileSync(configFile, JSON.stringify(config, null, "\t"));
                    break;
                } else {
                    invalid = true;
                }
            }
            default: {
                if (invalid) Utils.logError("Invalid command");

                function opt(key) {
                    console.log(Utils.font.fg_yellow + key + Utils.font.reset);
                }

                console.log("\nUsage:");
                opt("ux4 config set <key> <value>");
                opt("ux4 config get [<key>]");
                opt("ux4 config delete <key>");
                opt("ux4 config list");
                break;
            }
        }
    } catch (e) {
        Utils.fatalError(e);
    }
}


async function checkForUpdate() {

    return new Promise(function (resolve, reject) {

        const cmd = (/^win/.test(process.platform)) ? "npm.cmd" : "npm";
        let child = ChildProcess.spawn(cmd, ["show", "ux4", "version"]);
        let latestVersion;

        child.stdout.on('data', function (data) {
            latestVersion = data;
        });

        child.on('exit', () => {
            latestVersion = String(latestVersion).trim();
            if (!Utils.semverReg.test(latestVersion)) {
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

//Get version number of current tools
function getVersion() {
    let pkg = File.readJSONSync(__dirname + "/../package.json");
    return pkg.version;
}

//Ping the UX4 usage database
function pingDatabase() {
    try {
        const fetch = require("node-fetch");
        const [domain, port] = (config.database || "").replace(/^(http:\/\/|https:\/\/)?/, "").split(":");
        return fetch("http://" + (domain || "") + ":" + (port || 9090) + "/AppData/Data?online", {
            method: "GET",
            mode: "no-cors"
        });

    } catch (e) {
        Utils.logError("Failed to connect to registration database. \nPlease check the database address in your config and/or your internet connection.");

        if (!params.noreg)
            Utils.fatalError();
    }
}

//Load cache
function loadCache() {

    //Ensure folder exists
    File.ensureDirSync(configDir);

    //Check if a cache file exists, if not create a new one
    if (!File.existsSync(cacheFile)) {
        cache = {};
        File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));
    } else {
        try {
            cache = File.readJSONSync(cacheFile);
        } catch (e) {
            //If the file cannot be read, just reset it
            cache = {};
            File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));
        }
    }
}


//Compare semver version numbers, returns 1 if a is newer, -1 if b is newer or 0 for matching versions
function compareVersions(a, b) {

    var ap = Utils.semverReg.exec(a);
    var bp = Utils.semverReg.exec(b);

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

function isUpdateToDate() {
    return (compareVersions(cache.latestVersionAvailable, getVersion()) < 1)
}

//Load cache
function loadCache() {

    //Ensure folder exists
    File.ensureDirSync(configDir);

    //Check if a cache file exists, if not create a new one
    if (!File.existsSync(cacheFile)) {
        cache = {};
        File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));
    } else {
        try {
            cache = File.readJSONSync(cacheFile);
        } catch (e) {
            //If the file cannot be read, just reset it
            cache = {};
            File.writeFileSync(cacheFile, JSON.stringify(cache, null, "\t"));
        }
    }
}


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


async function promptForMissingConfigValues() {
    if (!config.user || !config.address || !config.database) {

        console.log("Some config values are required to continue...");
        let Inquirer = require("inquirer");
        let answers = await Inquirer.prompt([
            {
                name: 'user',
                type: 'input',
                message: 'Username',
                when: !config.user
            },
            {
                name: 'address',
                type: 'input',
                message: 'Address (to download builds from)',
                when: !config.address
            },
            {
                name: 'database',
                type: 'input',
                message: 'Database Address (to register apps with)',
                when: !config.database
            }
        ]);
        if (answers.user) config.user = answers.user;
        if (answers.address) config.address = answers.address;
        if (answers.database) config.database = answers.database;
        File.writeFileSync(configFile, JSON.stringify(config, null, "\t"));

        console.log(Utils.font.fg_green + "Values updated.\n" + Utils.font.reset + "These can be modified using:\n\n" + Utils.font.fg_yellow + "ux4 config" + Utils.font.reset + "\n\nPlease re-run the desired task." + Utils.font.reset);
        process.exit(0);
    }
}


async function isUpdateAvailable(task) {
    try {
        //Determine if a new version should be checked for
        const check = autoUpdateCheck();

        if (check && task !== "check-update") {
            await checkForUpdate();
        }

        //If a new version of the tool is available log this to user
        const current = getVersion();
        if (cache.latestVersionAvailable && compareVersions(cache.latestVersionAvailable, current) === 1) {
            console.log(Utils.font.fg_cyan + "\n========================================" + Utils.font.reset);
            console.log("A new version of UX4 Tools is available." + Utils.font.reset + "\n\nCurrent: " + Utils.font.fg_red + current + Utils.font.reset + "\n Latest: " + cache.latestVersionAvailable);
            console.log("\nRun " + Utils.font.fg_yellow + "npm update -g ux4" + Utils.font.reset + " to install.");
            console.log(Utils.font.fg_cyan + "========================================" + Utils.font.reset);
        };
    } catch (e) {
        Utils.fatalError(e);
    }
}

module.exports = {
   
    filenameToType: filenameToType,
    params: params,
    configDir: configDir,
    config: config,
    configOptions: configOptions,
    cwd: cwd,
    getAddress: getAddress,
    registerInstall: registerInstall,
    getVersion: getVersion,
    checkForUpdate: checkForUpdate,
    pingDatabase: pingDatabase,
    loadCache: loadCache,
    promptForMissingConfigValues: promptForMissingConfigValues,
    isUpdateToDate: isUpdateToDate,
    isUpdateAvailable: isUpdateAvailable
}