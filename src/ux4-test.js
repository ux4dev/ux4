
const Path = require('path');
const File = require('fs-extra');
const UX4Tool = require("./ux4-tool.js");
const Utils = require("./utils.js");
const UX4Application = require("./ux4-app.js");
const FTP = require("./ux4-ftp");
const testOutputLog = [];
var downloadedNewAutomation = false;
var testManifestPath;
var testManifest;


async function downloadUX4Automation() {
    const base = UX4Tool.configDir + Path.sep + "ux4automation";


    if (!File.existsSync(base)) {
        File.mkdirSync(base);
    }

    const target = base + Path.sep + UX4Application.getAppConfig().ux4version;

    if (File.existsSync(target)) {
        console.log("Using UX4Automation v" + UX4Application.getAppConfig().ux4version);
        return;
    }

    File.mkdirSync(target);
    console.log(`Installing UX4Automation v${UX4Application.getAppConfig().ux4version}`);
    await FTP.downloadBuild(UX4Tool.getAddress(), UX4Application.getUX4Version(), "resources/ux4automation", target);
    downloadedNewAutomation = true;
    console.log(`UX4Automation v${UX4Application.getAppConfig().ux4version} installed to ${target}`);
}

function loadTestManifest() {
    let filename = Path.resolve(UX4Tool.params.manifest || UX4Tool.params.m);

    if (!File.existsSync(filename)) {
        resultsConsoleError(`Invalid manifest: ${filename}\nPlease provide a valid <manifest>.json file using the -manifest parameter.\nE.g. ux4 test-app -manifest="testing/test-manifest.json"`);
        process.exit(1);
    }

    try {
        testManifestPath = Path.dirname(filename) + Path.sep;
        testManifest = File.readJsonSync(filename);

        testManifest.filename = filename;

        testManifest = Object.assign({
            "url": UX4Tool.params.url,
            "saveResultsTo": UX4Tool.params.saveResultsTo,
            "entryPoint": UX4Tool.params.entryPoint,
            "copyTo": UX4Tool.params.copyTo || ".tests"
        }, testManifest);

        if (!testManifest.url) {
            throw ("No URL specified. Provide -url on the commandline, or add a url entry to your test manifest");
        }

        if (!testManifest.saveResultsTo) {
            console.log("saveResultsTo not specified. No results will be saved");
        }

        if (!testManifest.entryPoint) {
            throw ("No entryPoint specified. Provide -entryPoint on the commandline, or add an entryPoint to your test manifest");
        }
    }
    catch (e) {
        resultsConsoleError("Invalid testing JSON specified");
        resultsConsoleError(e);
        process.exit(1);
    }
}

async function createTestManifest() {

    const Inquirer = require("inquirer");


    let answers = await Inquirer.prompt(
        {
            name: 'filename',
            type: 'input',
            message: 'Enter a name for your manifest file'

        });

    if (!answers.filename || answers.filename === "") {
        Utils.fatalError("Invalid filename specified");
        return;
    }


    //Create manifest
    const defaultManifest = {
        "saveResultsTo": "",
        "url": "",
        "copyTo": ".tests",
        "entryPoint": `${answers.filename}.js`,
        "filesToCopy": [
            "./*.js"
        ],
        "launchOptions": {
            "devtools": false
        },
        "closeBrowserOnCompletion": true,
        "removeAutomationFilesOnCompletion": true,
        "storeOnlyLatestResults":true,
        "parameters": {},
        "testSetsToRun": []
    }

    //Save the manifest
    const manifest = UX4Tool.cwd + Path.sep + answers.filename + ".manifest.json";
    console.log("Created " + manifest);
    File.writeFileSync(manifest, JSON.stringify(defaultManifest, null, "\t"));

    //Create default test runner file
    const testRunnerJS = `${UX4Tool.cwd}${Path.sep}${answers.filename}.js`;
    File.copySync(__dirname + "/templates/testrunner.js", testRunnerJS);
    console.log("Created " + testRunnerJS);

}

async function createTestSet() {
    const Inquirer = require("inquirer");

    let answers = await Inquirer.prompt(
        {
            name: 'testSetName',
            type: 'input',
            message: 'Enter a name for the TestSet'

        });

    if (!answers.testSetName || answers.testSetName === "") {
        Utils.fatalError("Invalid testSetName specified");
        return;
    }

    // Create testset file
    const testsetFilename = `${UX4Tool.cwd}${Path.sep}${answers.testSetName}.js`;
    File.copySync(__dirname + "/templates/testset.js", testsetFilename);
    console.log("Created " + testsetFilename);

    return answers.testSetName;
}

