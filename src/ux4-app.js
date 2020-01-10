const File = require('fs-extra');
const Path = require('path');
const FindParentDir = require("find-parent-dir");
const UX4Tool = require("./ux4-tool.js");
const Utils = require("./utils.js");
const ChildProcess = require('child_process');

var appcwd = FindParentDir.sync(UX4Tool.cwd, "app-config.json") || null //Cannot be const as we need to modify this after creating a new app
var appConfig = (appcwd) ? File.readJSONSync(appcwd + Path.sep + "app-config.json") : null;


async function createApplication(version) {

    return new Promise(async (resolve, reject)=> {

        //If we are already somewhere in an existing app then use the base app path and not the UX4Tool.cwd
        let baseDir = appcwd ? appcwd : UX4Tool.cwd;
        const version = await getUX4Version();

        const child = ChildProcess.fork(UX4Tool.downloadDir + version + "/ux4/install");

        child.on('exit', async () => {

            //Attempt to register this install against our DB
            try {
                //If we have just created a new app we first need to load the app UX4Tool.config
                if (!appcwd || !appConfig) {
                    updateAppCwd(FindParentDir.sync(UX4Tool.cwd, "app-config.json"));
                    if (!appcwd) throw ("");
                }

                //Register the install
                await registerInstall();

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


function getMatchingUX4Version(version) {
    return new Promise((resolve, reject) => {
        const request = require("request");
        request("http://" + UX4Tool.getAddress() + "/releases/versions.json", function (error, response, body) {
            try {
                if (body) {
                    const versions = JSON.parse(body);
                    return resolve(Utils.resolveVersionNumber(version, versions));
                }
            } catch (e) {
                //Ignore, let the error handler below get it
                Utils.logError(e);
            }

            Utils.fatalError("Cannot load version list from " + UX4Tool.getAddress());
        });
    });
}



function registerInstall() {
    if (!appConfig) {
        return new Promise().reject();
    }

    UX4Tool.registerInstall({
        userID: UX4Tool.config.user || "",
        ux4Version: appConfig.ux4version,
        appVersion: appConfig.version,
        appName: appConfig.name,
        appDisplayName: appConfig.displayName
    });
}

function updateAppCwd(a) {
    appcwd = a + Path.sep;
    appConfig = File.readJSONSync(appcwd + "app-config.json");
}


async function installUX4() {

    //Build info
    let version;
    let standalone;

    return new Promise(async function (resolve, reject) {
        try {

            //If installing from local directory skip the dl part (dev tool)
            if (UX4Tool.params.local) {
                return;
            }

            //Get address
            if (typeof UX4Tool.getAddress() !== "string") {
                throw ("No download address configured. This can be set using the command:\n\n" + Utils.font.fg_yellow + "ux4 config set address <address>");
            }

            //Get version to dl
            version = await getUX4Version();
            if (typeof version !== "string") {
                throw ("No version specified. To download the latest release of UX4 use -version=latest");
            }
            standalone = UX4Tool.params.standalone || false;

            const installPath = UX4Tool.downloadDir + version;

            if (!standalone && File.existsSync(installPath)) {
                Utils.success("v" + version + " already installed on the system");
                resolve();
                return;
            }
            
            if (!standalone) File.mkdirSync(installPath);


            //Remove old ux4 if found
            //if (File.existsSync(UX4Tool.downloadDir)
            // if (appcwd && File.existsSync(appcwd + Path.sep + "ux4")) {
            //     console.log("Removing old build");
            //     File.removeSync(appcwd + Path.sep + "ux4");
            // }

            const filename = standalone ? "ux4" : "ux4app";
            //Download and install build
            console.log("Retrieving " + Utils.font.fg_cyan + "UX4 " + UX4Tool.filenameToType(filename) + " version " + version + Utils.font.reset);
            try {
                const FTP = require("./ux4-ftp");
                await FTP.downloadBuild(version, filename, (standalone ? UX4Tool.cwd : installPath));
                resolve();
            } catch (e) {
                reject(e);
            }

        } catch (e) {

            reject(e || "Installation Failed");
        }
    });
}

async function getUX4Version () {
    let userVersion = UX4Tool.params.version || UX4Tool.params.v || (appConfig ? appConfig.ux4version : null) || null;
    const matchedVersion=await getMatchingUX4Version(userVersion);
    console.log("Version " + userVersion + " matches " + matchedVersion);
    return matchedVersion;
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

    registerInstall: registerInstall,
    installUX4: installUX4,
    buildApp: buildApp,
    getMatchingUX4Version: getMatchingUX4Version
}