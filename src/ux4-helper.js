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
let appcwd = FindParentDir.sync(cwd, "app-config.json"); //Cannot be const as we need to modify this after creating a new app
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

//Download build from path
function downloadBuild(address, version, standalone) { 

    return new Promise(async (resolve, reject) => {

        try {
            let buffer = await getBuildBuffer(address, version, standalone);

            var Unzip = require("yauzl");
            Unzip.fromBuffer(buffer, { lazyEntries: true, autoClose: true }, function (err, zipfile) {
    
                if (err) {
                    reject(err);
                    return;
                }
    
                let fileIndex = 0;
                let extractPath = (appcwd && !standalone) ? appcwd : cwd; 
                console.log("Extracting files");
    
                zipfile.on("entry", function (entry) {
    
                    console.log(font.moveback1line + "Extracting file " + (++fileIndex) + ' of ' + zipfile.entryCount);
    
                    if (/\/$/.test(entry.fileName)) {
                        
                        //For directories ensure the dir exists locally ready for files then read next entry
                        File.ensureDirSync(extractPath + Path.sep + entry.fileName);
                        zipfile.readEntry();

                    } else {
    
                        //For files read and write the file to the local system cwd
                        zipfile.openReadStream(entry, function (err, readStream) {
                            
                            if (err) {
                                reject(err);
                                return;
                            }
    
                            readStream.on("end", function () {
                                zipfile.readEntry();
                            });
    
                            //Write file to local dir
                            try {
                                readStream.pipe(File.createWriteStream(extractPath + Path.sep + entry.fileName));
                            } catch (e) { 
                                reject(e);
                                return;
                            }
                        });
                    }
                });
    
                zipfile.once("end", function () {
                    console.log(font.moveback1line + 'Extracted ' + fileIndex + ' of ' + zipfile.entryCount + ' files');
                    resolve();
                });
    
                zipfile.on("error", function () {
                    reject(e);
                });
                
                zipfile.readEntry();
            });

        } catch (e) {
            reject(e);
            return;
        }
        
    });
}

//Get build via ftp
function getFTPBuild(address, version, standalone) { 

    return new Promise(async (resolve, reject) => { 

        try {

            //Create new ftp client
            let FTP = require("basic-ftp");
            let client = new FTP.Client();

            //Get User/Pass
            let username = config.user;
            let password = config.password;
            if (!password) { 
                let Inquirer = require("inquirer");
                let answers = await Inquirer.prompt([
                    {
                        name: 'password',
                        type: 'password',
                        message: 'Password',
                        when: !password
                    }
                ]);
                password = answers.password || password;
            }

            //Access ftp server
            await client.access({
                host: address,
                user: username,
                password: password,
                secure: true,
                secureOptions: {
                    rejectUnauthorized: false //Needed for self signed cert on our ftp server
                }
            });

            //Ensure build folder for this version exists and move into it
            try {
                await client.cd("builds/" + version + "/");
            } catch (e) { 
                throw { message: "Specified version (" + version + (standalone ? " Standalone" : " Application") + ") could not be found" };
            }

            //Create a new write stream and buffer to read the zip down to
            let buffers = [];
            let Stream = require("stream");
            let writeStream = new Stream.Writable({
                write: function(chunk, encoding, next) {
                    buffers.push(chunk);
                    next();
                }
            });
            
            //Read the appropriate zip file then close client connection
            await client.download(writeStream, (standalone ? "ux4" : "ux4app") + ".zip");
            await client.close();

            //Pass back the zip buffer
            resolve(Buffer.concat(buffers));

        } catch (e) { 
            reject("FTP - " + (e.error ? (e.error.message || JSON.stringify(e.error) || e.error.code) : e.message) || "error(s) occured");
        }

    });
}

//Get build as stream
function getBuildBuffer(address, version, standalone) { 

    return new Promise(async (resolve, reject) => { 

        try {

            if (params.fromDir || config.fromDir) {

                //Make sure to include trailing seperator
                if (!address.endsWith(Path.sep)) {
                    address = address + Path.sep;
                }

                //Concat full path
                filePath = address + version + Path.sep + (standalone ? "ux4" : "ux4app") + ".zip";
                if (!File.existsSync(filePath)) {
                    reject("Specified version (" + version + (standalone ? " Standalone" : " Application") + ") could not be found at location:\n" + address);
                    return;
                }

                let readStream = File.createReadStream(filePath);
                let buffers = [];
                readStream.on('data', (chunk) => { buffers.push(chunk); });
                readStream.on('end', () => { resolve(Buffer.concat(buffers)); });
                
            } else { 

                let buffer = await getFTPBuild(address, version, standalone);
                resolve(buffer);

            }

        } catch (e) { 
            reject(e);
        }
    }); 
}

