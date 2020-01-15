import { UX4Automation } from "./UX4Automation/ux4.automation.js";
window.UX4Automation = UX4Automation;

export const Tests = {

    /**
     * Run a testSet file
     *
     * @param {*} testSetBaseFilename The name of testset filename (Without .js extension)
     */
    runTestSet: async function (testSetBaseFilename) {
        try {
            const test = await import(`./${testSetBaseFilename}.js`);
            await UX4Automation.run([test.testSet], true, false);
        }
        catch (e) {
            console.error(e);
        };
    },

    /**
     * This is the entry point which the UX4Automation will call for this test run
     *
     * @param {*} testSets Test Sets from within your test manifest file testSetsToRun array
     */
    start: async function (...testSets) {
        for (const id of testSets) {
            await this.runTestSet(id);
        }
    }
};

