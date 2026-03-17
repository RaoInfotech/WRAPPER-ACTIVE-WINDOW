const fs = require("fs");
const path = require("path");
const GetActiveWindow = require("./src/get-active-window.js");
const SetupBrowserJSONData = require("./src/setup_browser_json.js");

const getActiveWindow = async (folderName) => {
    return new Promise((resolve, rejects) => {
        const get_active_win = new GetActiveWindow(folderName);
        get_active_win.getCurrentActiveWindow().then((result) => {
            console.log("result", result);
            return resolve(result)
        }).catch((error) => {
            return rejects(error)
        })
    })
}

const setUpJsonBrowserFile = async (browserData, folderName) => {
    const save_path_browser = new SetupBrowserJSONData();
    save_path_browser.saveFile(browserData, folderName)
}

// For testing uncomment the following code and comment the code below it

// setInterval(() => {
//     console.log("\n\n")
//     getActiveWindow("Supersee").then(result => {
//         // console.log("result", result);
//     });
// }, 5000);

module.exports = {
    getActiveWindow,
    setUpJsonBrowserFile
}
