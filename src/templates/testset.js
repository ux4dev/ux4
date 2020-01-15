import { UX4Automation } from "./UX4Automation/ux4.automation.js";
window.UX4Automation = UX4Automation;

async function exampleTest() {
    await UX4Automation.sleep(100);

    //If you want to fail a test then just throw and error
    //throw new Error("Test failed");
}

export const testSet =
{
    name: "<Enter your testset name here>",
    description: "<Add a description>",
    tests: [
        {
            name: "exampleTest",
            description: "<A description of the test>",
            run: exampleTest
        }
    ]
};