async function copyTestsToTarget() {
    let copyTo = getTestTargetFolder();
    const Glob = require('glob-all');

    //Create the test target folder if it doesn't exist
    if (!File.existsSync(copyTo)) {
        console.log("Creating test folder : " + copyTo);
        File.mkdirSync(copyTo);
    }

    const ux4LibDir = `${testManifestPath}UX4Automation/`;
    const files = Glob.sync(testManifest.filesToCopy, { cwd: UX4Tool.cwd });
    const ux4Files = Glob.sync(["*.js"], { cwd: ux4LibDir });

    console.log("Deploying test scripts: ");
    //Copy user test scripts
    files.forEach((file) => {
        let filenamePart = Path.basename(file);
        File.copySync(file, copyTo + filenamePart);
        console.log("  " + filenamePart);
    });

    //Copy UX4 Automation scripts
    ux4Files.forEach((file) => {
        let filenamePart = Path.basename(file);
        File.copySync(ux4LibDir + file, copyTo + "UX4Automation/" + filenamePart);
        console.log("  " + filenamePart);
    });
}

async function removeTestsFromTarget() {
    if (testManifest.removeAutomationFilesOnCompletion === false) {
        console.log("Skipping undeployment of automation files");
        return;
    }
    console.log("Undeploying test folder");
    File.removeSync(getTestTargetFolder());
}

function getTestTargetFolder() {
    let target;

    //Get the target from the params or the test manifest file
    target = UX4Tool.params.target || testManifest.target;

    if (target) {
        if (!File.existsSync(target)) {
            Utils.logError(`Target folder '${UX4Tool.params.target}' does not exist`);
            process.exit(1);
        }
    }
    else if (File.existsSync(UX4Application.getAppcwd() + "/build.json")) {
        target = File.readJSONSync(UX4Application.getAppcwd() + "/build.json").target;
    }

    if (target) {
        return target + "/" + (UX4Tool.params.copyTo || testManifest.copyTo) + "/";
    }

    Utils.logError(`A target folder has not been provided`);
    process.exit(1);
}


function saveTestResults(results) {
    if (!testManifest.storeOnlyLatestResults) {
        const d = new Date();
        const folder=d.getFullYear() + String(d.getMonth()).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + String(d.getSeconds()).padStart(2, "0");
        doSaveTestResults(results, folder);
    }

    doSaveTestResults(results, "latest");
}

function doSaveTestResults(results, folder) {
    
    
    const path = testManifest.saveResultsTo + "/" + folder;

    console.log("\nResults:\n========\nPassed: " + results.json.passed + "\nFailed: " + results.json.failed + "\nResults saved to " + path);

    //If no path to save the results has been provided then just output the JSON to the stdout
    if (!testManifest.saveResultsTo) {
        console.log(JSON.stringify(results.json, null, "\t"));
        console.log("Console Output\n==============");
        console.log(testOutputLog.join("\n"));
        return;
    }

    if (!File.existsSync(testManifest.saveResultsTo)) {
        try {
            File.mkdirSync(testManifest.saveResultsTo);
        }
        catch (e) {
            Utils.logError(`Folder '${testManifest.resultTarget}' does not exists and cannot be created`);
            process.exit(1);
        }
    }

    if (!File.existsSync(path)) {
        try {
            File.mkdirSync(path);
        }
        catch (e) {
            Utils.logError(`Folder '${path}' does not exists and cannot be created`);
            process.exit(1);
        }
    }

    File.writeJSONSync(path + "/report.json", results.json);
    File.writeFileSync(path + "/report.html", results.html);
    File.writeFileSync(path + "/consoleoutput.txt", testOutputLog.join("\n"));
}

async function installUX4Automation() {

    let answers = await Inquirer.prompt(
        {
            name: 'continue',
            type: 'confirm',
            message: 'This will download the UX4Automation library into the current folder. Do you want to continue?',
            default: true
        });

    if (answers.continue) {
        await downloadUX4Automation();
        copyUX4AutomationLibraryIntoProject();
    }
}

