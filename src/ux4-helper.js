#!/usr/bin/env node

//Dependencies
const UX4Tool = require("./ux4-tool.js");
const Utils = require("./utils.js");
const UX4Application = require("./ux4-app.js");

//Register UX4 install
function task_help() {
    function opt(key, text) {
        console.log(Utils.font.fg_yellow + key + Utils.font.reset + (" ".repeat(60 - key.length)) + text);
    }

    let t = "UX4 Tools Help @" + UX4Tool.getVersion() + "";
    console.log(Utils.font.fg_cyan + "\n" + t);
    console.log("=".repeat(t.length) + "\n" + Utils.font.reset);

    console.log("The following commands can be executed:\n");
    opt("install", "Attempt to install the UX4 version sepcified in an existing app-config.json.");
    opt("install [-version=<version> | -v=<version>] (-standalone)", "Install a UX4 version. Optionally requesting a stand-alone build (no app features).");
    opt("config", "View or modify config values.");
    opt("create-app", "Create an application at the current location. Requires a UX4 app build to be present.");
    opt("build-app", "Build the application at the current location. Arguments will pass through to the app build script.");
    opt("check-update", "Check for an update of this UX4 Tool.");
    opt("help", "Show this help screen.");
    opt("version, v", "Display version information.");
    console.log();
    opt("(-cwd=<path/to/directory>)", "This parameter can be used to specify a current working directory other than the current location.");

    console.log("");
}


//Main Entry Point
(async () => {

    //Load reference files
    UX4Tool.loadCache();

    //List of tasks which require proper initialisation before use
    const mainTasks = ["create-app", "build-app", "install"];

    //Determine task
    const task = (process.argv[2]) ? process.argv[2].toLowerCase() : undefined;

    //If running a main task ensure certain config values are set
    if (mainTasks.includes(task)) {

        await UX4Tool.promptForMissingConfigValues();

        //We don't need to check the database for a build-app task
        if (task !== "build-app") {
            try {
                await UX4Tool.pingDatabase();
            } catch (e) {
                Utils.logError("Failed to connect to registration database. \nPlease check the database address in your config and/or your internet connection.");

                if (!UX4Tool.params.noreg)
                    process.exit(1);
            }
        }
    }

    //Run task
    try {
        switch (task) {
            //Main tasks
            case "install":

                await UX4Application.installUX4();

                //If an app build we need to do some more steps
                if (!UX4Tool.params.standalone) {
                    let createApp = false;
                    //If existing app run app install(update) script else ask if an application should be created
                    if (UX4Application.getAppConfig()) {
                        createApp = true;
                    } else {

                        const Inquirer = require("inquirer");
                        const answer = await Inquirer.prompt({
                            name: 'createapp',
                            type: 'confirm',
                            message: 'Do you want to create a new UX4 application now?'
                        });

                        //If yes, create a new app using the app install script
                        if (answer.createapp) createApp = true;
                    }

                    if (createApp) await UX4Application.createApplication();
                }
                break;
            case "create-app":
                if (UX4Application.getAppConfig()) {
                    Utils.fatalError("A UX4 application already exists at this location.");
                } else {
                    await UX4Application.createApplication();
                }
                break;
            case "build-app":
                await UX4Application.buildApp();
                break;

            //Util Tasks
            case "v":
            case "version":
                const v = UX4Tool.getVersion();
                console.log("Current version of UX4 Tools is v" + v);
                break;
            case "config":
                UX4Tool.configOptions();
                break;
            case "check-update":
                    console.log("Checking for updates.");
                    await UX4Tool.checkForUpdate();
                    if (UX4Tool.isUpdateToDate())
                        Utils.success("Up to date.");
                break;
            case "help":
                task_help();
                break;
            case "reg":
                await UX4Application.registerInstall();
                console.log("Application registered with UX4 Server")
                break;
            default:
                if (process.argv[2]) Utils.logError("command '" + process.argv[2] + "' not recognised.");
                task_help();
                break;
        }
    } catch (e) {
        Utils.fatalError(e);
    }

    //Log update prompts after certain tasks
    if (mainTasks.includes(task) || task === "check-update") {
        await UX4Tool.isUpdateAvailable();
    }

})();