//Ping the UX4 usage database
function pingDatabase() { 
    let fetch = require("node-fetch");
    let [domain, port] = (config.database || "").replace(/^(http:\/\/|https:\/\/)?/, "").split(":");
    return fetch("http://" + (domain || "") + ":" + (port || 9090) + "/AppData/Data?online", {
        method: "GET",
        mode: "no-cors"
    });
}

//Register UX4 install
function registerInstall() {

    if (!appConfig) { 
        return new Promise().reject();
    }

    let fetch = require("node-fetch");
    let [domain, port] = (config.database || "").replace(/^(http:\/\/|https:\/\/)?/, "").split(":");
    return fetch("http://" + (domain || "") + ":" + (port || 9090) + "/AppData/Data", {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
            userID: config.user || "",
            ux4Version: appConfig.ux4version, 
            appVersion: appConfig.version,
            appName: appConfig.name,
            appDisplayName: appConfig.displayName
        })
    });
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
        var child = fork(appcwd + "/ux4/build.js", p);
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

        var child = ChildProcess.fork(baseDir + "/ux4/install");
        child.on('exit', async () => {

            //Attempt to register this install against our DB
            try {

                //If we have just created a new app we first need to load the app config
                if (!appcwd) { 
                    appcwd = FindParentDir.sync(cwd, "app-config.json");
                    if (!appcwd) throw ("");
                }

                //Re-read the app config to get latest info!
                loadAppConfig();

                //Register the install
                await registerInstall();

            } catch (e) {
                logError("Failed to register installation");
            }

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
    opt("config", "View or modify config values.");
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
    let address;
    let version;
    let standalone;

    return new Promise(async function (resolve, reject) {
        try {

            //If installing from local directory skip the dl part (dev tool)
            if (params.local) { 
                resolve();
                return;
            }

            //Get address
            address = params.address || config.address || null;
            if (typeof address !== "string") {
                throw ("No download address configured. This can be set using the command:\n\n" + font.fg_yellow + "ux4 config set address <address>");
            }
            
            //Get version to dl
            version = params.version || params.v || (appConfig ? appConfig.ux4version : null) || null;
            if (typeof version !== "string") {
                throw ("No version specified");
            }
            standalone = params.standalone || false;

            //Remove old ux4 if found
            if (appcwd && File.existsSync(appcwd + Path.sep + "ux4")) {
                console.log("Removing old build");
                File.removeSync(appcwd + Path.sep + "ux4");
            }

            //Download and install build
            console.log("Retrieving " + font.fg_cyan + "UX4 " + (standalone ? "Standalone" : "Application") + " version " + version + font.reset);
            try {
                await downloadBuild(address, version, standalone);
                resolve();
            } catch (e) { 
                reject(e);
            }

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
                if (invalid) logError("Invalid command");

                function opt(key) {
                    console.log(font.fg_yellow + key + font.reset);
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

    //List of tasks which require proper initialisation before use
    let mainTasks = ["create-app", "build-app", "install"];

    //Determine task
    let task = (process.argv[2] || "").toLowerCase();

    //If running a main task ensure certain config values are set
    if (mainTasks.indexOf(task) > -1) {

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

            console.log(font.fg_green + "Values updated.\n" + font.reset + "These can be modified using:\n\n" + font.fg_yellow + "ux4 config" + font.reset + "\n\nPlease re-run the desired task." + font.reset);
            process.exit(1);
        }

        //We don't need to check the database for a build-app task
        if (task !== "build-app") {

            try {
                await pingDatabase();
            } catch (e) {
                logError("Failed to connect to registration database. \nPlease check the database address in your config and/or your internet connection.");

                if (!params.noreg)
                    process.exit(1);
            }
        }
    }

    //Run task
    switch (task) {

        //Main tasks
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
                        message: 'Do you want to create a new UX4 application now?'
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
        
        //Util Tasks
        case "v":
        case "version":
            task_version();
            break;
        case "config":
            task_config();
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
        case "help":
            task_help();
            break;
        default:
            logError("command '" + process.argv[2] + "' not recognised.");
            task_help();
            break;
    }

    //Log update prompts after certain tasks
    if (mainTasks.indexOf(task) > -1 || task === "check-update") {

        //Determine if a new version should be checked for
        var check = autoUpdateCheck();
        if (check && task !== "check-update") { 
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