function copyUX4AutomationLibraryIntoProject() {
    const Glob = require('glob-all');
    let first = true;
    const ux4LibDir = `${UX4Tool.configDir}/ux4automation/${UX4Application.getAppConfig().ux4version}/`;
    const ux4Files = Glob.sync(["*.js", "*.d.ts"], { cwd: ux4LibDir });
    let filesCopied = 0;

    //Copy UX4 Automation scripts
    ux4Files.forEach((file) => {
        let filenamePart = Path.basename(file);
        const target = UX4Tool.cwd + "UX4Automation/" + filenamePart;
        //If new files have been downloaded from the server, or the file doesn't exist in the target folder, then copy across
        const exists = File.existsSync(target);
        if (downloadedNewAutomation || !exists) {
            File.copySync(ux4LibDir + file, target);
            if (first) console.log("Updating project with new UX4Automation files:");
            first = false;
            console.log(Utils.font.fg_green + ((exists) ? "   Updated " : "   Added ") + Utils.font.reset + filenamePart);
            filesCopied++;
        }


    });

    if (filesCopied === 0) {
        console.log("All files up-to-date");
    }
}


function resultsConsoleError(e) {
    testOutputLog.push("** Test Runner Message **");
    testOutputLog.push(e);
    testOutputLog.push("** End of Test Runner Message **");
    Utils.logError(e);
}


async function runTests(browser, page) {
    let results;
    try {
        results = await page.evaluate(async (entryPoint, testSetsToRun, parameters) => {
            try {
                const testing = await import(entryPoint + "?nc=" + (new Date()).getTime());
                UX4Automation.setParameters(parameters);
                await testing.Tests.start(...testSetsToRun);
                return {
                    json: UX4Automation.getReport(),
                    html: UX4Automation.getReport("html", `
                    <div>
                        <a href="report.json" target="json">JSON</a>&nbsp; &nbsp;
                        <a href="consoleoutput.txt" target="outputlog">Console Output</a>
                    </div>                    
                    `)
                };
            }
            catch (e) {
                console.log(e);
                return {
                    json: UX4Automation.getReport(),
                    html: UX4Automation.getReport("html", `
                    <div>
                        <a href="report.json" target="json">JSON</a>&nbsp; &nbsp;
                        <a href="consoleoutput.txt" target="outputlog">Console Output</a>
                    </div>                    
                    `)
                };
            };
        }, "./" + testManifest.copyTo + "/" + testManifest.entryPoint, (testManifest.testSetsToRun || []), (testManifest.parameters || {}));

        if (results) {
            saveTestResults(results);
        }
        else {
            resultsConsoleError("Error No results generated");
            process.exit(1);
        }
        console.log("Testing Completed.");

    }
    catch (e) {
        if (e.message.includes("Execution context was destroyed")) {
            return runTests(browser, page);
        }

        resultsConsoleError("Unexpected Major Error");
        resultsConsoleError(e.message);
        Utils.logError(e.message);
        Utils.logError("Testing Completed. Unexpected Major Error");
        saveTestResults(results);
        process.exit(1);
    }
}



const UX4Test = {

    test: async function () {
        loadTestManifest();
        testOutputLog.length = 0;
        await downloadUX4Automation();
        await copyTestsToTarget();
        const puppeteer = require("puppeteer");
        const browser = await puppeteer.launch(testManifest.launchOptions);
        const page = await browser.newPage();

        page.on('console', msg => {
            for (let i = 0; i < msg.args().length; ++i) {
                let m = msg.args()[i];
                if (!m._remoteObject) continue;

                if (m._remoteObject.type === "object") {
                    m = JSON.stringify(m._remoteObject.preview, null, "\t");
                }
                else if (m._remoteObject.value) {
                    m = String(m._remoteObject.value);
                    if (m.startsWith("color: ")) continue;
                    if (m.startsWith("%c")) m = m.substr(2);
                }


                testOutputLog.push(m);
            }
        });

        await page.goto(testManifest.url);
        await runTests(browser, page);
        if (testManifest.closeBrowserOnCompletion === false) await browser.waitForTarget(() => false);
        removeTestsFromTarget();
        await browser.close();
    },

    installUX4Automation: async function () {
        await installUX4Automation();
    },

    createTestManifest: createTestManifest,
    createTestSet: createTestSet
};


module.exports = UX4Test;
