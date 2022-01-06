const File = require('fs-extra');
const Path = require('path');
const FindParentDir = require("find-parent-dir");
const UX4Tool = require("./ux4-tool.js");
const Utils = require("./utils.js");
const ChildProcess = require('child_process');

var appcwd = FindParentDir.sync(UX4Tool.cwd, "app-config.json") || null //Cannot be const as we need to modify this after creating a new app
var appConfig = (appcwd) ? File.readJSONSync(appcwd + Path.sep + "app-config.json") : null;


function createApplication() {

    return new Promise(function (resolve, reject) {

        //If we are already somewhere in an existing app then use the base app path and not the UX4Tool.cwd
        let baseDir = appcwd ? appcwd : UX4Tool.cwd;

        if (!File.existsSync(baseDir + "/ux4")) {
            reject("No UX4 build found. Please run \"ux4 install\" then try again");
            return;
        }

        var child = ChildProcess.fork(baseDir + "/ux4/install");
        child.on('exit', async () => {

            //Attempt to register this install against our DB
            try {
                //If we have just created a new app we first need to load the app UX4Tool.config
                if (!appcwd || !appConfig) {
                    updateAppCwd(FindParentDir.sync(UX4Tool.cwd, "app-config.json"));
                    if (!appcwd) throw ("");
                }

            } catch (e) {
                Utils.logError("Failed to register installation");
            }

            resolve();
        });
    });
}

function buildApp() {
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


function updateAppCwd(a) {
    appcwd = a + Path.sep;
    appConfig = File.readJSONSync(appcwd + "app-config.json");
}


function installUX4() {

    //Build info
    let address;
    let version;
    let standalone;

    return new Promise(async function (resolve, reject) {
        try {

            //If installing from local directory skip the dl part (dev tool)
            if (UX4Tool.params.local) {
                resolve();
                return;
            }

            //Get address
            address = UX4Tool.getAddress();
            if (typeof address !== "string") {
                throw ("No download address configured. This can be set using the command:\n\n" + Utils.font.fg_yellow + "ux4 config set address <address>");
            }

            //Get version to dl
            version = getUX4Version();
            if (typeof version !== "string") {
                throw ("No version specified. To download the latest release of UX4 use -version=latest");
            }
            standalone = UX4Tool.params.standalone || false;

            //Remove old ux4 if found
            if (appcwd && File.existsSync(appcwd + Path.sep + "ux4")) {
                console.log("Removing old build");
                File.removeSync(appcwd + Path.sep + "ux4");
            }
            let filename = standalone ? "ux4" : "ux4app";
            //Download and install build
            console.log("Retrieving " + Utils.font.fg_cyan + "UX4 " + UX4Tool.filenameToType(filename) + " version " + version + Utils.font.reset);
            try {
                const FTP = require("./ux4-ftp");
                await FTP.downloadBuild(address, version, filename, (standalone ? UX4Tool.cwd : (appcwd || UX4Tool.cwd)));
                resolve();
            } catch (e) {
                reject(e);
            }

        } catch (e) {

            reject(e || "Installation Failed");
        }
    });
}

function getUX4Version () {
    return UX4Tool.params.version || UX4Tool.params.v || (appConfig ? appConfig.ux4version : null) || null;
}

module.exports = {
    getUX4Version: getUX4Version,
    createApplication: createApplication,
    getAppConfig: () => {
        return appConfig;
    },
    getAppcwd: () => {
        return appcwd;
    },

    installUX4: installUX4,
    buildApp: buildApp
}